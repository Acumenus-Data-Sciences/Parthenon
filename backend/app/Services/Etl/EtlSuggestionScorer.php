<?php

namespace App\Services\Etl;

class EtlSuggestionScorer
{
    /**
     * Score how well a source table name matches a CDM table name.
     * Returns 0.0 to 1.0.
     */
    public static function tableScore(string $sourceTable, string $cdmTable): float
    {
        $source = strtolower(trim($sourceTable));
        $cdm = strtolower(trim($cdmTable));

        // Exact match
        if ($source === $cdm) {
            return 1.0;
        }

        // Plural/singular variants
        $singularSource = rtrim($source, 's');
        $singularCdm = rtrim($cdm, 's');
        $cdmShort = str_replace('_occurrence', '', str_replace('_exposure', '', $cdm));

        if ($singularSource === $singularCdm) {
            return 0.95;
        }

        if ($source === $cdmShort || $singularSource === $cdmShort) {
            return 0.9;
        }

        // Common aliases
        $aliases = [
            'patients' => ['person'],
            'patient' => ['person'],
            'encounters' => ['visit_occurrence'],
            'encounter' => ['visit_occurrence'],
            'visits' => ['visit_occurrence'],
            'diagnoses' => ['condition_occurrence'],
            'diagnosis' => ['condition_occurrence'],
            'conditions' => ['condition_occurrence'],
            'medications' => ['drug_exposure'],
            'meds' => ['drug_exposure'],
            'drugs' => ['drug_exposure'],
            'prescriptions' => ['drug_exposure'],
            'procedures' => ['procedure_occurrence'],
            'labs' => ['measurement'],
            'lab_results' => ['measurement'],
            'measurements' => ['measurement'],
            'observations' => ['observation'],
            'vitals' => ['measurement'],
            'vital_sign' => ['measurement'],
            'vital_signs' => ['measurement'],
            'devices' => ['device_exposure'],
            'device_use' => ['device_exposure'],
            'deaths' => ['death'],
            'notes' => ['note'],
            'encounter_note' => ['note'],
            'encounter_notes' => ['note'],
            'specimens' => ['specimen'],
            'costs' => ['cost'],
            'encounter_charge' => ['cost'],
            'encounter_charges' => ['cost'],
            'payers' => ['payer_plan_period'],
            'payer' => ['payer_plan_period'],
            'insurance' => ['payer_plan_period'],
            'patient_coverage' => ['payer_plan_period'],
            'providers' => ['provider'],
            'locations' => ['location'],
            'facilities' => ['care_site'],
            'care_site' => ['care_site'],
            'clinical_observation' => ['observation'],
            'clinical_observations' => ['observation'],
            'encounter_diagnosis' => ['condition_occurrence'],
            'encounter_diagnoses' => ['condition_occurrence'],
            'problem_list' => ['condition_occurrence'],
            'lab_result' => ['measurement'],
            'medication_order' => ['drug_exposure'],
            'medication_orders' => ['drug_exposure'],
            'medication_administration' => ['drug_exposure'],
            'medication_dispense' => ['drug_exposure'],
            'procedure_order' => ['procedure_occurrence'],
            'procedure_result' => ['procedure_occurrence'],
            'immunization' => ['drug_exposure'],
            'immunizations' => ['drug_exposure'],
            'family_history' => ['observation'],
            'allergy' => ['observation'],
            'allergies' => ['observation'],
            'smoking_and_social_history' => ['observation'],
            'referral' => ['observation'],
        ];

        if (isset($aliases[$source]) && in_array($cdm, $aliases[$source])) {
            return 0.85;
        }

        // Contains check (source contains CDM short name or vice versa)
        if (str_contains($source, $cdmShort) || str_contains($cdmShort, $source)) {
            return 0.6;
        }

        // Levenshtein similarity (normalized)
        $maxLen = max(strlen($source), strlen($cdm));
        if ($maxLen > 0) {
            $distance = levenshtein($source, $cdm);
            $similarity = 1.0 - ($distance / $maxLen);
            if ($similarity >= 0.7) {
                return round($similarity * 0.7, 2); // scale down
            }
        }

        return 0.0;
    }

    /**
     * Score how well a source column matches a CDM column.
     * Returns 0.0 to 1.0.
     */
    public static function fieldScore(string $sourceCol, string $cdmCol, ?string $sourceType = null): float
    {
        $source = strtolower(trim($sourceCol));
        $cdm = strtolower(trim($cdmCol));

        // Exact match
        if ($source === $cdm) {
            return 1.0;
        }

        // Source contains CDM name or vice versa
        if (str_contains($source, $cdm) || str_contains($cdm, $source)) {
            return 0.85;
        }

        // Common field aliases (source -> CDM targets)
        $fieldAliases = [
            // Person identifiers
            'patient_id' => ['person_id', 'person_source_value'],
            'source_patient_id' => ['person_source_value'],
            'enterprise_mrn' => ['person_source_value'],
            'mrn' => ['person_source_value'],
            'medical_record_number' => ['person_source_value'],

            // Birth / age
            'dob' => ['birth_datetime', 'year_of_birth', 'month_of_birth', 'day_of_birth'],
            'date_of_birth' => ['birth_datetime', 'year_of_birth', 'month_of_birth', 'day_of_birth'],
            'birth_date' => ['birth_datetime', 'year_of_birth', 'month_of_birth', 'day_of_birth'],
            'birthdate' => ['birth_datetime', 'year_of_birth', 'month_of_birth', 'day_of_birth'],
            'birth_year' => ['year_of_birth'],
            'birth_month' => ['month_of_birth'],
            'birth_day' => ['day_of_birth'],
            'age' => ['year_of_birth'],

            // Gender / sex
            'gender' => ['gender_source_value', 'gender_concept_id'],
            'sex' => ['gender_source_value', 'gender_concept_id'],
            'sex_source_value' => ['gender_source_value'],
            'gender_identity_value' => ['gender_source_value'],

            // Race / ethnicity
            'race' => ['race_source_value', 'race_concept_id'],
            'race_source_value' => ['race_source_value', 'race_concept_id'],
            'ethnicity' => ['ethnicity_source_value', 'ethnicity_concept_id'],
            'ethnicity_source_value' => ['ethnicity_source_value', 'ethnicity_concept_id'],

            // Visit / encounter
            'encounter_id' => ['visit_occurrence_id'],
            'visit_id' => ['visit_occurrence_id'],
            'admit_date' => ['visit_start_date', 'visit_start_datetime'],
            'admission_date' => ['visit_start_date', 'visit_start_datetime'],
            'discharge_date' => ['visit_end_date', 'visit_end_datetime'],
            'visit_date' => ['visit_start_date'],
            'visit_start_date' => ['visit_start_date'],
            'visit_end_date' => ['visit_end_date'],
            'visit_type' => ['visit_type_concept_id', 'visit_source_value'],
            'encounter_type' => ['visit_type_concept_id', 'visit_source_value'],
            'encounter_class' => ['visit_concept_id', 'visit_source_value'],

            // Condition / diagnosis
            'diagnosis_code' => ['condition_source_value', 'condition_concept_id'],
            'icd_code' => ['condition_source_value', 'condition_concept_id'],
            'icd10_code' => ['condition_source_value'],
            'icd9_code' => ['condition_source_value'],
            'condition_code' => ['condition_source_value', 'condition_concept_id'],
            'diagnosis_date' => ['condition_start_date'],
            'onset_date' => ['condition_start_date'],
            'resolution_date' => ['condition_end_date'],

            // Drug / medication
            'drug_code' => ['drug_source_value', 'drug_concept_id'],
            'ndc_code' => ['drug_source_value'],
            'rxnorm_code' => ['drug_concept_id'],
            'medication_name' => ['drug_source_value'],
            'drug_name' => ['drug_source_value'],
            'prescription_date' => ['drug_exposure_start_date'],
            'dispense_date' => ['drug_exposure_start_date'],
            'days_supply' => ['days_supply'],
            'quantity' => ['quantity'],
            'refills' => ['refills'],
            'dose' => ['dose_value'],
            'route' => ['route_source_value', 'route_concept_id'],
            'sig' => ['sig'],

            // Procedure
            'procedure_code' => ['procedure_source_value', 'procedure_concept_id'],
            'cpt_code' => ['procedure_source_value', 'procedure_concept_id'],
            'hcpcs_code' => ['procedure_source_value'],
            'procedure_date' => ['procedure_date'],

            // Measurement / lab
            'lab_code' => ['measurement_source_value', 'measurement_concept_id'],
            'loinc_code' => ['measurement_source_value', 'measurement_concept_id'],
            'test_name' => ['measurement_source_value'],
            'result_value' => ['value_as_number', 'value_source_value'],
            'result_numeric' => ['value_as_number'],
            'result_text' => ['value_source_value'],
            'result_unit' => ['unit_source_value', 'unit_concept_id'],
            'unit' => ['unit_source_value', 'unit_concept_id'],
            'reference_range_low' => ['range_low'],
            'reference_range_high' => ['range_high'],
            'normal_low' => ['range_low'],
            'normal_high' => ['range_high'],
            'lab_date' => ['measurement_date'],
            'test_date' => ['measurement_date'],

            // Observation
            'observation_code' => ['observation_source_value', 'observation_concept_id'],
            'observation_date' => ['observation_date'],
            'observation_value' => ['value_as_string', 'value_as_number'],

            // Provider / location
            'provider_name' => ['provider_source_value'],
            'provider_npi' => ['npi'],
            'primary_care_provider_id' => ['provider_id'],
            'attending_provider_id' => ['provider_id'],
            'facility_id' => ['care_site_id'],
            'location_id' => ['location_id'],
            'address' => ['address_1'],
            'city' => ['city'],
            'state' => ['state'],
            'zip' => ['zip'],
            'zip_code' => ['zip'],
            'postal_code' => ['zip'],
            'county' => ['county'],
            'country' => ['country_source_value'],
            'latitude' => ['latitude'],
            'longitude' => ['longitude'],

            // Generic temporal
            'start_date' => ['_start_date'],
            'end_date' => ['_end_date'],
            'effective_date' => ['_start_date'],
            'created_date' => ['_start_date'],

            // Cost
            'total_charge' => ['total_charge'],
            'total_cost' => ['total_cost'],
            'total_paid' => ['total_paid'],
            'paid_by_payer' => ['paid_by_payer'],
            'paid_by_patient' => ['paid_by_patient'],

            // Note
            'note_text' => ['note_text'],
            'note_title' => ['note_title'],
            'note_date' => ['note_date'],

            // Specimen
            'specimen_date' => ['specimen_date'],
            'specimen_type' => ['specimen_source_value'],
        ];

        if (isset($fieldAliases[$source])) {
            foreach ($fieldAliases[$source] as $alias) {
                if ($cdm === $alias || str_ends_with($cdm, $alias)) {
                    return 0.8;
                }
            }
        }

        // Semantic root matching: strip common suffixes and compare roots
        $sourceRoot = self::extractRoot($source);
        $cdmRoot = self::extractRoot($cdm);
        if ($sourceRoot && $cdmRoot && $sourceRoot === $cdmRoot) {
            return 0.7;
        }

        // Date pattern: source has 'date' or 'birth' and CDM has 'date' or 'birth'
        if (
            (str_contains($source, 'date') || str_contains($source, 'birth'))
            && (str_contains($cdm, 'date') || str_contains($cdm, 'birth'))
        ) {
            return 0.6;
        }

        // Source value pattern: source matches stem of CDM *_source_value
        if (str_ends_with($cdm, '_source_value')) {
            $cdmStem = str_replace('_source_value', '', $cdm);
            if (str_contains($source, $cdmStem) || str_contains($cdmStem, $source)) {
                return 0.65;
            }
        }

        // Levenshtein similarity for close names
        $maxLen = max(strlen($source), strlen($cdm));
        if ($maxLen > 0 && $maxLen < 30) {
            $distance = levenshtein($source, $cdm);
            $similarity = 1.0 - ($distance / $maxLen);
            if ($similarity >= 0.75) {
                return round($similarity * 0.65, 2);
            }
        }

        // ID pattern: only if the stems match (not just both ending in _id)
        if (str_ends_with($source, '_id') && str_ends_with($cdm, '_id')) {
            $sourceStem = str_replace('_id', '', $source);
            $cdmStem = str_replace('_id', '', $cdm);
            if (str_contains($sourceStem, $cdmStem) || str_contains($cdmStem, $sourceStem)) {
                return 0.6;
            }
            // Generic _id match only if roots are somewhat similar
            if ($sourceRoot && $cdmRoot) {
                $rootSimilarity = 1.0 - (levenshtein($sourceRoot, $cdmRoot) / max(strlen($sourceRoot), strlen($cdmRoot)));
                if ($rootSimilarity >= 0.6) {
                    return round($rootSimilarity * 0.45, 2);
                }
            }
        }

        return 0.0;
    }

    /**
     * Infer mapping type AND logic hint based on source/CDM column names and types.
     *
     * @return array{mapping_type: string, logic: string|null}
     */
    public static function inferMappingWithLogic(
        string $sourceCol,
        string $cdmCol,
        ?string $sourceType = null,
        ?string $cdmType = null,
        ?string $fkTable = null,
        ?string $fkDomain = null,
    ): array {
        $src = strtolower(trim($sourceCol));
        $cdm = strtolower(trim($cdmCol));
        $srcType = strtolower(trim($sourceType ?? ''));
        $cdmTypeNorm = strtolower(trim($cdmType ?? ''));

        // --- concept_id columns: need vocabulary lookup ---
        if (str_ends_with($cdm, '_concept_id')) {
            $domain = $fkDomain ?? ucfirst(str_replace('_concept_id', '', $cdm));
            $logic = "Lookup source value in CONCEPT table where domain_id = '{$domain}'";

            // source_concept_id = map source code to non-standard concept
            if (str_ends_with($cdm, '_source_concept_id')) {
                $logic = 'Map source value to source concept via SOURCE_TO_CONCEPT_MAP or set 0 if no mapping exists';
            }
            // type_concept_id = provenance metadata
            elseif (str_ends_with($cdm, '_type_concept_id')) {
                $logic = "Set to concept representing data provenance (e.g., 32817 = 'EHR', 32810 = 'Claim')";
            }

            return ['mapping_type' => 'lookup', 'logic' => $logic];
        }

        // --- Date/datetime extraction from a date source ---
        if (str_contains($src, 'date') || str_contains($src, 'birth') || str_contains($src, 'dob')) {
            // year_of_birth, month_of_birth, day_of_birth from a date column
            if ($cdm === 'year_of_birth') {
                return ['mapping_type' => 'transform', 'logic' => "EXTRACT(YEAR FROM {$sourceCol})"];
            }
            if ($cdm === 'month_of_birth') {
                return ['mapping_type' => 'transform', 'logic' => "EXTRACT(MONTH FROM {$sourceCol})"];
            }
            if ($cdm === 'day_of_birth') {
                return ['mapping_type' => 'transform', 'logic' => "EXTRACT(DAY FROM {$sourceCol})"];
            }

            // date -> datetime promotion
            if ($srcType === 'date' && ($cdmTypeNorm === 'datetime' || str_ends_with($cdm, '_datetime'))) {
                return ['mapping_type' => 'transform', 'logic' => "CAST({$sourceCol} AS TIMESTAMP)"];
            }

            // datetime -> date truncation
            if (($srcType === 'datetime' || $srcType === 'timestamp') && $cdmTypeNorm === 'date') {
                return ['mapping_type' => 'transform', 'logic' => "CAST({$sourceCol} AS DATE)"];
            }

            // Direct date copy
            return ['mapping_type' => 'direct', 'logic' => null];
        }

        // --- Type mismatch transforms ---
        if ($srcType && $cdmTypeNorm) {
            // String -> integer
            if (in_array($srcType, ['string', 'varchar', 'text']) && $cdmTypeNorm === 'integer') {
                return ['mapping_type' => 'transform', 'logic' => "CAST({$sourceCol} AS INTEGER)"];
            }
            // Integer -> varchar
            if ($srcType === 'integer' && in_array($cdmTypeNorm, ['varchar', 'text'])) {
                return ['mapping_type' => 'transform', 'logic' => "CAST({$sourceCol} AS VARCHAR)"];
            }
            // Float -> integer
            if (in_array($srcType, ['float', 'double', 'numeric', 'decimal']) && $cdmTypeNorm === 'integer') {
                return ['mapping_type' => 'transform', 'logic' => "ROUND({$sourceCol})::INTEGER"];
            }
        }

        // --- source_value columns: direct passthrough ---
        if (str_ends_with($cdm, '_source_value')) {
            return ['mapping_type' => 'direct', 'logic' => null];
        }

        // --- FK reference columns (provider_id, care_site_id, location_id) ---
        if ($fkTable) {
            return [
                'mapping_type' => 'lookup',
                'logic' => "Join to {$fkTable} table to resolve ID",
            ];
        }

        // Default: direct mapping
        return ['mapping_type' => 'direct', 'logic' => null];
    }

    /**
     * Extract the semantic root of a column name by stripping common suffixes.
     */
    private static function extractRoot(string $col): string
    {
        $suffixes = [
            '_concept_id', '_source_value', '_source_concept_id', '_type_concept_id',
            '_id', '_date', '_datetime', '_value', '_name', '_code',
        ];
        foreach ($suffixes as $suffix) {
            if (str_ends_with($col, $suffix)) {
                return str_replace($suffix, '', $col);
            }
        }

        return $col;
    }

    /**
     * Determine mapping_type from CDM column name conventions.
     */
    public static function inferMappingType(string $cdmCol): string
    {
        if (str_ends_with($cdmCol, '_concept_id')) {
            return 'lookup';
        }

        if (str_ends_with($cdmCol, '_date') || str_ends_with($cdmCol, '_datetime')) {
            return 'transform';
        }

        if (str_ends_with($cdmCol, '_source_value')) {
            return 'direct';
        }

        return 'direct';
    }
}
