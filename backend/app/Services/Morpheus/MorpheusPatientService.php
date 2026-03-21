<?php

namespace App\Services\Morpheus;

use Illuminate\Support\Facades\DB;

class MorpheusPatientService
{
    private string $conn = 'inpatient';

    public function __construct(
        private readonly SchemaIntrospector $introspector,
    ) {}

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
     * Search patients by subject_id prefix.
     */
    public function searchPatients(string $query, int $limit = 20, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $selectCols = $this->introspector->patientSelectColumns($schema);
        $groupByCols = $this->introspector->patientGroupByColumns($schema);

        return DB::connection($this->conn)->select("
            SELECT {$selectCols},
                   count(DISTINCT a.hadm_id) as admission_count
            FROM {$s}.patients p
            LEFT JOIN {$s}.admissions a ON p.subject_id = a.subject_id
            WHERE p.subject_id::text LIKE ?
            GROUP BY {$groupByCols}
            ORDER BY p.subject_id::bigint
            LIMIT ?
        ", [$query.'%', $limit]);
    }

    /**
     * List all patients with summary stats, supporting filters and sorting.
     */
    public function listPatients(int $limit = 100, int $offset = 0, array $filters = [], string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $selectCols = $this->introspector->patientSelectColumns($schema);
        $groupByCols = $this->introspector->patientGroupByColumns($schema);
        $hasDiagDict = $this->introspector->hasTable($schema, 'd_icd_diagnoses');
        $hasIcuStays = $this->introspector->hasTable($schema, 'icustays');

        $params = [];
        $conditions = [];

        if (isset($filters['icu'])) {
            if (! $hasIcuStays) {
                // No ICU data — filter has no effect
            } elseif ($filters['icu'] === true || $filters['icu'] === 'true') {
                $conditions[] = 'pi.icu_stay_count > 0';
            } else {
                $conditions[] = '(pi.icu_stay_count IS NULL OR pi.icu_stay_count = 0)';
            }
        }

        if (isset($filters['deceased'])) {
            if ($filters['deceased'] === true || $filters['deceased'] === 'true') {
                $conditions[] = 'pb.dod IS NOT NULL';
            } else {
                $conditions[] = 'pb.dod IS NULL';
            }
        }

        if (! empty($filters['admission_type'])) {
            $conditions[] = "pb.subject_id IN (SELECT subject_id FROM {$s}.admissions WHERE admission_type = ?)";
            $params[] = $filters['admission_type'];
        }

        if (isset($filters['min_los']) && is_numeric($filters['min_los'])) {
            $conditions[] = 'pl.total_los_days >= ?';
            $params[] = (float) $filters['min_los'];
        }

        if (isset($filters['max_los']) && is_numeric($filters['max_los'])) {
            $conditions[] = 'pl.total_los_days <= ?';
            $params[] = (float) $filters['max_los'];
        }

        if (! empty($filters['diagnosis'])) {
            if ($hasDiagDict) {
                $conditions[] = "pb.subject_id IN (
                    SELECT d.subject_id FROM {$s}.diagnoses_icd d
                    LEFT JOIN {$s}.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
                    WHERE d.icd_code ILIKE ? OR dd.long_title ILIKE ?
                )";
                $like = '%'.$filters['diagnosis'].'%';
                $params[] = $like;
                $params[] = $like;
            } else {
                $conditions[] = "pb.subject_id IN (
                    SELECT d.subject_id FROM {$s}.diagnoses_icd d
                    WHERE d.icd_code ILIKE ?
                )";
                $params[] = '%'.$filters['diagnosis'].'%';
            }
        }

        $whereClause = $conditions ? 'WHERE '.implode(' AND ', $conditions) : '';

        $allowedSorts = ['subject_id', 'gender', 'anchor_age', 'admission_count', 'icu_stay_count', 'total_los_days', 'longest_icu_los', 'deceased'];
        $sortCol = in_array($filters['sort'] ?? '', $allowedSorts) ? $filters['sort'] : 'subject_id';
        $sortDir = ($filters['order'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';
        $orderBy = $sortCol === 'subject_id' ? "pb.subject_id::bigint {$sortDir}" : "{$sortCol} {$sortDir} NULLS LAST";

        // ICU CTE — only if table exists
        $icuCte = $hasIcuStays
            ? "patient_icu AS (
                SELECT subject_id,
                       count(DISTINCT stay_id)::int as icu_stay_count,
                       ROUND(max(los::numeric)::numeric, 1) as longest_icu_los
                FROM {$s}.icustays GROUP BY subject_id
            ),"
            : 'patient_icu AS (
                SELECT NULL::text as subject_id, 0 as icu_stay_count, NULL::numeric as longest_icu_los WHERE false
            ),';

        // Diagnosis CTE — adapt to available tables
        $dxCte = $hasDiagDict
            ? "patient_dx AS (
                SELECT DISTINCT ON (d.subject_id)
                       d.subject_id, d.icd_code as primary_icd_code,
                       COALESCE(dd.long_title, '') as primary_diagnosis
                FROM {$s}.diagnoses_icd d
                LEFT JOIN {$s}.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
                WHERE d.seq_num = '1'
                ORDER BY d.subject_id, d.hadm_id::bigint DESC
            )"
            : "patient_dx AS (
                SELECT DISTINCT ON (d.subject_id)
                       d.subject_id, d.icd_code as primary_icd_code,
                       '' as primary_diagnosis
                FROM {$s}.diagnoses_icd d
                WHERE d.seq_num = '1'
                ORDER BY d.subject_id, d.hadm_id::bigint DESC
            )";

        $sql = "
            WITH patient_base AS (
                SELECT {$selectCols},
                       count(DISTINCT a.hadm_id)::int as admission_count
                FROM {$s}.patients p
                LEFT JOIN {$s}.admissions a ON p.subject_id = a.subject_id
                GROUP BY {$groupByCols}
            ),
            {$icuCte}
            patient_los AS (
                SELECT subject_id,
                       ROUND(sum(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0)::numeric, 1) as total_los_days
                FROM {$s}.admissions GROUP BY subject_id
            ),
            {$dxCte}
            SELECT pb.subject_id, pb.gender, pb.anchor_age, pb.anchor_year,
                   pb.anchor_year_group, pb.dod,
                   pb.admission_count,
                   COALESCE(pi.icu_stay_count, 0) as icu_stay_count,
                   pl.total_los_days,
                   pi.longest_icu_los,
                   pd.primary_icd_code,
                   pd.primary_diagnosis,
                   CASE WHEN pb.dod IS NOT NULL THEN true ELSE false END as deceased
            FROM patient_base pb
            LEFT JOIN patient_icu pi ON pb.subject_id = pi.subject_id
            LEFT JOIN patient_los pl ON pb.subject_id = pl.subject_id
            LEFT JOIN patient_dx pd ON pb.subject_id = pd.subject_id
            {$whereClause}
            ORDER BY {$orderBy}
            LIMIT ? OFFSET ?
        ";

        $params[] = $limit;
        $params[] = $offset;

        $patients = DB::connection($this->conn)->select($sql, $params);

        // Count total
        $icuCteCnt = $hasIcuStays
            ? "patient_icu AS (
                SELECT subject_id, count(DISTINCT stay_id)::int as icu_stay_count
                FROM {$s}.icustays GROUP BY subject_id
            ),"
            : 'patient_icu AS (
                SELECT NULL::text as subject_id, 0 as icu_stay_count WHERE false
            ),';

        $countSql = "
            WITH patient_base AS (
                SELECT p.subject_id, p.dod
                FROM {$s}.patients p
            ),
            {$icuCteCnt}
            patient_los AS (
                SELECT subject_id,
                       sum(EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0) as total_los_days
                FROM {$s}.admissions GROUP BY subject_id
            )
            SELECT count(*) as total
            FROM patient_base pb
            LEFT JOIN patient_icu pi ON pb.subject_id = pi.subject_id
            LEFT JOIN patient_los pl ON pb.subject_id = pl.subject_id
            {$whereClause}
        ";

        $countParams = array_slice($params, 0, -2);
        $total = DB::connection($this->conn)->selectOne($countSql, $countParams);

        return ['data' => $patients, 'total' => (int) $total->total];
    }

    /**
     * Get full patient demographics.
     */
    public function getDemographics(string $subjectId, string $schema = 'mimiciv'): ?object
    {
        $s = $this->getSchemaName($schema);
        $selectCols = $this->introspector->patientSelectColumns($schema);
        $hasIcuStays = $this->introspector->hasTable($schema, 'icustays');
        $icuCount = $hasIcuStays
            ? "(SELECT count(*) FROM {$s}.icustays WHERE subject_id = p.subject_id)"
            : '0';

        return DB::connection($this->conn)->selectOne("
            SELECT {$selectCols},
                   (SELECT count(*) FROM {$s}.admissions WHERE subject_id = p.subject_id) as admission_count,
                   {$icuCount} as icu_stay_count,
                   (SELECT min(admittime) FROM {$s}.admissions WHERE subject_id = p.subject_id) as first_admit,
                   (SELECT max(dischtime) FROM {$s}.admissions WHERE subject_id = p.subject_id) as last_discharge
            FROM {$s}.patients p
            WHERE p.subject_id = ?
        ", [$subjectId]);
    }

    /**
     * Get all admissions for a patient.
     */
    public function getAdmissions(string $subjectId, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        $hasInsurance = $this->introspector->hasColumn($schema, 'admissions', 'insurance');
        $insuranceCol = $hasInsurance ? 'insurance,' : 'NULL as insurance,';

        return DB::connection($this->conn)->select("
            SELECT hadm_id, admittime, dischtime, deathtime,
                   admission_type, admission_location, discharge_location,
                   {$insuranceCol} language, marital_status, race,
                   hospital_expire_flag,
                   EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0 as los_days
            FROM {$s}.admissions
            WHERE subject_id = ?
            ORDER BY admittime
        ", [$subjectId]);
    }

    /**
     * Get transfers (location track) for a patient, optionally filtered by hadm_id.
     */
    public function getTransfers(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $hasEventType = $this->introspector->hasColumn($schema, 'transfers', 'eventtype');
        $eventTypeCol = $hasEventType ? 'eventtype' : "COALESCE(event_type_c, 'transfer') AS eventtype";

        $sql = "
            SELECT transfer_id, hadm_id, {$eventTypeCol}, careunit, intime, outtime,
                   CASE WHEN outtime IS NOT NULL AND intime IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (outtime::timestamp - intime::timestamp))/3600.0
                        ELSE NULL END as duration_hours
            FROM {$s}.transfers
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY intime';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get ICU stays for a patient.
     */
    public function getIcuStays(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT stay_id, hadm_id, first_careunit, last_careunit,
                   intime, outtime, los::numeric as los_days
            FROM {$s}.icustays
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY intime';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get diagnoses for a patient.
     */
    public function getDiagnoses(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $hasDiagDict = $this->introspector->hasTable($schema, 'd_icd_diagnoses');

        $descJoin = $hasDiagDict
            ? "LEFT JOIN {$s}.d_icd_diagnoses dd ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version"
            : '';
        $descCol = $hasDiagDict ? "COALESCE(dd.long_title, '')" : "''";

        $sql = "
            SELECT d.hadm_id, d.seq_num, d.icd_code, d.icd_version,
                   {$descCol} as description,
                   c.concept_id, c.concept_name as standard_concept_name
            FROM {$s}.diagnoses_icd d
            {$descJoin}
            LEFT JOIN omop.concept c
                ON CASE WHEN length(d.icd_code) <= 3 THEN d.icd_code
                        ELSE left(d.icd_code, 3) || '.' || substring(d.icd_code from 4) END = c.concept_code
                AND CASE WHEN d.icd_version = '9' THEN 'ICD9CM' ELSE 'ICD10CM' END = c.vocabulary_id
            WHERE d.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND d.hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY d.seq_num::int';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get procedures for a patient.
     */
    public function getProcedures(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        if (! $this->introspector->hasTable($schema, 'procedures_icd')) {
            return [];
        }

        $hasProcDict = $this->introspector->hasTable($schema, 'd_icd_procedures');
        $descJoin = $hasProcDict
            ? "LEFT JOIN {$s}.d_icd_procedures dp ON p.icd_code = dp.icd_code AND p.icd_version = dp.icd_version"
            : '';
        $descCol = $hasProcDict ? "COALESCE(dp.long_title, '')" : "''";

        $sql = "
            SELECT p.hadm_id, p.seq_num, p.chartdate, p.icd_code, p.icd_version,
                   {$descCol} as description
            FROM {$s}.procedures_icd p
            {$descJoin}
            WHERE p.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND p.hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY p.chartdate, p.seq_num::int';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get prescriptions/medications for a patient.
     */
    public function getMedications(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT hadm_id, pharmacy_id, starttime, stoptime,
                   drug_type, drug, gsn, ndc, prod_strength,
                   dose_val_rx, dose_unit_rx, route,
                   form_rx, doses_per_24_hrs
            FROM {$s}.prescriptions
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY starttime';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get lab results for a patient (from labevents).
     */
    public function getLabResults(string $subjectId, ?string $hadmId = null, int $limit = 2000, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $hasLabEventId = $this->introspector->hasColumn($schema, 'labevents', 'labevent_id');
        $hasRefRange = $this->introspector->hasColumn($schema, 'labevents', 'ref_range_lower');
        $hasInlineLabel = $this->introspector->hasColumn($schema, 'labevents', 'label');

        $idCol = $hasLabEventId ? 'l.labevent_id' : "ROW_NUMBER() OVER (ORDER BY l.charttime) AS labevent_id";
        $refLower = $hasRefRange ? 'l.ref_range_lower' : 'NULL AS ref_range_lower';
        $refUpper = $hasRefRange ? 'l.ref_range_upper' : 'NULL AS ref_range_upper';

        // AtlanticHealth has label inline on labevents; MIMIC needs d_labitems join
        if ($hasInlineLabel) {
            $sql = "
                SELECT {$idCol}, l.hadm_id, l.charttime, l.itemid,
                       l.label, NULL as fluid, NULL as category,
                       l.value, l.valuenum, l.valueuom,
                       {$refLower}, {$refUpper}, l.flag
                FROM {$s}.labevents l
                WHERE l.subject_id = ?
            ";
        } else {
            $sql = "
                SELECT {$idCol}, l.hadm_id, l.charttime, l.itemid,
                       di.label, di.fluid, di.category,
                       l.value, l.valuenum, l.valueuom,
                       {$refLower}, {$refUpper}, l.flag
                FROM {$s}.labevents l
                LEFT JOIN {$s}.d_labitems di ON l.itemid = di.itemid
                WHERE l.subject_id = ?
            ";
        }
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND l.hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY l.charttime DESC LIMIT ?';
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get vital signs / chart events for a patient (from chartevents).
     * Returns only key vitals by default to avoid overwhelming the client.
     */
    public function getVitals(string $subjectId, ?string $hadmId = null, ?string $stayId = null, int $limit = 5000, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $hasInlineLabel = $this->introspector->hasColumn($schema, 'chartevents', 'label');

        if ($hasInlineLabel) {
            // AtlanticHealth: label is inline, no d_items join needed, no itemid filtering
            $sql = "
                SELECT c.stay_id, c.charttime, c.itemid,
                       c.label, NULL as abbreviation, NULL as category,
                       c.value, c.valuenum, c.valueuom
                FROM {$s}.chartevents c
                WHERE c.subject_id = ?
            ";
        } else {
            // MIMIC-IV: join d_items, filter by vital sign itemids
            $vitalItemIds = '220045,220050,220051,220052,220179,220180,220181,220210,220277,223761,223762,220739,223900,223901,228096';
            $sql = "
                SELECT c.stay_id, c.charttime, c.itemid,
                       di.label, di.abbreviation, di.category,
                       c.value, c.valuenum, c.valueuom
                FROM {$s}.chartevents c
                JOIN {$s}.d_items di ON c.itemid = di.itemid
                WHERE c.subject_id = ?
                  AND c.itemid::int IN ({$vitalItemIds})
            ";
        }
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND c.hadm_id = ?';
            $params[] = $hadmId;
        }
        if ($stayId) {
            $sql .= ' AND c.stay_id = ?';
            $params[] = $stayId;
        }

        $sql .= ' ORDER BY c.charttime LIMIT ?';
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get input events (IV fluids, medications) for a patient.
     */
    public function getInputEvents(string $subjectId, ?string $hadmId = null, int $limit = 2000, string $schema = 'mimiciv'): array
    {
        if (! $this->introspector->hasTable($schema, 'inputevents')) {
            return [];
        }

        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT i.stay_id, i.starttime, i.endtime, i.itemid,
                   di.label, di.abbreviation,
                   i.amount, i.amountuom, i.rate, i.rateuom,
                   i.ordercategoryname, i.statusdescription, i.patientweight
            FROM {$s}.inputevents i
            JOIN {$s}.d_items di ON i.itemid = di.itemid
            WHERE i.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND i.hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY i.starttime LIMIT ?';
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get output events for a patient.
     */
    public function getOutputEvents(string $subjectId, ?string $hadmId = null, int $limit = 2000, string $schema = 'mimiciv'): array
    {
        if (! $this->introspector->hasTable($schema, 'outputevents')) {
            return [];
        }

        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT o.stay_id, o.charttime, o.itemid,
                   di.label,
                   o.value, o.valueuom
            FROM {$s}.outputevents o
            JOIN {$s}.d_items di ON o.itemid = di.itemid
            WHERE o.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND o.hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY o.charttime LIMIT ?';
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get microbiology cultures for a patient.
     */
    public function getMicrobiology(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        if (! $this->introspector->hasTable($schema, 'microbiologyevents')) {
            return [];
        }

        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT microevent_id, hadm_id, chartdate, charttime,
                   spec_type_desc, test_name, org_name, ab_name,
                   dilution_comparison, dilution_value, interpretation
            FROM {$s}.microbiologyevents
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY chartdate, charttime';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get service changes for a patient.
     */
    public function getServices(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);
        $sql = "
            SELECT hadm_id, transfertime, prev_service, curr_service
            FROM {$s}.services
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= ' AND hadm_id = ?';
            $params[] = $hadmId;
        }

        $sql .= ' ORDER BY transfertime';

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get per-domain event counts for a patient (summary stats).
     * Uses parameterized queries for both subject_id and hadm_id to prevent SQL injection.
     */
    public function getEventCounts(string $subjectId, ?string $hadmId = null, string $schema = 'mimiciv'): array
    {
        $s = $this->getSchemaName($schema);

        $allDomains = [
            'admissions' => 'admissions',
            'transfers' => 'transfers',
            'icu_stays' => 'icustays',
            'diagnoses' => 'diagnoses_icd',
            'procedures' => 'procedures_icd',
            'prescriptions' => 'prescriptions',
            'lab_results' => 'labevents',
            'vitals' => 'chartevents',
            'input_events' => 'inputevents',
            'output_events' => 'outputevents',
            'microbiology' => 'microbiologyevents',
            'services' => 'services',
        ];

        // Only include domains whose tables exist in this schema
        $domains = [];
        foreach ($allDomains as $name => $table) {
            if ($this->introspector->hasTable($schema, $table)) {
                $domains[$name] = "{$s}.{$table}";
            }
        }

        // Tables where hadm_id filtering uses a subquery through icustays
        $stayFilterTables = ["{$s}.chartevents", "{$s}.inputevents", "{$s}.outputevents"];

        $unions = [];
        $params = [];

        foreach ($domains as $name => $table) {
            $clause = "SELECT ? as domain, count(*) as total FROM {$table} WHERE subject_id = ?";
            $params[] = $name;
            $params[] = $subjectId;

            if ($hadmId) {
                if (in_array($table, $stayFilterTables, true)) {
                    $clause .= " AND stay_id IN (SELECT stay_id FROM {$s}.icustays WHERE hadm_id = ?)";
                } else {
                    $clause .= ' AND hadm_id = ?';
                }
                $params[] = $hadmId;
            }

            $unions[] = $clause;
        }

        $sql = implode("\n            UNION ALL ", $unions);
        $rows = DB::connection($this->conn)->select($sql, $params);

        $counts = [];
        foreach ($rows as $row) {
            $counts[$row->domain] = (int) $row->total;
        }

        return $counts;
    }
}
