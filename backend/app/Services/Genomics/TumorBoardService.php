<?php

namespace App\Services\Genomics;

use App\Models\App\GenomicVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Molecular Tumor Board Service
 *
 * Given a patient's molecular profile (variants from genomic_variants),
 * assembles a structured evidence panel for tumor board discussion:
 *
 * 1. Patient's variants (gene, HGVS, ClinVar, pathogenicity)
 * 2. Population outcomes for similar patients (from OMOP + genomic_variants)
 * 3. Drug exposure patterns in molecularly similar patients
 * 4. Clinical trial eligibility signals (based on mutation/drug matching)
 */
class TumorBoardService
{
    /**
     * Build a full tumor board evidence panel for a patient.
     *
     * @param  int  $personId  OMOP person_id
     * @param  int  $sourceId  Parthenon source ID
     * @return array The structured panel
     */
    public function buildPanel(int $personId, int $sourceId): array
    {
        $conn = DB::connection('omop');
        $schema = 'omop';

        // 1. Patient's variants
        $variants = GenomicVariant::where('person_id', $personId)
            ->where('source_id', $sourceId)
            ->orderBy('clinvar_significance')
            ->orderBy('gene_symbol')
            ->get()
            ->map(fn ($v) => [
                'id' => $v->id,
                'gene' => $v->gene_symbol,
                'hgvs_p' => $v->hgvs_p,
                'hgvs_c' => $v->hgvs_c,
                'variant_type' => $v->variant_type,
                'variant_class' => $v->variant_class,
                'clinvar_significance' => $v->clinvar_significance,
                'clinvar_id' => $v->clinvar_id,
                'cosmic_id' => $v->cosmic_id,
                'allele_frequency' => $v->allele_frequency,
                'zygosity' => $v->zygosity,
                'chromosome' => $v->chromosome,
                'position' => $v->position,
            ])
            ->values()
            ->all();

        if (empty($variants)) {
            return [
                'person_id' => $personId,
                'variants' => [],
                'demographics' => null,
                'similar_patients' => [],
                'drug_patterns' => [],
                'evidence_summary' => 'No genomic data available for this patient.',
            ];
        }

        // 2. Patient demographics from OMOP
        $demographics = $this->getPatientDemographics($conn, $schema, $personId);

        // 3. Molecularly similar patients (share ≥1 pathogenic/likely pathogenic variant)
        $actionableGenes = collect($variants)
            ->filter(fn ($v) => $v['clinvar_significance'] && str_contains(strtolower($v['clinvar_significance']), 'pathogenic'))
            ->pluck('gene')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $similarPatients = $this->getSimilarPatientOutcomes($conn, $schema, $sourceId, $actionableGenes, $personId);

        // 4. Drug exposure patterns in similar patients
        $drugPatterns = $this->getDrugPatternsForGenes($conn, $schema, $sourceId, $actionableGenes, $personId);

        // 5. Evidence summary
        $actionableCount = count($actionableGenes);
        $summary = $this->buildEvidenceSummary($variants, $actionableGenes, $similarPatients);

        return [
            'person_id' => $personId,
            'source_id' => $sourceId,
            'variants' => $variants,
            'demographics' => $demographics,
            'actionable_genes' => $actionableGenes,
            'similar_patients' => $similarPatients,
            'drug_patterns' => $drugPatterns,
            'evidence_summary' => $summary,
        ];
    }

    /** @return array<string, mixed>|null */
    private function getPatientDemographics(\Illuminate\Database\Connection $conn, string $schema, int $personId): ?array
    {
        try {
            $row = $conn->selectOne(
                "SELECT
                    p.year_of_birth,
                    DATE_PART('year', CURRENT_DATE) - p.year_of_birth AS age,
                    c_gender.concept_name AS gender,
                    c_race.concept_name AS race,
                    c_eth.concept_name AS ethnicity
                 FROM {$schema}.person p
                 LEFT JOIN {$schema}.concept c_gender ON c_gender.concept_id = p.gender_concept_id
                 LEFT JOIN {$schema}.concept c_race ON c_race.concept_id = p.race_concept_id
                 LEFT JOIN {$schema}.concept c_eth ON c_eth.concept_id = p.ethnicity_concept_id
                 WHERE p.person_id = ?",
                [$personId]
            );

            return $row ? (array) $row : null;
        } catch (\Throwable $e) {
            Log::warning('TumorBoardService: demographics query failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @param  string[]  $actionableGenes
     * @return array<array{gene: string, n_similar: int, median_survival_days: int|null, event_rate: float}>
     */
    private function getSimilarPatientOutcomes(
        \Illuminate\Database\Connection $conn,
        string $schema,
        int $sourceId,
        array $actionableGenes,
        int $excludePersonId
    ): array {
        if (empty($actionableGenes)) {
            return [];
        }

        $results = [];

        foreach ($actionableGenes as $gene) {
            $similarIds = DB::table('genomic_variants')
                ->where('source_id', $sourceId)
                ->where('gene_symbol', $gene)
                ->whereNotNull('person_id')
                ->where('person_id', '!=', $excludePersonId)
                ->where(function ($q) {
                    $q->where('clinvar_significance', 'ilike', '%pathogenic%');
                })
                ->distinct()
                ->pluck('person_id')
                ->take(500)
                ->all();

            if (empty($similarIds)) {
                continue;
            }

            $placeholders = implode(',', array_fill(0, count($similarIds), '?'));

            try {
                $outcome = $conn->selectOne(
                    "SELECT
                        COUNT(DISTINCT op.person_id) AS n_similar,
                        PERCENTILE_CONT(0.5) WITHIN GROUP (
                            ORDER BY EXTRACT(DAY FROM (COALESCE(d.death_date, op.observation_period_end_date) - op.observation_period_start_date))
                        ) AS median_survival_days,
                        SUM(CASE WHEN d.person_id IS NOT NULL THEN 1 ELSE 0 END)::float / NULLIF(COUNT(DISTINCT op.person_id), 0) AS event_rate
                     FROM {$schema}.observation_period op
                     LEFT JOIN {$schema}.death d ON d.person_id = op.person_id
                     WHERE op.person_id IN ({$placeholders})",
                    $similarIds
                );

                $results[] = [
                    'gene' => $gene,
                    'n_similar' => (int) ($outcome->n_similar ?? 0),
                    'median_survival_days' => $outcome->median_survival_days !== null ? (int) $outcome->median_survival_days : null,
                    'event_rate' => round((float) ($outcome->event_rate ?? 0), 4),
                ];
            } catch (\Throwable $e) {
                Log::warning('TumorBoardService: similar patient query failed', ['gene' => $gene, 'error' => $e->getMessage()]);
            }
        }

        return $results;
    }

    /**
     * @param  string[]  $actionableGenes
     * @return array<array{gene: string, drug: string, n: int, pct: float}>
     */
    private function getDrugPatternsForGenes(
        \Illuminate\Database\Connection $conn,
        string $schema,
        int $sourceId,
        array $actionableGenes,
        int $excludePersonId
    ): array {
        if (empty($actionableGenes)) {
            return [];
        }

        $similarIds = DB::table('genomic_variants')
            ->where('source_id', $sourceId)
            ->whereIn('gene_symbol', $actionableGenes)
            ->whereNotNull('person_id')
            ->where('person_id', '!=', $excludePersonId)
            ->distinct()
            ->pluck('person_id')
            ->take(500)
            ->all();

        if (empty($similarIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($similarIds), '?'));

        try {
            $rows = $conn->select(
                "SELECT
                    c.concept_name AS drug_name,
                    COUNT(DISTINCT de.person_id) AS n
                 FROM {$schema}.drug_exposure de
                 JOIN {$schema}.concept c ON c.concept_id = de.drug_concept_id
                    AND c.domain_id = 'Drug'
                    AND c.concept_class_id IN ('Ingredient','Clinical Drug')
                 WHERE de.person_id IN ({$placeholders})
                 GROUP BY c.concept_name
                 HAVING COUNT(DISTINCT de.person_id) >= 2
                 ORDER BY n DESC
                 LIMIT 15",
                $similarIds
            );

            $totalSimilar = count($similarIds);

            return array_map(fn ($r) => [
                'drug' => $r->drug_name,
                'n' => (int) $r->n,
                'pct' => round((int) $r->n / $totalSimilar * 100, 1),
            ], $rows);
        } catch (\Throwable $e) {
            Log::warning('TumorBoardService: drug patterns query failed', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /** @param array<array<string,mixed>> $variants @param string[] $actionableGenes @param array<array<string,mixed>> $similar */
    private function buildEvidenceSummary(array $variants, array $actionableGenes, array $similar): string
    {
        $total = count($variants);
        $actionable = count($actionableGenes);
        $pathogenic = array_filter($variants, fn ($v) => $v['clinvar_significance'] && str_contains(strtolower($v['clinvar_significance']), 'pathogenic'));
        $vus = array_filter($variants, fn ($v) => $v['clinvar_significance'] && str_contains(strtolower($v['clinvar_significance']), 'uncertain'));

        $parts = ["{$total} variants identified"];
        if ($actionable > 0) {
            $geneList = implode(', ', $actionableGenes);
            $parts[] = "{$actionable} actionable (Pathogenic/LP) in {$geneList}";
        }
        if (count($vus) > 0) {
            $parts[] = count($vus).' VUS requiring monitoring';
        }
        if (! empty($similar)) {
            $totalSimilar = array_sum(array_column($similar, 'n_similar'));
            $parts[] = "{$totalSimilar} molecularly similar patients in database";
        }

        return implode('. ', $parts).'.';
    }
}
