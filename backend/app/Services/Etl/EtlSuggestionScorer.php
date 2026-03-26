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
            'devices' => ['device_exposure'],
            'deaths' => ['death'],
            'notes' => ['note'],
            'specimens' => ['specimen'],
            'costs' => ['cost'],
            'payers' => ['payer_plan_period'],
            'insurance' => ['payer_plan_period'],
            'providers' => ['provider'],
            'locations' => ['location'],
            'facilities' => ['care_site'],
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

        // Common field aliases
        $fieldAliases = [
            'patient_id' => ['person_id'],
            'encounter_id' => ['visit_occurrence_id'],
            'visit_id' => ['visit_occurrence_id'],
            'diagnosis_code' => ['condition_source_value'],
            'icd_code' => ['condition_source_value'],
            'drug_code' => ['drug_source_value'],
            'ndc_code' => ['drug_source_value'],
            'procedure_code' => ['procedure_source_value'],
            'cpt_code' => ['procedure_source_value'],
            'lab_code' => ['measurement_source_value'],
            'loinc_code' => ['measurement_source_value'],
            'first_name' => ['person_source_value'],
            'last_name' => ['person_source_value'],
            'dob' => ['birth_datetime'],
            'date_of_birth' => ['birth_datetime'],
            'gender' => ['gender_source_value'],
            'sex' => ['gender_source_value'],
            'race' => ['race_source_value'],
            'ethnicity' => ['ethnicity_source_value'],
            'start_date' => ['_start_date'], // partial match for any *_start_date
            'end_date' => ['_end_date'],
            'admit_date' => ['visit_start_date'],
            'discharge_date' => ['visit_end_date'],
        ];

        if (isset($fieldAliases[$source])) {
            foreach ($fieldAliases[$source] as $alias) {
                if ($cdm === $alias || str_ends_with($cdm, $alias)) {
                    return 0.8;
                }
            }
        }

        // Date pattern: source has 'date' and CDM has 'date'
        if (str_contains($source, 'date') && str_contains($cdm, 'date')) {
            return 0.6;
        }

        // ID pattern: source has '_id' and CDM has '_id'
        if (str_ends_with($source, '_id') && str_ends_with($cdm, '_id')) {
            return 0.5;
        }

        return 0.0;
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
