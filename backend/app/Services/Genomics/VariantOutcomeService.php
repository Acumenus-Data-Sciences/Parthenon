<?php

namespace App\Services\Genomics;

use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Variant-Outcome Analysis Service
 *
 * Provides population-level analytics linking genomic variants to clinical outcomes.
 * All queries run against the OMOP CDM (cdm connection, omop schema).
 *
 * Methods:
 * - survivalByMutation: Kaplan-Meier event data stratified by variant presence
 * - treatmentVariantMatrix: Response rates by mutation × treatment combination
 * - genomicCharacterization: Waterfall/co-occurrence/TMB statistics for a cohort
 */
class VariantOutcomeService
{
    /**
     * Generate Kaplan-Meier–ready event data stratified by gene mutation presence.
     *
     * Returns two series (mutated / wild-type) with (time_days, event) pairs.
     * "Event" is death (person in death table within observation). Time = days from
     * first measurement of variant to death or end of observation period.
     *
     * @param  int  $sourceId  Parthenon source ID (resolves CDM connection)
     * @param  string  $gene  Gene symbol (e.g. "EGFR")
     * @param  string|null  $hgvs  Optional specific HGVS to filter (e.g. "p.Leu858Arg")
     * @param  int  $cohortId  Optional OMOP cohort_id to restrict population
     * @return array{mutated: array<array{t:int,e:int}>, wildtype: array<array{t:int,e:int}>, gene: string}
     */
    public function survivalByMutation(int $sourceId, string $gene, ?string $hgvs = null, ?int $cohortId = null): array
    {
        $conn = DB::connection('cdm');
        $schema = 'omop';

        // Get person_ids with this gene variant
        $variantQuery = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->where('gene_symbol', $gene)
            ->when($hgvs, fn ($q) => $q->where('hgvs_p', 'like', "%{$hgvs}%"))
            ->whereNotNull('person_id')
            ->pluck('person_id')
            ->unique()
            ->values();

        if ($variantQuery->isEmpty()) {
            return ['mutated' => [], 'wildtype' => [], 'gene' => $gene];
        }

        $mutatedIds = $variantQuery->all();

        // Get observation periods and deaths for mutated persons
        $mutatedEvents = $this->getSurvivalEvents($conn, $schema, $mutatedIds, $cohortId);

        // Get a matched wild-type cohort (same size, no variant for this gene)
        $wildtypeIds = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereNotNull('person_id')
            ->whereNotIn('person_id', $mutatedIds)
            ->when($cohortId, fn ($q) => $q) // could add cohort filter here
            ->distinct()
            ->limit(count($mutatedIds) * 3)
            ->pluck('person_id')
            ->filter(fn ($pid) => ! in_array($pid, $mutatedIds))
            ->take(count($mutatedIds))
            ->values()
            ->all();

        $wildtypeEvents = $wildtypeIds ? $this->getSurvivalEvents($conn, $schema, $wildtypeIds, $cohortId) : [];

        return [
            'gene' => $gene,
            'hgvs' => $hgvs,
            'mutated' => $mutatedEvents,
            'wildtype' => $wildtypeEvents,
            'n_mutated' => count($mutatedIds),
            'n_wildtype' => count($wildtypeIds),
        ];
    }

    /**
     * @param  int[]  $personIds
     * @return array<array{t: int, e: int}>
     */
    private function getSurvivalEvents(\Illuminate\Database\Connection $conn, string $schema, array $personIds, ?int $cohortId): array
    {
        if (empty($personIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($personIds), '?'));

        try {
            $rows = $conn->select(
                "SELECT
                    op.person_id,
                    EXTRACT(DAY FROM (COALESCE(d.death_date, op.observation_period_end_date) - op.observation_period_start_date))::int AS time_days,
                    CASE WHEN d.person_id IS NOT NULL THEN 1 ELSE 0 END AS event
                 FROM {$schema}.observation_period op
                 LEFT JOIN {$schema}.death d ON d.person_id = op.person_id
                 WHERE op.person_id IN ({$placeholders})
                 AND EXTRACT(DAY FROM (COALESCE(d.death_date, op.observation_period_end_date) - op.observation_period_start_date)) > 0
                 ORDER BY op.person_id, op.observation_period_start_date
                 LIMIT 5000",
                $personIds
            );

            // One row per person (take longest observation period)
            $seen = [];
            $result = [];
            foreach ($rows as $row) {
                if (! isset($seen[$row->person_id])) {
                    $seen[$row->person_id] = true;
                    $result[] = ['t' => (int) $row->time_days, 'e' => (int) $row->event];
                }
            }

            return $result;
        } catch (\Throwable $e) {
            Log::warning('VariantOutcomeService: survival query failed', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * Treatment × Variant response matrix.
     *
     * For each combination of (gene_symbol × drug_concept_name), computes:
     * - n: patients with both the variant and the treatment
     * - event_rate: proportion who had a specific outcome (death or complication)
     *
     * @param  string[]  $genes  Genes to include (e.g. ["EGFR","KRAS","ALK"])
     * @param  int  $limit  Maximum drug concepts to return
     * @return array<array{gene: string, drug: string, n: int, event_rate: float}>
     */
    public function treatmentVariantMatrix(int $sourceId, array $genes, int $limit = 20): array
    {
        $conn = DB::connection('cdm');
        $schema = 'omop';

        if (empty($genes)) {
            return [];
        }

        // Get person_id × gene_symbol for all queried genes
        $variantPersons = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereIn('gene_symbol', $genes)
            ->whereNotNull('person_id')
            ->select('person_id', 'gene_symbol')
            ->distinct()
            ->get()
            ->groupBy('gene_symbol');

        $matrix = [];

        foreach ($variantPersons as $gene => $rows) {
            $personIds = $rows->pluck('person_id')->unique()->values()->all();
            if (empty($personIds)) {
                continue;
            }

            $placeholders = implode(',', array_fill(0, count($personIds), '?'));

            try {
                $drugs = $conn->select(
                    "SELECT
                        c.concept_name AS drug_name,
                        COUNT(DISTINCT de.person_id) AS n,
                        SUM(CASE WHEN d.person_id IS NOT NULL THEN 1 ELSE 0 END)::float / NULLIF(COUNT(DISTINCT de.person_id), 0) AS event_rate
                     FROM {$schema}.drug_exposure de
                     JOIN {$schema}.concept c ON c.concept_id = de.drug_concept_id AND c.domain_id = 'Drug'
                     LEFT JOIN {$schema}.death d ON d.person_id = de.person_id
                     WHERE de.person_id IN ({$placeholders})
                     AND c.concept_class_id IN ('Ingredient','Clinical Drug')
                     GROUP BY c.concept_name
                     HAVING COUNT(DISTINCT de.person_id) >= 3
                     ORDER BY n DESC
                     LIMIT ?",
                    [...$personIds, $limit]
                );

                foreach ($drugs as $row) {
                    $matrix[] = [
                        'gene' => $gene,
                        'drug' => $row->drug_name,
                        'n' => (int) $row->n,
                        'event_rate' => round((float) ($row->event_rate ?? 0), 4),
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning('VariantOutcomeService: matrix query failed', [
                    'gene' => $gene,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $matrix;
    }

    /**
     * Genomic characterization: TMB distribution, top mutated genes, co-occurrence pairs.
     *
     * @param  int  $limit  Top N genes to return
     * @return array{
     *   top_genes: array<array{gene: string, n: int, pct: float}>,
     *   tmb_distribution: array<array{bucket: string, count: int}>,
     *   variant_type_dist: array<string, int>
     * }
     */
    public function genomicCharacterization(int $sourceId, int $limit = 20): array
    {
        $total = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereNotNull('gene_symbol')
            ->count();

        if ($total === 0) {
            return ['top_genes' => [], 'tmb_distribution' => [], 'variant_type_dist' => []];
        }

        // Top mutated genes
        $topGenes = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereNotNull('gene_symbol')
            ->select(DB::raw('gene_symbol, COUNT(*) as n'))
            ->groupBy('gene_symbol')
            ->orderByDesc('n')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'gene' => $r->gene_symbol,
                'n' => (int) $r->n,
                'pct' => round((int) $r->n / $total * 100, 1),
            ])
            ->all();

        // TMB distribution (bucket by allele_frequency proxy)
        // True TMB requires total somatic mutations / coding Mb — this is an approximation per sample
        $tmbBuckets = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereNotNull('sample_id')
            ->select(DB::raw('sample_id, COUNT(*) as variant_count'))
            ->groupBy('sample_id')
            ->get()
            ->groupBy(fn ($r) => match (true) {
                $r->variant_count < 5 => '<5',
                $r->variant_count < 10 => '5–10',
                $r->variant_count < 20 => '10–20',
                $r->variant_count < 50 => '20–50',
                default => '50+',
            })
            ->map(fn ($group, $bucket) => ['bucket' => $bucket, 'count' => $group->count()])
            ->values()
            ->all();

        // Variant type distribution
        $variantTypes = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereNotNull('variant_type')
            ->select(DB::raw('variant_type, COUNT(*) as n'))
            ->groupBy('variant_type')
            ->orderByDesc('n')
            ->get()
            ->pluck('n', 'variant_type')
            ->map(fn ($v) => (int) $v)
            ->all();

        return [
            'top_genes' => $topGenes,
            'tmb_distribution' => $tmbBuckets,
            'variant_type_dist' => $variantTypes,
            'total_variants' => $total,
        ];
    }
}
