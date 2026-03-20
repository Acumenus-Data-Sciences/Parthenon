<?php

namespace App\Services\Morpheus;

use Illuminate\Support\Facades\DB;

class MorpheusPatientService
{
    private string $conn = 'inpatient';

    /**
     * Search patients by subject_id prefix.
     */
    public function searchPatients(string $query, int $limit = 20): array
    {
        return DB::connection($this->conn)->select("
            SELECT p.subject_id, p.gender, p.anchor_age, p.anchor_year,
                   p.anchor_year_group, p.dod,
                   count(DISTINCT a.hadm_id) as admission_count
            FROM mimiciv.patients p
            LEFT JOIN mimiciv.admissions a ON p.subject_id = a.subject_id
            WHERE p.subject_id::text LIKE ?
            GROUP BY p.subject_id, p.gender, p.anchor_age, p.anchor_year,
                     p.anchor_year_group, p.dod
            ORDER BY p.subject_id::int
            LIMIT ?
        ", [$query . '%', $limit]);
    }

    /**
     * List all patients with summary stats.
     */
    public function listPatients(int $limit = 100, int $offset = 0): array
    {
        $patients = DB::connection($this->conn)->select("
            SELECT p.subject_id, p.gender, p.anchor_age, p.anchor_year,
                   p.anchor_year_group, p.dod,
                   count(DISTINCT a.hadm_id) as admission_count,
                   count(DISTINCT i.stay_id) as icu_stay_count
            FROM mimiciv.patients p
            LEFT JOIN mimiciv.admissions a ON p.subject_id = a.subject_id
            LEFT JOIN mimiciv.icustays i ON p.subject_id = i.subject_id
            GROUP BY p.subject_id, p.gender, p.anchor_age, p.anchor_year,
                     p.anchor_year_group, p.dod
            ORDER BY p.subject_id::int
            LIMIT ? OFFSET ?
        ", [$limit, $offset]);

        $total = DB::connection($this->conn)->selectOne(
            "SELECT count(*) as total FROM mimiciv.patients"
        );

        return ['data' => $patients, 'total' => $total->total];
    }

    /**
     * Get full patient demographics.
     */
    public function getDemographics(string $subjectId): ?object
    {
        return DB::connection($this->conn)->selectOne("
            SELECT p.subject_id, p.gender, p.anchor_age, p.anchor_year,
                   p.anchor_year_group, p.dod,
                   (SELECT count(*) FROM mimiciv.admissions WHERE subject_id = p.subject_id) as admission_count,
                   (SELECT count(*) FROM mimiciv.icustays WHERE subject_id = p.subject_id) as icu_stay_count,
                   (SELECT min(admittime) FROM mimiciv.admissions WHERE subject_id = p.subject_id) as first_admit,
                   (SELECT max(dischtime) FROM mimiciv.admissions WHERE subject_id = p.subject_id) as last_discharge
            FROM mimiciv.patients p
            WHERE p.subject_id = ?
        ", [$subjectId]);
    }

    /**
     * Get all admissions for a patient.
     */
    public function getAdmissions(string $subjectId): array
    {
        return DB::connection($this->conn)->select("
            SELECT hadm_id, admittime, dischtime, deathtime,
                   admission_type, admission_location, discharge_location,
                   insurance, language, marital_status, race,
                   hospital_expire_flag,
                   EXTRACT(EPOCH FROM (dischtime::timestamp - admittime::timestamp))/86400.0 as los_days
            FROM mimiciv.admissions
            WHERE subject_id = ?
            ORDER BY admittime
        ", [$subjectId]);
    }

    /**
     * Get transfers (location track) for a patient, optionally filtered by hadm_id.
     */
    public function getTransfers(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT transfer_id, hadm_id, eventtype, careunit, intime, outtime,
                   EXTRACT(EPOCH FROM (outtime::timestamp - intime::timestamp))/3600.0 as duration_hours
            FROM mimiciv.transfers
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY intime";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get ICU stays for a patient.
     */
    public function getIcuStays(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT stay_id, hadm_id, first_careunit, last_careunit,
                   intime, outtime, los::numeric as los_days
            FROM mimiciv.icustays
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY intime";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get diagnoses for a patient.
     */
    public function getDiagnoses(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT d.hadm_id, d.seq_num, d.icd_code, d.icd_version,
                   COALESCE(dd.long_title, '') as description,
                   c.concept_id, c.concept_name as standard_concept_name
            FROM mimiciv.diagnoses_icd d
            LEFT JOIN mimiciv.d_icd_diagnoses dd
                ON d.icd_code = dd.icd_code AND d.icd_version = dd.icd_version
            LEFT JOIN omop.concept c
                ON CASE WHEN length(d.icd_code) <= 3 THEN d.icd_code
                        ELSE left(d.icd_code, 3) || '.' || substring(d.icd_code from 4) END = c.concept_code
                AND CASE WHEN d.icd_version = '9' THEN 'ICD9CM' ELSE 'ICD10CM' END = c.vocabulary_id
            WHERE d.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND d.hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY d.seq_num::int";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get procedures for a patient.
     */
    public function getProcedures(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT p.hadm_id, p.seq_num, p.chartdate, p.icd_code, p.icd_version,
                   COALESCE(dp.long_title, '') as description
            FROM mimiciv.procedures_icd p
            LEFT JOIN mimiciv.d_icd_procedures dp
                ON p.icd_code = dp.icd_code AND p.icd_version = dp.icd_version
            WHERE p.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND p.hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY p.chartdate, p.seq_num::int";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get prescriptions/medications for a patient.
     */
    public function getMedications(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT hadm_id, pharmacy_id, starttime, stoptime,
                   drug_type, drug, gsn, ndc, prod_strength,
                   dose_val_rx, dose_unit_rx, route,
                   form_rx, doses_per_24_hrs
            FROM mimiciv.prescriptions
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY starttime";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get lab results for a patient (from labevents).
     */
    public function getLabResults(string $subjectId, ?string $hadmId = null, int $limit = 2000): array
    {
        $sql = "
            SELECT l.labevent_id, l.hadm_id, l.charttime, l.itemid,
                   di.label, di.fluid, di.category,
                   l.value, l.valuenum, l.valueuom,
                   l.ref_range_lower, l.ref_range_upper, l.flag
            FROM mimiciv.labevents l
            LEFT JOIN mimiciv.d_labitems di ON l.itemid = di.itemid
            WHERE l.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND l.hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY l.charttime DESC LIMIT ?";
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get vital signs / chart events for a patient (from chartevents).
     * Returns only key vitals by default to avoid overwhelming the client.
     */
    public function getVitals(string $subjectId, ?string $hadmId = null, ?string $stayId = null, int $limit = 5000): array
    {
        // Key vital sign item IDs in MIMIC-IV
        // HR=220045, SBP=220050(invasive)/220179(non-invasive), DBP=220051/220180,
        // MAP=220052/220181, RR=220210, SpO2=220277, Temp=223761(F)/223762(C),
        // GCS=220739(eye)/223900(verbal)/223901(motor), RASS=228096
        $vitalItemIds = '220045,220050,220051,220052,220179,220180,220181,220210,220277,223761,223762,220739,223900,223901,228096';

        $sql = "
            SELECT c.stay_id, c.charttime, c.itemid,
                   di.label, di.abbreviation, di.category,
                   c.value, c.valuenum, c.valueuom
            FROM mimiciv.chartevents c
            JOIN mimiciv.d_items di ON c.itemid = di.itemid
            WHERE c.subject_id = ?
              AND c.itemid::int IN ({$vitalItemIds})
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND c.hadm_id = ?";
            $params[] = $hadmId;
        }
        if ($stayId) {
            $sql .= " AND c.stay_id = ?";
            $params[] = $stayId;
        }

        $sql .= " ORDER BY c.charttime LIMIT ?";
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get input events (IV fluids, medications) for a patient.
     */
    public function getInputEvents(string $subjectId, ?string $hadmId = null, int $limit = 2000): array
    {
        $sql = "
            SELECT i.stay_id, i.starttime, i.endtime, i.itemid,
                   di.label, di.abbreviation,
                   i.amount, i.amountuom, i.rate, i.rateuom,
                   i.ordercategoryname, i.statusdescription, i.patientweight
            FROM mimiciv.inputevents i
            JOIN mimiciv.d_items di ON i.itemid = di.itemid
            WHERE i.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND i.hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY i.starttime LIMIT ?";
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get output events for a patient.
     */
    public function getOutputEvents(string $subjectId, ?string $hadmId = null, int $limit = 2000): array
    {
        $sql = "
            SELECT o.stay_id, o.charttime, o.itemid,
                   di.label,
                   o.value, o.valueuom
            FROM mimiciv.outputevents o
            JOIN mimiciv.d_items di ON o.itemid = di.itemid
            WHERE o.subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND o.hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY o.charttime LIMIT ?";
        $params[] = $limit;

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get microbiology cultures for a patient.
     */
    public function getMicrobiology(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT microevent_id, hadm_id, chartdate, charttime,
                   spec_type_desc, test_name, org_name, ab_name,
                   dilution_comparison, dilution_value, interpretation
            FROM mimiciv.microbiologyevents
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY chartdate, charttime";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get service changes for a patient.
     */
    public function getServices(string $subjectId, ?string $hadmId = null): array
    {
        $sql = "
            SELECT hadm_id, transfertime, prev_service, curr_service
            FROM mimiciv.services
            WHERE subject_id = ?
        ";
        $params = [$subjectId];

        if ($hadmId) {
            $sql .= " AND hadm_id = ?";
            $params[] = $hadmId;
        }

        $sql .= " ORDER BY transfertime";

        return DB::connection($this->conn)->select($sql, $params);
    }

    /**
     * Get per-domain event counts for a patient (summary stats).
     * Uses parameterized queries for both subject_id and hadm_id to prevent SQL injection.
     */
    public function getEventCounts(string $subjectId, ?string $hadmId = null): array
    {
        $domains = [
            'admissions'    => 'mimiciv.admissions',
            'transfers'     => 'mimiciv.transfers',
            'icu_stays'     => 'mimiciv.icustays',
            'diagnoses'     => 'mimiciv.diagnoses_icd',
            'procedures'    => 'mimiciv.procedures_icd',
            'prescriptions' => 'mimiciv.prescriptions',
            'lab_results'   => 'mimiciv.labevents',
            'vitals'        => 'mimiciv.chartevents',
            'input_events'  => 'mimiciv.inputevents',
            'output_events' => 'mimiciv.outputevents',
            'microbiology'  => 'mimiciv.microbiologyevents',
            'services'      => 'mimiciv.services',
        ];

        // Tables where hadm_id filtering uses a subquery through icustays
        $stayFilterTables = ['mimiciv.chartevents', 'mimiciv.inputevents', 'mimiciv.outputevents'];

        $unions = [];
        $params = [];

        foreach ($domains as $name => $table) {
            $clause = "SELECT ? as domain, count(*) as total FROM {$table} WHERE subject_id = ?";
            $params[] = $name;
            $params[] = $subjectId;

            if ($hadmId) {
                if (in_array($table, $stayFilterTables, true)) {
                    $clause .= " AND stay_id IN (SELECT stay_id FROM mimiciv.icustays WHERE hadm_id = ?)";
                } else {
                    $clause .= " AND hadm_id = ?";
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
