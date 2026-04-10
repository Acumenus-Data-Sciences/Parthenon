<?php

namespace App\Services\Morpheus;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class MorpheusDashboardService
{
    /**
     * Connection name resolved at boot from config('morpheus.connection').
     * Defaults to 'inpatient' in production; phpunit.xml overrides to
     * 'inpatient_testing' so tests target parthenon_testing, not parthenon.
     * See docs/superpowers/specs for the Morpheus isolation rationale.
     */
    private readonly string $conn;

    private const CACHE_TTL = 600; // 10 minutes

    public function __construct(
        private readonly SchemaIntrospector $introspector,
    ) {
        $this->conn = (string) config('morpheus.connection', 'inpatient');
    }

    /**
     * Validate schema name format (alphanumeric + underscore only).
     */
    private function getSchemaName(string $schema): string
    {
        if (! preg_match('/^[a-z_][a-z0-9_]*$/', $schema)) {
            throw new \InvalidArgumentException('Invalid schema name');
        }

        return $schema;
    }

    /**
     * Check if a materialized view exists for this schema+view.
     * If so, query it directly (instant). Otherwise fall back to live query.
     */
    private function hasMaterializedView(string $schema, string $viewName): bool
    {
        return Cache::remember("morpheus_mv_exists:{$schema}:{$viewName}", self::CACHE_TTL, function () use ($schema, $viewName) {
            $result = DB::connection($this->conn)->selectOne(
                'SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = ? AND matviewname = ?) as exists',
                [$schema, $viewName]
            );

            return (bool) ($result->exists ?? false);
        });
    }

    /**
     * Wrap a query with caching. Cache key includes schema for multi-dataset isolation.
     */
    private function cached(string $key, string $schema, callable $query): mixed
    {
        return Cache::remember("morpheus:{$schema}:{$key}", self::CACHE_TTL, $query);
    }

    /**
     * Cast numeric string fields to float for proper JSON serialization.
     * PostgreSQL ROUND() returns numeric which PDO serializes as string.
     */
    private function castNumericFields(object|array $data, array $fields): object|array
    {
        if (is_array($data)) {
            return array_map(fn ($row) => $this->castNumericFields($row, $fields), $data);
        }
        foreach ($fields as $field) {
            if (isset($data->$field) && is_string($data->$field)) {
                $data->$field = (float) $data->$field;
            }
        }

        return $data;
    }

    public function getMetrics(string $schema = 'mimiciv'): object
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('metrics', $s, function () use ($s) {
            // Use materialized view if available
            if ($this->hasMaterializedView($s, 'mv_dashboard_metrics')) {
                $result = DB::connection($this->conn)->selectOne("SELECT * FROM {$s}.mv_dashboard_metrics");

                return $this->castNumericFields($result, [
                    'total_patients', 'total_admissions', 'icu_admission_rate',
                    'mortality_rate', 'avg_los_days', 'avg_icu_los_days',
                ]);
            }

            $result = DB::connection($this->conn)->selectOne("
            SELECT
                (SELECT count(DISTINCT subject_id) FROM {$s}.patients) as total_patients,
                (SELECT count(*) FROM {$s}.admissions) as total_admissions,
                ROUND((SELECT count(DISTINCT subject_id) FROM {$s}.icustays)::numeric
                    / NULLIF((SELECT count(DISTINCT subject_id) FROM {$s}.patients), 0) * 100, 1) as icu_admission_rate,
                ROUND((SELECT count(*) FROM {$s}.admissions WHERE hospital_expire_flag = '1')::numeric
                    / NULLIF((SELECT count(*) FROM {$s}.admissions), 0) * 100, 1) as mortality_rate,
                ROUND((SELECT avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)
                    FROM {$s}.admissions)::numeric, 1) as avg_los_days,
                ROUND((SELECT avg(los::numeric) FROM {$s}.icustays)::numeric, 1) as avg_icu_los_days
        ");

            return $this->castNumericFields($result, [
                'total_patients', 'total_admissions', 'icu_admission_rate',
                'mortality_rate', 'avg_los_days', 'avg_icu_los_days',
            ]);
        }); // end cached
    }

    public function getTrends(string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('trends', $s, function () use ($s) {
            if ($this->hasMaterializedView($s, 'mv_dashboard_trends')) {
                $rows = DB::connection($this->conn)->select("SELECT * FROM {$s}.mv_dashboard_trends ORDER BY month");

                return $this->castNumericFields($rows, ['admissions', 'deaths', 'mortality_rate', 'avg_los']);
            }

            $rows = DB::connection($this->conn)->select("
            SELECT to_char(admittime::timestamp, 'YYYY-MM') as month,
                   count(*) as admissions,
                   count(*) FILTER (WHERE hospital_expire_flag = '1') as deaths,
                   ROUND(count(*) FILTER (WHERE hospital_expire_flag = '1')::numeric
                       / NULLIF(count(*), 0) * 100, 1) as mortality_rate,
                   ROUND(avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)::numeric, 1) as avg_los
            FROM {$s}.admissions
            GROUP BY month
            ORDER BY month
        ");

            return $this->castNumericFields($rows, ['admissions', 'deaths', 'mortality_rate', 'avg_los']);
        }); // end cached
    }

    public function getTopDiagnoses(int $limit = 10, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached("top-diagnoses-{$limit}", $s, function () use ($s, $limit) {
            return DB::connection($this->conn)->select("
                SELECT d.icd_code, d.icd_version, COALESCE(dd.long_title, '') as description,
                       count(DISTINCT d.subject_id)::int as patient_count
                FROM {$s}.diagnoses_icd d
                LEFT JOIN {$s}.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
                GROUP BY d.icd_code, d.icd_version, dd.long_title
                ORDER BY patient_count DESC
                LIMIT ?
            ", [$limit]);
        }); // end cached
    }

    public function getTopProcedures(int $limit = 10, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached("top-procedures-{$limit}", $s, function () use ($s, $limit) {
            return DB::connection($this->conn)->select("
                SELECT p.icd_code, p.icd_version, COALESCE(dp.long_title, '') as description,
                       count(DISTINCT p.subject_id)::int as patient_count
                FROM {$s}.procedures_icd p
                LEFT JOIN {$s}.d_icd_procedures dp ON p.icd_code = dp.icd_code AND p.icd_version = dp.icd_version
                GROUP BY p.icd_code, p.icd_version, dp.long_title
                ORDER BY patient_count DESC
                LIMIT ?
            ", [$limit]);
        }); // end cached
    }

    public function getDemographics(string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('demographics', $s, function () use ($s) {
            if ($this->hasMaterializedView($s, 'mv_dashboard_demographics')) {
                $rows = DB::connection($this->conn)->select("SELECT * FROM {$s}.mv_dashboard_demographics");
                $gender = [];
                $ageGroups = [];
                foreach ($rows as $row) {
                    if ($row->category === 'gender') {
                        $gender[$row->label] = (int) $row->count;
                    } else {
                        $ageGroups[] = (object) ['range' => $row->label, 'count' => (int) $row->count];
                    }
                }

                return ['gender' => $gender, 'age_groups' => $ageGroups];
            }

            // Gender counts
            $genderRows = DB::connection($this->conn)->select("
                SELECT gender, count(*)::int as count FROM {$s}.patients GROUP BY gender
            ");
            $gender = [];
            foreach ($genderRows as $row) {
                $gender[$row->gender] = $row->count;
            }

            // Age groups — adapt to available columns. Use the sanitized
            // schema name ($s), because $schema is not captured in this
            // closure's `use` clause.
            $ageBucket = $this->introspector->ageBucketExpression($s);
            $ageGroups = DB::connection($this->conn)->select("
                SELECT {$ageBucket} as range, count(*)::int as count
                FROM {$s}.patients p GROUP BY range ORDER BY range
            ");

            return ['gender' => $gender, 'age_groups' => $ageGroups];
        }); // end cached
    }

    public function getLosDistribution(string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('los-distribution', $s, function () use ($s) {
            if ($this->hasMaterializedView($s, 'mv_dashboard_los')) {
                return DB::connection($this->conn)->select("SELECT * FROM {$s}.mv_dashboard_los");
            }

            return DB::connection($this->conn)->select("
                WITH bucketed AS (
                    SELECT CASE
                        WHEN los <= 2 THEN '0-2d'
                        WHEN los <= 5 THEN '3-5d'
                        WHEN los <= 10 THEN '6-10d'
                        WHEN los <= 20 THEN '11-20d'
                        ELSE '20d+' END as bucket,
                        CASE
                        WHEN los <= 2 THEN 1
                        WHEN los <= 5 THEN 2
                        WHEN los <= 10 THEN 3
                        WHEN los <= 20 THEN 4
                        ELSE 5 END as sort_order
                    FROM (
                        SELECT EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0 as los
                        FROM {$s}.admissions
                    ) sub
                )
                SELECT bucket, count(*)::int as count
                FROM bucketed
                GROUP BY bucket, sort_order
                ORDER BY sort_order
            ");
        }); // end cached
    }

    public function getIcuUnits(string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('icu-units', $s, function () use ($s) {
            $rows = DB::connection($this->conn)->select("
                SELECT first_careunit as careunit,
                       count(*)::int as admission_count,
                       ROUND(avg(los::numeric)::numeric, 1) as avg_los_days
                FROM {$s}.icustays
                GROUP BY first_careunit
                ORDER BY admission_count DESC
            ");

            return $this->castNumericFields($rows, ['admission_count', 'avg_los_days']);
        }); // end cached
    }

    public function getMortalityByType(string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached('mortality-by-type', $s, function () use ($s) {
            if ($this->hasMaterializedView($s, 'mv_dashboard_mortality_by_type')) {
                $rows = DB::connection($this->conn)->select("SELECT * FROM {$s}.mv_dashboard_mortality_by_type");

                return $this->castNumericFields($rows, ['total', 'deaths', 'rate']);
            }

            $rows = DB::connection($this->conn)->select("
                SELECT admission_type,
                       count(*)::int as total,
                       count(*) FILTER (WHERE hospital_expire_flag = '1')::int as deaths,
                       ROUND(count(*) FILTER (WHERE hospital_expire_flag = '1')::numeric
                           / NULLIF(count(*), 0) * 100, 1) as rate
                FROM {$s}.admissions
                GROUP BY admission_type
                ORDER BY total DESC
            ");

            return $this->castNumericFields($rows, ['total', 'deaths', 'rate']);
        }); // end cached
    }

    /**
     * Get population-level statistics for a single concept within a dataset.
     * Returns patient count, percentage, and mean/median for measurement concepts.
     */
    public function getConceptStats(string $schema, int $conceptId): ?array
    {
        $s = $this->getSchemaName($schema);

        return $this->cached("concept_stats:{$conceptId}", $schema, function () use ($s, $conceptId) {
            // Check diagnoses_icd (ICD codes map to concept_id via omop.concept)
            $diagStats = DB::connection($this->conn)->selectOne("
                SELECT
                    COUNT(DISTINCT d.subject_id) as patient_count,
                    (SELECT COUNT(DISTINCT subject_id) FROM \"{$s}\".admissions) as total_patients
                FROM \"{$s}\".diagnoses_icd d
                JOIN omop.concept c ON c.concept_code = d.icd_code
                    AND c.vocabulary_id = CASE WHEN d.icd_version = 9 THEN 'ICD9CM' ELSE 'ICD10CM' END
                WHERE c.concept_id = ?
            ", [$conceptId]);

            if ($diagStats && $diagStats->patient_count > 0) {
                $total = (int) $diagStats->total_patients;
                $count = (int) $diagStats->patient_count;

                return [
                    'concept_id' => $conceptId,
                    'patient_count' => $count,
                    'total_patients' => $total,
                    'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
                    'mean_value' => null,
                    'median_value' => null,
                ];
            }

            // Check labevents (measurement concept via d_labitems)
            $labStats = DB::connection($this->conn)->selectOne("
                SELECT
                    COUNT(DISTINCT le.subject_id) as patient_count,
                    (SELECT COUNT(DISTINCT subject_id) FROM \"{$s}\".admissions) as total_patients,
                    ROUND(AVG(le.valuenum)::numeric, 2) as mean_value,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY le.valuenum)::numeric, 2) as median_value
                FROM \"{$s}\".labevents le
                WHERE le.itemid = ? AND le.valuenum IS NOT NULL
            ", [$conceptId]);

            if ($labStats && $labStats->patient_count > 0) {
                $total = (int) $labStats->total_patients;
                $count = (int) $labStats->patient_count;

                return [
                    'concept_id' => $conceptId,
                    'patient_count' => $count,
                    'total_patients' => $total,
                    'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
                    'mean_value' => $labStats->mean_value !== null ? (float) $labStats->mean_value : null,
                    'median_value' => $labStats->median_value !== null ? (float) $labStats->median_value : null,
                ];
            }

            return null;
        });
    }
}
