<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Enums\CoverageProfile;
use App\Services\FinnGen\FinnGenConceptResolver;
use App\Services\FinnGen\FinnGenCoverageProfileClassifier;
use App\Services\FinnGen\FinnGenEndpointImporter;
use App\Services\FinnGen\FinnGenPatternExpander;
use App\Services\FinnGen\FinnGenXlsxReader;
use Illuminate\Console\Command;

/**
 * Phase 13 — D-10 empirical baseline scan.
 *
 * Runs the upgraded resolver against all FinnGen endpoints (default DF14) in
 * memory — NO DB writes — and writes a coverage profile distribution JSON to
 * storage/app/finngen-endpoints/phase13-baseline-<ISO8601>.json.
 *
 * The output JSON is the empirical evidence the planner reviews BEFORE the
 * live --overwrite re-import (Plan 08). It also serves as the artifact
 * attached to the verification step (per VALIDATION.md §Manual-Only
 * Verifications).
 *
 * Per RESEARCH.md §Baseline Scan Protocol — JSON keys are stable for
 * downstream tooling; do not rename without updating BaselineScanOutputTest.
 */
final class ScanCoverageProfileCommand extends Command
{
    protected $signature = 'finngen:scan-coverage-profile
        {--release=df14 : df12 | df13 | df14}
        {--dry-run : Required (the scan is always read-only; flag exists for CLI ergonomics)}
        {--fixture= : Override fixture filename (relative to database/fixtures/finngen/ or absolute)}';

    protected $description = 'Run the upgraded FinnGen resolver against all endpoints and emit coverage_profile baseline JSON (read-only)';

    public function handle(FinnGenConceptResolver $resolver): int
    {
        $release = $this->normalizeRelease((string) $this->option('release'));
        if ($release === null) {
            return self::INVALID;
        }

        $fixturePath = $this->resolveFixturePath($release);
        $reader = new FinnGenXlsxReader($fixturePath);

        $profileDist = ['universal' => 0, 'partial' => 0, 'finland_only' => 0];
        $bucketDist = ['FULLY_MAPPED' => 0, 'PARTIAL' => 0, 'SPARSE' => 0, 'UNMAPPED' => 0, 'CONTROL_ONLY' => 0];
        $invariantViolations = 0;
        $liftedByVocab = ['ICD8' => 0, 'ICDO3' => 0, 'NOMESCO' => 0, 'KELA_REIMB' => 0, 'ICD10_FIN' => 0, 'ICD9_FIN' => 0];
        $totalEndpoints = 0;
        $unmappedTotal = 0;

        foreach ($reader->rows() as $row) {
            $totalEndpoints++;

            // Mirror the importer's prefix-build per row.
            $hd10 = FinnGenPatternExpander::expand($row->hd_icd_10);
            $hd9 = FinnGenPatternExpander::expand($row->hd_icd_9);
            $hd8 = FinnGenPatternExpander::expand($row->hd_icd_8);
            $cod10 = FinnGenPatternExpander::expand($row->cod_icd_10);
            $cod9 = FinnGenPatternExpander::expand($row->cod_icd_9);
            $cod8 = FinnGenPatternExpander::expand($row->cod_icd_8);
            $outpat = FinnGenPatternExpander::expand($row->outpat_icd);
            $kelaAtc = FinnGenPatternExpander::expand($row->kela_atc);
            $kelaReimbRaw = FinnGenPatternExpander::expand($row->kela_reimb);
            $kelaReimbIcd = FinnGenPatternExpander::expand($row->kela_reimb_icd);
            $cancTopo = FinnGenPatternExpander::expand($row->canc_topo);
            $cancMorph = FinnGenPatternExpander::expand($row->canc_morph);
            $cancBehav = FinnGenPatternExpander::expand($row->canc_behav);
            $operNom = FinnGenPatternExpander::expand($row->oper_nom);

            $icd10Px = array_values(array_filter(
                array_merge($hd10, $cod10, $outpat, $kelaReimbIcd),
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $icd9Px = array_values(array_filter(
                array_merge($hd9, $cod9),
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $icd8Px = array_values(array_filter(
                array_merge($hd8, $cod8),
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $atcPx = array_values(array_filter(
                $kelaAtc,
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $icdO3Px = array_values(array_filter(
                array_unique(array_merge($cancTopo, $cancMorph, $cancBehav)),
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $nomescoPx = array_values(array_filter(
                $operNom,
                static fn (string $t): bool => $t !== 'ANY',
            ));
            $kelaReimbPx = array_values(array_filter(
                $kelaReimbRaw,
                static fn (string $t): bool => $t !== 'ANY',
            ));

            $icd10 = $resolver->resolveIcd10($icd10Px);
            $icd9 = $resolver->resolveIcd9($icd9Px);
            $atc = $resolver->resolveAtc($atcPx);
            $icd8 = $resolver->resolveIcd8($icd8Px);
            $icdO3 = $resolver->resolveIcdO3($icdO3Px);
            $nomesco = $resolver->resolveNomesco($nomescoPx);
            $kelaReimb = $resolver->resolveKelaReimb($kelaReimbPx);

            $profile = FinnGenCoverageProfileClassifier::classify(
                icd10: $icd10, icd9: $icd9, atc: $atc, icd8: $icd8,
                icdO3: $icdO3, nomesco: $nomesco, kelaReimb: $kelaReimb,
            );
            $profileDist[$profile->value]++;

            // Track STCM-lifted vocab counts — only count a vocab as "lifted"
            // when STCM returned at least one standard concept. ICD10_FIN /
            // ICD9_FIN lift on a per-endpoint basis can only be approximated
            // here (the resolver merges STCM with LIKE-ANY internally and
            // returns a union), so we treat any non-empty result as a lift
            // signal — sufficient for baseline review.
            if ($icd8['standard'] !== []) {
                $liftedByVocab['ICD8']++;
            }
            if ($icdO3['standard'] !== []) {
                $liftedByVocab['ICDO3']++;
            }
            if ($nomesco['standard'] !== []) {
                $liftedByVocab['NOMESCO']++;
            }
            if ($kelaReimb['standard'] !== []) {
                $liftedByVocab['KELA_REIMB']++;
            }
            if ($icd10['standard'] !== [] && $icd10Px !== []) {
                $liftedByVocab['ICD10_FIN']++;
            }
            if ($icd9['standard'] !== [] && $icd9Px !== []) {
                $liftedByVocab['ICD9_FIN']++;
            }

            // Bucket classification mirroring the importer's classifyCoverage.
            $totalTokens = count($icd10Px) + count($icd9Px) + count($icd8Px)
                + count($atcPx) + count($icdO3Px) + count($nomescoPx) + count($kelaReimbPx);
            $resolvedTokens = 0;
            if ($icd10['standard'] !== [] || $icd10['source'] !== []) {
                $resolvedTokens += count($icd10Px);
            }
            if ($icd9['standard'] !== [] || $icd9['source'] !== []) {
                $resolvedTokens += count($icd9Px);
            }
            if ($atc['standard'] !== [] || $atc['source'] !== []) {
                $resolvedTokens += count($atcPx);
            }
            if ($icd8['standard'] !== []) {
                $resolvedTokens += count($icd8Px);
            }
            if ($icdO3['standard'] !== []) {
                $resolvedTokens += count($icdO3Px);
            }
            if ($nomesco['standard'] !== []) {
                $resolvedTokens += count($nomescoPx);
            }
            if ($kelaReimb['standard'] !== []) {
                $resolvedTokens += count($kelaReimbPx);
            }

            $bucket = 'CONTROL_ONLY';
            if ($totalTokens > 0) {
                $pct = $resolvedTokens / $totalTokens;
                $bucket = match (true) {
                    $pct >= 0.95 => 'FULLY_MAPPED',
                    $pct >= 0.50 => 'PARTIAL',
                    $pct > 0.0 => 'SPARSE',
                    default => 'UNMAPPED',
                };
            }
            $bucketDist[$bucket]++;
            if ($bucket === 'UNMAPPED') {
                $unmappedTotal++;
                if ($profile === CoverageProfile::UNIVERSAL) {
                    $invariantViolations++;
                }
            }

            if ($totalEndpoints % 250 === 0) {
                $this->output->write(sprintf("\rScanned: %d", $totalEndpoints));
            }
        }
        $this->newLine();

        $payload = [
            'total_endpoints' => $totalEndpoints,
            'coverage_profile_distribution' => $profileDist,
            'coverage_bucket_distribution' => $bucketDist,
            'invariant_violations' => $invariantViolations,
            'baseline_unmapped_count' => $unmappedTotal,
            'top_lifted_vocabularies' => $liftedByVocab,
            'generated_at' => now()->toIso8601String(),
        ];

        $dir = storage_path('app/finngen-endpoints');
        if (! is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $stamp = now()->format('Ymd-His');
        $outPath = $dir.DIRECTORY_SEPARATOR.'phase13-baseline-'.$stamp.'.json';
        file_put_contents($outPath, (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        $this->info("Baseline JSON: {$outPath}");
        $this->info(sprintf(
            'profile: universal=%d partial=%d finland_only=%d',
            $profileDist['universal'], $profileDist['partial'], $profileDist['finland_only'],
        ));
        $this->info(sprintf(
            'bucket: FULLY=%d PARTIAL=%d SPARSE=%d UNMAPPED=%d CONTROL_ONLY=%d',
            $bucketDist['FULLY_MAPPED'], $bucketDist['PARTIAL'], $bucketDist['SPARSE'],
            $bucketDist['UNMAPPED'], $bucketDist['CONTROL_ONLY'],
        ));
        $this->info(sprintf('invariant_violations: %d', $invariantViolations));
        $this->info(sprintf(
            'lifted by vocab: ICD8=%d ICDO3=%d NOMESCO=%d KELA_REIMB=%d ICD10_FIN=%d ICD9_FIN=%d',
            $liftedByVocab['ICD8'], $liftedByVocab['ICDO3'], $liftedByVocab['NOMESCO'],
            $liftedByVocab['KELA_REIMB'], $liftedByVocab['ICD10_FIN'], $liftedByVocab['ICD9_FIN'],
        ));

        return self::SUCCESS;
    }

    private function normalizeRelease(string $raw): ?string
    {
        $r = strtolower(trim($raw));
        $aliases = ['r12' => 'df12', 'r13' => 'df13', 'r14' => 'df14'];
        if (isset($aliases[$r])) {
            $r = $aliases[$r];
        }
        if (! in_array($r, ['df12', 'df13', 'df14'], true)) {
            $this->error(sprintf('Unknown release "%s" (expected df12|df13|df14)', $raw));

            return null;
        }

        return $r;
    }

    private function resolveFixturePath(string $release): string
    {
        $fixture = $this->option('fixture');
        if (is_string($fixture) && $fixture !== '') {
            return str_starts_with($fixture, '/')
                ? $fixture
                : base_path('database/fixtures/finngen/'.$fixture);
        }

        return base_path('database/fixtures/finngen/'.FinnGenEndpointImporter::FIXTURE_FILENAMES[$release]);
    }
}
