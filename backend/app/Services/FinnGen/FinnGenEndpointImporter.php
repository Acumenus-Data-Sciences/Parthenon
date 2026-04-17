<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Enums\CohortDomain;
use App\Models\App\CohortDefinition;
use App\Models\App\FinnGenUnmappedCode;
use App\Services\FinnGen\Dto\EndpointRow;
use App\Services\FinnGen\Dto\ImportReport;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * Orchestrates a full FinnGen endpoint-library import:
 *
 *   parse (FinnGenXlsxReader)
 *     → expand source-code patterns (FinnGenPatternExpander)
 *     → resolve to OMOP concept IDs (FinnGenConceptResolver)
 *     → classify coverage bucket
 *     → upsert CohortDefinition (updateOrCreate by name) with events disabled
 *     → record unmapped codes in app.finngen_unmapped_codes
 *     → write per-release coverage JSON to storage/app/finngen-endpoints/
 *
 * Idempotent: re-running the same release keeps the same row count.
 * The observer (CohortDefinitionObserver) is intentionally bypassed during
 * the bulk loop to avoid flooding Horizon with thousands of SolrUpdateCohortJob
 * dispatches — the caller runs one bulk `solr:index-cohorts --fresh` after.
 */
final class FinnGenEndpointImporter
{
    public const IMPORTER_VERSION = '1.0.0';

    /** Batch size: one transaction per N endpoints (PG poisoning containment). */
    public const BATCH_SIZE = 500;

    public const FIXTURE_FILENAMES = [
        'df12' => 'FINNGEN_ENDPOINTS_DF12_Final_2023-05-17_public.xlsx',
        'df13' => 'FINNGEN_ENDPOINTS_DF13_Final_2025-08-14_public.xlsx',
        'df14' => 'FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx',
    ];

    public function __construct(
        private readonly FinnGenConceptResolver $resolver,
    ) {}

    /**
     * Perform the import. Returns the populated report.
     *
     * @param  'df12'|'df13'|'df14'  $release
     * @param  Closure(int,int):void|null  $progress  callback(rowsDone, rowsTotal)
     */
    public function import(
        string $release,
        int $authorId,
        bool $dryRun = false,
        ?int $limit = null,
        ?string $fixturePath = null,
        ?Closure $progress = null,
    ): ImportReport {
        $path = $this->resolveFixturePath($release, $fixturePath);
        $reader = new FinnGenXlsxReader($path);

        $report = new ImportReport;
        $report->total = 0;

        $unmappedAggregator = []; // keyed by "name|code|vocab"

        $total = $reader->estimateTotal();

        // Disable observer for the bulk loop — D-07, T-qpg-05.
        CohortDefinition::withoutEvents(function () use (
            $reader, $release, $authorId, $dryRun, $limit, $progress, $report, $total, $path, &$unmappedAggregator
        ): void {
            $batch = [];
            $processed = 0;
            foreach ($reader->rows() as $row) {
                if ($limit !== null && $report->total >= $limit) {
                    break;
                }
                $report->total++;
                $batch[] = $row;
                $processed++;
                if (count($batch) >= self::BATCH_SIZE) {
                    $this->processBatch($batch, $release, $authorId, $dryRun, $path, $report, $unmappedAggregator);
                    $batch = [];
                }
                if ($progress !== null) {
                    $progress($processed, $total);
                }
            }
            if ($batch !== []) {
                $this->processBatch($batch, $release, $authorId, $dryRun, $path, $report, $unmappedAggregator);
            }
        });

        // Upsert unmapped codes — outside withoutEvents (FinnGenUnmappedCode has no observer).
        if (! $dryRun && $unmappedAggregator !== []) {
            $this->flushUnmapped($unmappedAggregator, $release);
        }

        // Coverage JSON — always write, even on dry-run, so operators can inspect.
        $report->reportPath = $this->writeCoverageReport($release, $report);

        return $report;
    }

    /**
     * @param  list<EndpointRow>  $batch
     * @param  array<string, array{endpoint:string, code:string, vocab:string, column:string, count:int}>  $unmappedAggregator
     */
    private function processBatch(
        array $batch,
        string $release,
        int $authorId,
        bool $dryRun,
        string $sourcePath,
        ImportReport $report,
        array &$unmappedAggregator,
    ): void {
        DB::transaction(function () use ($batch, $release, $authorId, $dryRun, $sourcePath, $report, &$unmappedAggregator): void {
            foreach ($batch as $row) {
                $this->processRow($row, $release, $authorId, $dryRun, $sourcePath, $report, $unmappedAggregator);
            }
        });
    }

    /**
     * @param  array<string, array{endpoint:string, code:string, vocab:string, column:string, count:int}>  $unmappedAggregator
     */
    private function processRow(
        EndpointRow $row,
        string $release,
        int $authorId,
        bool $dryRun,
        string $sourcePath,
        ImportReport $report,
        array &$unmappedAggregator,
    ): void {
        // Expand every pattern-bearing column.
        $hd10Raw = FinnGenPatternExpander::expand($row->hd_icd_10);
        $hd9Raw = FinnGenPatternExpander::expand($row->hd_icd_9);
        $hd8Raw = FinnGenPatternExpander::expand($row->hd_icd_8);
        $cod10Raw = FinnGenPatternExpander::expand($row->cod_icd_10);
        $cod9Raw = FinnGenPatternExpander::expand($row->cod_icd_9);
        $cod8Raw = FinnGenPatternExpander::expand($row->cod_icd_8);
        $outpatRaw = FinnGenPatternExpander::expand($row->outpat_icd);
        $kelaAtcRaw = FinnGenPatternExpander::expand($row->kela_atc);
        $kelaReimbRaw = FinnGenPatternExpander::expand($row->kela_reimb);
        $kelaReimbIcdRaw = FinnGenPatternExpander::expand($row->kela_reimb_icd);
        $cancTopoRaw = FinnGenPatternExpander::expand($row->canc_topo);
        $cancMorphRaw = FinnGenPatternExpander::expand($row->canc_morph);
        $cancBehavRaw = FinnGenPatternExpander::expand($row->canc_behav);
        $operNomRaw = FinnGenPatternExpander::expand($row->oper_nom);

        // Skip DEATH-style "ANY" tokens: they mean "any code in this vocab" and don't map.
        $icd10Prefixes = array_values(array_filter(
            array_merge($hd10Raw, $cod10Raw, $outpatRaw, $kelaReimbIcdRaw),
            static fn (string $t): bool => $t !== 'ANY',
        ));
        $icd9Prefixes = array_values(array_filter(
            array_merge($hd9Raw, $cod9Raw),
            static fn (string $t): bool => $t !== 'ANY',
        ));
        $icd8Prefixes = array_values(array_filter(
            array_merge($hd8Raw, $cod8Raw),
            static fn (string $t): bool => $t !== 'ANY',
        ));
        $atcPrefixes = array_values(array_filter(
            $kelaAtcRaw,
            static fn (string $t): bool => $t !== 'ANY',
        ));

        // Resolve.
        $icd10 = $this->resolver->resolveIcd10($icd10Prefixes);
        $icd9 = $this->resolver->resolveIcd9($icd9Prefixes);
        $atc = $this->resolver->resolveAtc($atcPrefixes);
        $icd8 = $this->resolver->resolveIcd8($icd8Prefixes); // always empty

        // Coverage math — count tokens vs resolved.
        $totalTokens =
            count($icd10Prefixes) + count($icd9Prefixes) + count($icd8Prefixes) +
            count($atcPrefixes) + count($kelaReimbRaw) + count($cancTopoRaw) +
            count($cancMorphRaw) + count($cancBehavRaw) + count($operNomRaw);

        // "Resolved" heuristic: for each vocab group, if at least one standard concept came back,
        // count all its tokens as resolved. (Prefix matches can expand 1 token → 100 concepts.)
        $resolvedTokens = 0;
        if ($icd10['standard'] !== [] || $icd10['source'] !== []) {
            $resolvedTokens += count($icd10Prefixes);
        }
        if ($icd9['standard'] !== [] || $icd9['source'] !== []) {
            $resolvedTokens += count($icd9Prefixes);
        }
        if ($atc['standard'] !== [] || $atc['source'] !== []) {
            $resolvedTokens += count($atcPrefixes);
        }

        [$bucket, $pct] = $this->classifyCoverage($totalTokens, $resolvedTokens);
        $report->coverage[$bucket] = ($report->coverage[$bucket] ?? 0) + 1;

        // Record unmapped vocabularies.
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $hd8Raw, 'ICD8', 'HD_ICD_8', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $cod8Raw, 'ICD8', 'COD_ICD_8', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $cancTopoRaw, 'ICDO3', 'CANC_TOPO', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $cancMorphRaw, 'ICDO3', 'CANC_MORPH', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $cancBehavRaw, 'ICDO3', 'CANC_BEHAV', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $kelaReimbRaw, 'KELA_REIMB', 'KELA_REIMB', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, FinnGenPatternExpander::expand($row->kela_vnro), 'KELA_VNRO', 'KELA_VNRO', $report);
        $this->aggregateUnmapped($unmappedAggregator, $row->name, $operNomRaw, 'NOMESCO', 'OPER_NOM', $report);

        // Also record ICD-10/9/ATC tokens that returned zero resolved ids as unmapped.
        if ($icd10Prefixes !== [] && $icd10['standard'] === [] && $icd10['source'] === []) {
            $this->aggregateUnmapped($unmappedAggregator, $row->name, $icd10Prefixes, 'ICD10_UNMATCHED', 'ICD10', $report);
        }
        if ($icd9Prefixes !== [] && $icd9['standard'] === [] && $icd9['source'] === []) {
            $this->aggregateUnmapped($unmappedAggregator, $row->name, $icd9Prefixes, 'ICD9_FIN', 'ICD9', $report);
        }
        if ($atcPrefixes !== [] && $atc['standard'] === [] && $atc['source'] === []) {
            $this->aggregateUnmapped($unmappedAggregator, $row->name, $atcPrefixes, 'ATC_UNMATCHED', 'KELA_ATC', $report);
        }

        if ($dryRun) {
            return;
        }

        // Build expression_json per RESEARCH §3.
        $expression = $this->buildExpressionJson(
            $row, $release, basename($sourcePath),
            $hd10Raw, $hd9Raw, $hd8Raw, $cod10Raw, $cod9Raw, $cod8Raw,
            $outpatRaw, $operNomRaw, $kelaReimbRaw, $kelaAtcRaw,
            $cancTopoRaw, $cancMorphRaw, $cancBehavRaw,
            $icd10, $icd9, $atc, $bucket, $pct, $totalTokens, $resolvedTokens,
        );

        // Tags: merge row tags with mandatory import tags.
        $tags = array_values(array_unique(array_merge(
            ['finngen-endpoint', 'finngen:'.$release],
            $row->tags,
        )));

        // Description — honest about generation being out of scope.
        $description = sprintf(
            '%s — FinnGen Endpoint Library (%s). Source: https://finngen.fi. '.
            'Note: cohort generation against a CDM is not yet implemented for this shape; '.
            'copy to a custom cohort first.',
            $row->longname ?? $row->name,
            strtoupper($release),
        );

        $existing = CohortDefinition::where('name', $row->name)->first();
        CohortDefinition::updateOrCreate(
            ['name' => $row->name],
            [
                'description' => $description,
                'expression_json' => $expression,
                'author_id' => $authorId,
                'is_public' => true,
                'version' => $existing?->version ?? 1,
                'tags' => $tags,
                'domain' => CohortDomain::FINNGEN_ENDPOINT,
                'quality_tier' => 'draft',
            ],
        );
        $report->imported++;
    }

    /**
     * @param  list<string>  $hd10Raw
     * @param  list<string>  $hd9Raw
     * @param  list<string>  $hd8Raw
     * @param  list<string>  $cod10Raw
     * @param  list<string>  $cod9Raw
     * @param  list<string>  $cod8Raw
     * @param  list<string>  $outpatRaw
     * @param  list<string>  $operNomRaw
     * @param  list<string>  $kelaReimbRaw
     * @param  list<string>  $kelaAtcRaw
     * @param  list<string>  $cancTopoRaw
     * @param  list<string>  $cancMorphRaw
     * @param  list<string>  $cancBehavRaw
     * @param  array{standard:list<int>,source:list<int>,truncated:bool}  $icd10
     * @param  array{standard:list<int>,source:list<int>,truncated:bool}  $icd9
     * @param  array{standard:list<int>,source:list<int>,truncated:bool}  $atc
     * @return array<string, mixed>
     */
    private function buildExpressionJson(
        EndpointRow $row,
        string $release,
        string $sourceFile,
        array $hd10Raw,
        array $hd9Raw,
        array $hd8Raw,
        array $cod10Raw,
        array $cod9Raw,
        array $cod8Raw,
        array $outpatRaw,
        array $operNomRaw,
        array $kelaReimbRaw,
        array $kelaAtcRaw,
        array $cancTopoRaw,
        array $cancMorphRaw,
        array $cancBehavRaw,
        array $icd10,
        array $icd9,
        array $atc,
        string $bucket,
        float $pct,
        int $totalTokens,
        int $resolvedTokens,
    ): array {
        // Dedup standard + source concept arrays across vocabs.
        $conditionsStandard = array_values(array_unique(array_merge($icd10['standard'], $icd9['standard'])));
        $drugsStandard = array_values(array_unique($atc['standard']));
        $sourceConceptIds = array_values(array_unique(array_merge(
            $icd10['source'], $icd9['source'], $atc['source'],
        )));
        $truncated = $icd10['truncated'] || $icd9['truncated'] || $atc['truncated'];

        return [
            'kind' => 'finngen_endpoint',
            'spec_version' => '1.0',
            'release' => $release,
            // Top-level coverage_bucket for cheap SQL filtering and UI display.
            // Mirrors coverage.bucket below; promoted so callers don't need
            // a 2-level JSON path traversal to filter by mapping quality.
            'coverage_bucket' => $bucket,
            'level' => $row->level,
            'sex_restriction' => $row->sex_restriction,
            'include_endpoints' => $row->include,
            'tags' => $row->tags,
            'pre_conditions' => $row->pre_conditions,
            'conditions' => $row->conditions,
            'source_codes' => [
                'hd_icd_10' => ['raw' => $row->hd_icd_10, 'patterns' => $hd10Raw],
                'hd_icd_9' => ['raw' => $row->hd_icd_9, 'patterns' => $hd9Raw],
                'hd_icd_8' => ['raw' => $row->hd_icd_8, 'patterns' => $hd8Raw],
                'hd_icd_10_excl' => ['raw' => $row->hd_icd_10_excl, 'patterns' => FinnGenPatternExpander::expand($row->hd_icd_10_excl)],
                'hd_icd_9_excl' => ['raw' => $row->hd_icd_9_excl, 'patterns' => FinnGenPatternExpander::expand($row->hd_icd_9_excl)],
                'hd_icd_8_excl' => ['raw' => $row->hd_icd_8_excl, 'patterns' => FinnGenPatternExpander::expand($row->hd_icd_8_excl)],
                'cod_icd_10' => ['raw' => $row->cod_icd_10, 'patterns' => $cod10Raw],
                'cod_icd_9' => ['raw' => $row->cod_icd_9, 'patterns' => $cod9Raw],
                'cod_icd_8' => ['raw' => $row->cod_icd_8, 'patterns' => $cod8Raw],
                'outpat_icd' => ['raw' => $row->outpat_icd, 'patterns' => $outpatRaw],
                'oper_nom' => ['raw' => $row->oper_nom, 'patterns' => $operNomRaw],
                'kela_reimb' => ['raw' => $row->kela_reimb, 'patterns' => $kelaReimbRaw],
                'kela_reimb_icd' => ['raw' => $row->kela_reimb_icd, 'patterns' => FinnGenPatternExpander::expand($row->kela_reimb_icd)],
                'kela_atc' => ['raw' => $row->kela_atc, 'patterns' => $kelaAtcRaw],
                'canc_topo' => ['raw' => $row->canc_topo, 'patterns' => $cancTopoRaw],
                'canc_morph' => ['raw' => $row->canc_morph, 'patterns' => $cancMorphRaw],
                'canc_behav' => ['raw' => $row->canc_behav, 'patterns' => $cancBehavRaw],
            ],
            'resolved_concepts' => [
                'conditions_standard' => $conditionsStandard,
                'drugs_standard' => $drugsStandard,
                'source_concept_ids' => $sourceConceptIds,
                'truncated' => $truncated,
            ],
            'coverage' => [
                'bucket' => $bucket,
                'n_tokens_total' => $totalTokens,
                'n_tokens_resolved' => $resolvedTokens,
                'pct' => $pct,
            ],
            'hd_mainonly' => $row->hd_mainonly,
            'cod_mainonly' => $row->cod_mainonly,
            'parent' => $row->parent,
            'provenance' => [
                'source_file' => $sourceFile,
                'source_row' => $row->source_row,
                'imported_at' => now()->toIso8601String(),
                'importer_version' => self::IMPORTER_VERSION,
            ],
        ];
    }

    /**
     * @return array{0:string,1:float}
     */
    private function classifyCoverage(int $totalTokens, int $resolvedTokens): array
    {
        if ($totalTokens === 0) {
            return ['CONTROL_ONLY', 0.0];
        }
        $pct = $resolvedTokens / $totalTokens;
        if ($pct >= 0.95) {
            return ['FULLY_MAPPED', $pct];
        }
        if ($pct >= 0.50) {
            return ['PARTIAL', $pct];
        }
        if ($pct > 0.0) {
            return ['SPARSE', $pct];
        }

        return ['UNMAPPED', 0.0];
    }

    /**
     * @param  array<string, array{endpoint:string, code:string, vocab:string, column:string, count:int}>  $aggregator
     * @param  list<string>  $codes
     */
    private function aggregateUnmapped(
        array &$aggregator,
        string $endpoint,
        array $codes,
        string $vocab,
        string $column,
        ImportReport $report,
    ): void {
        foreach ($codes as $code) {
            if ($code === '' || $code === 'ANY') {
                continue;
            }
            $key = $endpoint.'|'.$code.'|'.$vocab;
            if (! isset($aggregator[$key])) {
                $aggregator[$key] = [
                    'endpoint' => $endpoint,
                    'code' => $code,
                    'vocab' => $vocab,
                    'column' => $column,
                    'count' => 0,
                ];
            }
            $aggregator[$key]['count']++;
            $report->topUnmappedVocabularies[$vocab] = ($report->topUnmappedVocabularies[$vocab] ?? 0) + 1;
        }
    }

    /**
     * @param  array<string, array{endpoint:string, code:string, vocab:string, column:string, count:int}>  $aggregator
     */
    private function flushUnmapped(array $aggregator, string $release): void
    {
        foreach ($aggregator as $rec) {
            FinnGenUnmappedCode::updateOrCreate(
                [
                    'endpoint_name' => substr($rec['endpoint'], 0, 120),
                    'source_code' => substr($rec['code'], 0, 64),
                    'source_vocab' => substr($rec['vocab'], 0, 32),
                    'release' => $release,
                ],
                [
                    'code_column' => substr($rec['column'], 0, 32),
                    'observed_count' => $rec['count'],
                ],
            );
        }
    }

    private function writeCoverageReport(string $release, ImportReport $report): string
    {
        $dir = storage_path('app/finngen-endpoints');
        File::ensureDirectoryExists($dir);
        $path = $dir.DIRECTORY_SEPARATOR.$release.'-coverage.json';
        arsort($report->topUnmappedVocabularies);
        File::put($path, json_encode([
            'release' => $release,
            'total' => $report->total,
            'imported' => $report->imported,
            'by_bucket' => $report->coverage,
            'top_unmapped_vocabularies' => $report->topUnmappedVocabularies,
            'generated_at' => now()->toIso8601String(),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $path;
    }

    private function resolveFixturePath(string $release, ?string $fixturePath): string
    {
        if ($fixturePath !== null) {
            $candidate = str_starts_with($fixturePath, '/')
                ? $fixturePath
                : base_path('database/fixtures/finngen/'.$fixturePath);
            if (! is_file($candidate)) {
                throw new RuntimeException("FinnGen fixture not found: {$candidate}");
            }

            return $candidate;
        }
        if (! isset(self::FIXTURE_FILENAMES[$release])) {
            throw new RuntimeException("Unknown release: {$release} (expected df12|df13|df14)");
        }
        $path = base_path('database/fixtures/finngen/'.self::FIXTURE_FILENAMES[$release]);
        if (! is_file($path)) {
            throw new RuntimeException(
                "Release fixture missing: {$path}. Run backend/database/fixtures/finngen/fetch.sh {$release} first."
            );
        }

        return $path;
    }
}
