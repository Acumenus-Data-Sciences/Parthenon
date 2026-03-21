<?php

namespace App\Services\Morpheus;

use Illuminate\Support\Facades\DB;

class MorpheusDashboardService
{
    private string $conn = 'inpatient';

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

    public function getMetrics(): object
    {
        $result = DB::connection($this->conn)->selectOne("
            SELECT
                (SELECT count(DISTINCT subject_id) FROM mimiciv.patients) as total_patients,
                (SELECT count(*) FROM mimiciv.admissions) as total_admissions,
                ROUND((SELECT count(DISTINCT subject_id) FROM mimiciv.icustays)::numeric
                    / NULLIF((SELECT count(DISTINCT subject_id) FROM mimiciv.patients), 0) * 100, 1) as icu_admission_rate,
                ROUND((SELECT count(*) FROM mimiciv.admissions WHERE hospital_expire_flag = '1')::numeric
                    / NULLIF((SELECT count(*) FROM mimiciv.admissions), 0) * 100, 1) as mortality_rate,
                ROUND((SELECT avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)
                    FROM mimiciv.admissions)::numeric, 1) as avg_los_days,
                ROUND((SELECT avg(los::numeric) FROM mimiciv.icustays)::numeric, 1) as avg_icu_los_days
        ");

        return $this->castNumericFields($result, [
            'total_patients', 'total_admissions', 'icu_admission_rate',
            'mortality_rate', 'avg_los_days', 'avg_icu_los_days',
        ]);
    }

    public function getTrends(): array
    {
        $rows = DB::connection($this->conn)->select("
            SELECT to_char(admittime::timestamp, 'YYYY-MM') as month,
                   count(*) as admissions,
                   count(*) FILTER (WHERE hospital_expire_flag = '1') as deaths,
                   ROUND(count(*) FILTER (WHERE hospital_expire_flag = '1')::numeric
                       / NULLIF(count(*), 0) * 100, 1) as mortality_rate,
                   ROUND(avg(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)::numeric, 1) as avg_los
            FROM mimiciv.admissions
            GROUP BY month
            ORDER BY month
        ");

        return $this->castNumericFields($rows, ['admissions', 'deaths', 'mortality_rate', 'avg_los']);
    }

    public function getTopDiagnoses(int $limit = 10): array
    {
        return DB::connection($this->conn)->select("
            SELECT d.icd_code, d.icd_version, COALESCE(dd.long_title, '') as description,
                   count(DISTINCT d.subject_id)::int as patient_count
            FROM mimiciv.diagnoses_icd d
            LEFT JOIN mimiciv.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
            GROUP BY d.icd_code, d.icd_version, dd.long_title
            ORDER BY patient_count DESC
            LIMIT ?
        ", [$limit]);
    }

    public function getTopProcedures(int $limit = 10): array
    {
        return DB::connection($this->conn)->select("
            SELECT p.icd_code, p.icd_version, COALESCE(dp.long_title, '') as description,
                   count(DISTINCT p.subject_id)::int as patient_count
            FROM mimiciv.procedures_icd p
            LEFT JOIN mimiciv.d_icd_procedures dp ON p.icd_code = dp.icd_code AND p.icd_version = dp.icd_version
            GROUP BY p.icd_code, p.icd_version, dp.long_title
            ORDER BY patient_count DESC
            LIMIT ?
        ", [$limit]);
    }

    public function getDemographics(): array
    {
        // Gender counts
        $genderRows = DB::connection($this->conn)->select("
            SELECT gender, count(*)::int as count FROM mimiciv.patients GROUP BY gender
        ");
        $gender = [];
        foreach ($genderRows as $row) {
            $gender[$row->gender] = $row->count;
        }

        // Age groups
        $ageGroups = DB::connection($this->conn)->select("
            SELECT CASE
                WHEN anchor_age::int < 20 THEN '<20'
                WHEN anchor_age::int BETWEEN 20 AND 29 THEN '20-29'
                WHEN anchor_age::int BETWEEN 30 AND 39 THEN '30-39'
                WHEN anchor_age::int BETWEEN 40 AND 49 THEN '40-49'
                WHEN anchor_age::int BETWEEN 50 AND 59 THEN '50-59'
                WHEN anchor_age::int BETWEEN 60 AND 69 THEN '60-69'
                WHEN anchor_age::int BETWEEN 70 AND 79 THEN '70-79'
                WHEN anchor_age::int BETWEEN 80 AND 89 THEN '80-89'
                ELSE '90+' END as range,
                count(*)::int as count
            FROM mimiciv.patients GROUP BY range ORDER BY range
        ");

        return ['gender' => $gender, 'age_groups' => $ageGroups];
    }

    public function getLosDistribution(): array
    {
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
                    FROM mimiciv.admissions
                ) sub
            )
            SELECT bucket, count(*)::int as count
            FROM bucketed
            GROUP BY bucket, sort_order
            ORDER BY sort_order
        ");
    }

    public function getIcuUnits(): array
    {
        $rows = DB::connection($this->conn)->select("
            SELECT first_careunit as careunit,
                   count(*)::int as admission_count,
                   ROUND(avg(los::numeric)::numeric, 1) as avg_los_days
            FROM mimiciv.icustays
            GROUP BY first_careunit
            ORDER BY admission_count DESC
        ");

        return $this->castNumericFields($rows, ['admission_count', 'avg_los_days']);
    }

    public function getMortalityByType(): array
    {
        $rows = DB::connection($this->conn)->select("
            SELECT admission_type,
                   count(*)::int as total,
                   count(*) FILTER (WHERE hospital_expire_flag = '1')::int as deaths,
                   ROUND(count(*) FILTER (WHERE hospital_expire_flag = '1')::numeric
                       / NULLIF(count(*), 0) * 100, 1) as rate
            FROM mimiciv.admissions
            GROUP BY admission_type
            ORDER BY total DESC
        ");

        return $this->castNumericFields($rows, ['total', 'deaths', 'rate']);
    }
}
