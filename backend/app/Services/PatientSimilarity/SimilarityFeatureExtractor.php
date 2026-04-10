<?php

namespace App\Services\PatientSimilarity;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceMeasurementStat;
use App\Services\PopulationRisk\ConceptResolutionService;
use Illuminate\Support\Facades\DB;

class SimilarityFeatureExtractor
{
    private const int RECENT_WINDOW_DAYS = 365;

    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    /**
     * Extract feature vector data for a batch of person_ids.
     *
     * @param  int[]  $personIds
     * @return array<int, array> person_id → feature data
     */
    public function extractBatch(array $personIds, Source $source): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $connection = $source->source_connection;
        $personIdList = '{'.implode(',', $personIds).'}';

        $patients = $this->extractDemographics($connection, $cdmSchema, $personIdList);
        $this->extractConditions($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractRecentConditions($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractMeasurements($patients, $connection, $cdmSchema, $source->id, $personIdList);
        $this->extractDrugs($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractRecentDrugs($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractProcedures($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractRecentProcedures($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractGenomics($patients, $personIds, $source->id);

        // Set dimensions_available for each patient
        foreach ($patients as $pid => &$p) {
            $dims = ['demographics'];
            if (! empty($p['condition_concepts'])) {
                $dims[] = 'conditions';
            }
            if (! empty($p['lab_vector'])) {
                $dims[] = 'measurements';
            }
            if (! empty($p['drug_concepts'])) {
                $dims[] = 'drugs';
            }
            if (! empty($p['procedure_concepts'])) {
                $dims[] = 'procedures';
            }
            if (! empty($p['variant_genes'])) {
                $dims[] = 'genomics';
            }

            $p['condition_count'] = count($p['condition_concepts']);
            $p['lab_count'] = count($p['lab_vector']);
            $p['variant_count'] = count($p['variant_genes']);
            $p['dimensions_available'] = $dims;
            $p['version'] = 2;
        }
        unset($p);

        return $patients;
    }

    private function extractDemographics(string $connection, string $cdmSchema, string $personIdList): array
    {
        $rows = DB::connection($connection)->select(
            "SELECT p.person_id,
                    EXTRACT(YEAR FROM COALESCE(MAX(op.observation_period_end_date), CURRENT_DATE))::int - p.year_of_birth AS age,
                    p.gender_concept_id,
                    p.race_concept_id,
                    p.ethnicity_concept_id,
                    COALESCE(MAX(op.observation_period_end_date), CURRENT_DATE)::date AS anchor_date
             FROM {$cdmSchema}.person p
             LEFT JOIN {$cdmSchema}.observation_period op
               ON op.person_id = p.person_id
             WHERE p.person_id = ANY(?::bigint[])
             GROUP BY
                p.person_id,
                p.year_of_birth,
                p.gender_concept_id,
                p.race_concept_id,
                p.ethnicity_concept_id",
            [$personIdList]
        );

        $patients = [];
        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $age = (int) $row->age;
            $patients[$pid] = [
                'person_id' => $pid,
                'age_bucket' => intdiv($age, 5),
                'gender_concept_id' => (int) $row->gender_concept_id,
                'race_concept_id' => (int) $row->race_concept_id,
                'anchor_date' => $row->anchor_date,
                'condition_concepts' => [],
                'recent_condition_concepts' => [],
                'lab_vector' => [],
                'drug_concepts' => [],
                'recent_drug_concepts' => [],
                'procedure_concepts' => [],
                'recent_procedure_concepts' => [],
                'variant_genes' => [],
            ];
        }

        return $patients;
    }

    private function extractConditions(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $rows = DB::connection($connection)->select(
            "SELECT co.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.condition_occurrence co
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = co.condition_concept_id
              AND ca.min_levels_of_separation BETWEEN 0 AND 3
             WHERE co.person_id = ANY(?::bigint[])
               AND co.condition_concept_id > 0
             GROUP BY co.person_id, ca.ancestor_concept_id",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['condition_concepts'][$conceptId])
                    || $patients[$pid]['condition_concepts'][$conceptId] > $level) {
                    $patients[$pid]['condition_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractRecentConditions(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $anchorSubquery = $this->anchorDateSubquery($cdmSchema);

        $rows = DB::connection($connection)->select(
            "SELECT co.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.condition_occurrence co
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = co.condition_concept_id
              AND ca.min_levels_of_separation BETWEEN 0 AND 3
             JOIN ({$anchorSubquery}) anchor
               ON anchor.person_id = co.person_id
             WHERE co.person_id = ANY(?::bigint[])
               AND co.condition_concept_id > 0
               AND co.condition_start_date IS NOT NULL
               AND co.condition_start_date BETWEEN anchor.anchor_date - INTERVAL '".self::RECENT_WINDOW_DAYS." days' AND anchor.anchor_date
             GROUP BY co.person_id, ca.ancestor_concept_id",
            [$personIdList, $personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['recent_condition_concepts'][$conceptId])
                    || $patients[$pid]['recent_condition_concepts'][$conceptId] > $level) {
                    $patients[$pid]['recent_condition_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractMeasurements(array &$patients, string $connection, string $cdmSchema, int $sourceId, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $stats = SourceMeasurementStat::where('source_id', $sourceId)
            ->get()
            ->keyBy('measurement_concept_id');

        if ($stats->isEmpty()) {
            return;
        }

        $measurementIds = $stats->keys()->toArray();
        $measurementIdList = '{'.implode(',', $measurementIds).'}';

        $rows = DB::connection($connection)->select(
            "SELECT DISTINCT ON (m.person_id, m.measurement_concept_id)
                    m.person_id,
                    m.measurement_concept_id,
                    m.value_as_number
             FROM {$cdmSchema}.measurement m
             WHERE m.person_id = ANY(?::bigint[])
               AND m.measurement_concept_id = ANY(?::int[])
               AND m.value_as_number IS NOT NULL
             ORDER BY m.person_id, m.measurement_concept_id, m.measurement_date DESC",
            [$personIdList, $measurementIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->measurement_concept_id;
            $stat = $stats->get($conceptId);

            if (isset($patients[$pid]) && $stat && $stat->stddev > 0) {
                $zScore = ((float) $row->value_as_number - $stat->mean) / $stat->stddev;
                $patients[$pid]['lab_vector'][$conceptId] = round($zScore, 4);
            }
        }
    }

    private function extractDrugs(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $rows = DB::connection($connection)->select(
            "SELECT de.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.drug_exposure de
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = de.drug_concept_id
             JOIN {$vocabSchema}.concept c
               ON c.concept_id = ca.ancestor_concept_id
              AND c.concept_class_id = 'Ingredient'
             WHERE de.person_id = ANY(?::bigint[])
               AND de.drug_concept_id > 0
             GROUP BY de.person_id, ca.ancestor_concept_id",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['drug_concepts'][$conceptId])
                    || $patients[$pid]['drug_concepts'][$conceptId] > $level) {
                    $patients[$pid]['drug_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractRecentDrugs(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $anchorSubquery = $this->anchorDateSubquery($cdmSchema);

        $rows = DB::connection($connection)->select(
            "SELECT de.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.drug_exposure de
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = de.drug_concept_id
             JOIN {$vocabSchema}.concept c
               ON c.concept_id = ca.ancestor_concept_id
              AND c.concept_class_id = 'Ingredient'
             JOIN ({$anchorSubquery}) anchor
               ON anchor.person_id = de.person_id
             WHERE de.person_id = ANY(?::bigint[])
               AND de.drug_concept_id > 0
               AND de.drug_exposure_start_date IS NOT NULL
               AND de.drug_exposure_start_date BETWEEN anchor.anchor_date - INTERVAL '".self::RECENT_WINDOW_DAYS." days' AND anchor.anchor_date
             GROUP BY de.person_id, ca.ancestor_concept_id",
            [$personIdList, $personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['recent_drug_concepts'][$conceptId])
                    || $patients[$pid]['recent_drug_concepts'][$conceptId] > $level) {
                    $patients[$pid]['recent_drug_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractProcedures(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $rows = DB::connection($connection)->select(
            "SELECT po.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.procedure_occurrence po
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = po.procedure_concept_id
              AND ca.min_levels_of_separation BETWEEN 0 AND 3
             WHERE po.person_id = ANY(?::bigint[])
               AND po.procedure_concept_id > 0
             GROUP BY po.person_id, ca.ancestor_concept_id",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['procedure_concepts'][$conceptId])
                    || $patients[$pid]['procedure_concepts'][$conceptId] > $level) {
                    $patients[$pid]['procedure_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractRecentProcedures(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $anchorSubquery = $this->anchorDateSubquery($cdmSchema);

        $rows = DB::connection($connection)->select(
            "SELECT po.person_id, ca.ancestor_concept_id, MIN(ca.min_levels_of_separation) AS min_level
             FROM {$cdmSchema}.procedure_occurrence po
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = po.procedure_concept_id
              AND ca.min_levels_of_separation BETWEEN 0 AND 3
             JOIN ({$anchorSubquery}) anchor
               ON anchor.person_id = po.person_id
             WHERE po.person_id = ANY(?::bigint[])
               AND po.procedure_concept_id > 0
               AND po.procedure_date IS NOT NULL
               AND po.procedure_date BETWEEN anchor.anchor_date - INTERVAL '".self::RECENT_WINDOW_DAYS." days' AND anchor.anchor_date
             GROUP BY po.person_id, ca.ancestor_concept_id",
            [$personIdList, $personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->ancestor_concept_id;
            $level = (int) $row->min_level;
            if (isset($patients[$pid])) {
                if (! isset($patients[$pid]['recent_procedure_concepts'][$conceptId])
                    || $patients[$pid]['recent_procedure_concepts'][$conceptId] > $level) {
                    $patients[$pid]['recent_procedure_concepts'][$conceptId] = $level;
                }
            }
        }
    }

    private function extractGenomics(array &$patients, array $personIds, int $sourceId): void
    {
        $rows = DB::connection('pgsql')->select(
            'SELECT gv.person_id, gv.gene_symbol, gv.clinvar_significance
             FROM genomic_variants gv
             WHERE gv.person_id = ANY(?::bigint[])
               AND gv.source_id = ?
               AND gv.clinvar_significance IS NOT NULL',
            ['{'.implode(',', $personIds).'}', $sourceId]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            if (isset($patients[$pid])) {
                $patients[$pid]['variant_genes'][] = [
                    'gene' => $row->gene_symbol,
                    'pathogenicity' => $row->clinvar_significance,
                ];
            }
        }
    }

    private function anchorDateSubquery(string $cdmSchema): string
    {
        return "SELECT p.person_id,
                       COALESCE(MAX(op.observation_period_end_date), CURRENT_DATE)::date AS anchor_date
                FROM {$cdmSchema}.person p
                LEFT JOIN {$cdmSchema}.observation_period op
                  ON op.person_id = p.person_id
                WHERE p.person_id = ANY(?::bigint[])
                GROUP BY p.person_id";
    }

    /**
     * Compute and store population-level measurement statistics for z-score normalization.
     */
    public function computeMeasurementStats(Source $source): int
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $connection = $source->source_connection;

        $rows = DB::connection($connection)->select(
            "SELECT m.measurement_concept_id,
                    AVG(m.value_as_number) AS mean,
                    STDDEV(m.value_as_number) AS stddev,
                    COUNT(DISTINCT m.person_id) AS n_patients,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY m.value_as_number) AS p25,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY m.value_as_number) AS p75
             FROM {$cdmSchema}.measurement m
             WHERE m.value_as_number IS NOT NULL
               AND m.measurement_concept_id > 0
             GROUP BY m.measurement_concept_id
             HAVING COUNT(DISTINCT m.person_id) >= 10
                AND STDDEV(m.value_as_number) > 0
             ORDER BY COUNT(DISTINCT m.person_id) DESC
             LIMIT 50"
        );

        foreach ($rows as $row) {
            SourceMeasurementStat::updateOrCreate(
                [
                    'source_id' => $source->id,
                    'measurement_concept_id' => (int) $row->measurement_concept_id,
                ],
                [
                    'mean' => (float) $row->mean,
                    'stddev' => (float) $row->stddev,
                    'n_patients' => (int) $row->n_patients,
                    'percentile_25' => $row->p25 !== null ? (float) $row->p25 : null,
                    'percentile_75' => $row->p75 !== null ? (float) $row->p75 : null,
                    'computed_at' => now(),
                ]
            );
        }

        return count($rows);
    }
}
