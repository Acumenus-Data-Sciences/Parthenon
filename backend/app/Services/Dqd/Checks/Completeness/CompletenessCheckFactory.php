<?php

namespace App\Services\Dqd\Checks\Completeness;

use App\Contracts\DqdCheckInterface;

class CompletenessCheckFactory
{
    /**
     * Create all completeness checks.
     *
     * @return array<int, DqdCheckInterface>
     */
    public static function create(): array
    {
        return array_merge(
            self::requiredFieldChecks(),
            self::valueCompletenessChecks(),
            self::nonZeroConceptChecks(),
        );
    }

    /**
     * Required field checks: fields that must never be NULL per CDM spec.
     *
     * @return array<int, RequiredFieldCheck>
     */
    private static function requiredFieldChecks(): array
    {
        return [
            // Person required fields
            new RequiredFieldCheck('person', 'person_id', 'Person ID must not be null'),
            new RequiredFieldCheck('person', 'gender_concept_id', 'Gender concept must not be null'),
            new RequiredFieldCheck('person', 'year_of_birth', 'Year of birth must not be null'),
            new RequiredFieldCheck('person', 'race_concept_id', 'Race concept must not be null'),
            new RequiredFieldCheck('person', 'ethnicity_concept_id', 'Ethnicity concept must not be null'),

            // Visit occurrence required fields
            new RequiredFieldCheck('visit_occurrence', 'visit_occurrence_id', 'Visit occurrence ID must not be null'),
            new RequiredFieldCheck('visit_occurrence', 'person_id', 'Visit must have person_id'),
            new RequiredFieldCheck('visit_occurrence', 'visit_concept_id', 'Visit must have concept'),
            new RequiredFieldCheck('visit_occurrence', 'visit_start_date', 'Visit must have start date'),
            new RequiredFieldCheck('visit_occurrence', 'visit_end_date', 'Visit must have end date'),
            new RequiredFieldCheck('visit_occurrence', 'visit_type_concept_id', 'Visit must have type concept'),

            // Condition occurrence required fields
            new RequiredFieldCheck('condition_occurrence', 'condition_occurrence_id', 'Condition occurrence ID must not be null'),
            new RequiredFieldCheck('condition_occurrence', 'person_id', 'Condition must have person_id'),
            new RequiredFieldCheck('condition_occurrence', 'condition_concept_id', 'Condition must have concept'),
            new RequiredFieldCheck('condition_occurrence', 'condition_start_date', 'Condition must have start date'),
            new RequiredFieldCheck('condition_occurrence', 'condition_type_concept_id', 'Condition must have type concept'),

            // Drug exposure required fields
            new RequiredFieldCheck('drug_exposure', 'drug_exposure_id', 'Drug exposure ID must not be null'),
            new RequiredFieldCheck('drug_exposure', 'person_id', 'Drug must have person_id'),
            new RequiredFieldCheck('drug_exposure', 'drug_concept_id', 'Drug must have concept'),
            new RequiredFieldCheck('drug_exposure', 'drug_exposure_start_date', 'Drug must have start date'),
            new RequiredFieldCheck('drug_exposure', 'drug_type_concept_id', 'Drug must have type concept'),

            // Procedure occurrence required fields
            new RequiredFieldCheck('procedure_occurrence', 'procedure_occurrence_id', 'Procedure occurrence ID must not be null'),
            new RequiredFieldCheck('procedure_occurrence', 'person_id', 'Procedure must have person_id'),
            new RequiredFieldCheck('procedure_occurrence', 'procedure_concept_id', 'Procedure must have concept'),
            new RequiredFieldCheck('procedure_occurrence', 'procedure_date', 'Procedure must have date'),
            new RequiredFieldCheck('procedure_occurrence', 'procedure_type_concept_id', 'Procedure must have type concept'),

            // Measurement required fields
            new RequiredFieldCheck('measurement', 'measurement_id', 'Measurement ID must not be null'),
            new RequiredFieldCheck('measurement', 'person_id', 'Measurement must have person_id'),
            new RequiredFieldCheck('measurement', 'measurement_concept_id', 'Measurement must have concept'),
            new RequiredFieldCheck('measurement', 'measurement_date', 'Measurement must have date'),
            new RequiredFieldCheck('measurement', 'measurement_type_concept_id', 'Measurement must have type concept'),

            // Observation required fields
            new RequiredFieldCheck('observation', 'observation_id', 'Observation ID must not be null'),
            new RequiredFieldCheck('observation', 'person_id', 'Observation must have person_id'),
            new RequiredFieldCheck('observation', 'observation_concept_id', 'Observation must have concept'),
            new RequiredFieldCheck('observation', 'observation_date', 'Observation must have date'),
            new RequiredFieldCheck('observation', 'observation_type_concept_id', 'Observation must have type concept'),

            // Observation period required fields
            new RequiredFieldCheck('observation_period', 'observation_period_id', 'Observation period ID must not be null'),
            new RequiredFieldCheck('observation_period', 'person_id', 'Observation period must have person_id'),
            new RequiredFieldCheck('observation_period', 'observation_period_start_date', 'Observation period must have start date'),
            new RequiredFieldCheck('observation_period', 'observation_period_end_date', 'Observation period must have end date'),
            new RequiredFieldCheck('observation_period', 'period_type_concept_id', 'Observation period must have type concept'),

            // Death table required fields
            new RequiredFieldCheck('death', 'person_id', 'Death must have person_id'),
            new RequiredFieldCheck('death', 'death_date', 'Death must have date'),

            // Device exposure required fields
            new RequiredFieldCheck('device_exposure', 'device_exposure_id', 'Device exposure ID must not be null'),
            new RequiredFieldCheck('device_exposure', 'person_id', 'Device exposure must have person_id'),
            new RequiredFieldCheck('device_exposure', 'device_concept_id', 'Device exposure must have concept'),
            new RequiredFieldCheck('device_exposure', 'device_exposure_start_date', 'Device exposure must have start date'),
            new RequiredFieldCheck('device_exposure', 'device_type_concept_id', 'Device exposure must have type concept'),
        ];
    }

    /**
     * Value completeness checks: optional fields that should ideally be populated.
     *
     * @return array<int, ValueCompletenessCheck>
     */
    private static function valueCompletenessChecks(): array
    {
        return [
            // Source values — high importance for traceability
            new ValueCompletenessCheck('condition_occurrence', 'condition_source_value', 'Condition source value should be populated', 10.0),
            new ValueCompletenessCheck('drug_exposure', 'drug_source_value', 'Drug source value should be populated', 10.0),
            new ValueCompletenessCheck('procedure_occurrence', 'procedure_source_value', 'Procedure source value should be populated', 10.0),
            new ValueCompletenessCheck('measurement', 'measurement_source_value', 'Measurement source value should be populated', 10.0),
            new ValueCompletenessCheck('observation', 'observation_source_value', 'Observation source value should be populated', 10.0),

            // Measurement values — many measurements should have numeric results
            new ValueCompletenessCheck('measurement', 'value_as_number', 'Measurement numeric value should be populated', 50.0),
            new ValueCompletenessCheck('measurement', 'unit_concept_id', 'Measurement unit should be populated', 50.0),

            // Provider and visit linkage
            new ValueCompletenessCheck('condition_occurrence', 'provider_id', 'Condition should have provider', 80.0),
            new ValueCompletenessCheck('drug_exposure', 'provider_id', 'Drug exposure should have provider', 80.0),
            new ValueCompletenessCheck('procedure_occurrence', 'provider_id', 'Procedure should have provider', 80.0),
            new ValueCompletenessCheck('measurement', 'provider_id', 'Measurement should have provider', 80.0),

            // Visit linkage
            new ValueCompletenessCheck('condition_occurrence', 'visit_occurrence_id', 'Condition should be linked to a visit', 20.0),
            new ValueCompletenessCheck('drug_exposure', 'visit_occurrence_id', 'Drug exposure should be linked to a visit', 20.0),
            new ValueCompletenessCheck('procedure_occurrence', 'visit_occurrence_id', 'Procedure should be linked to a visit', 20.0),
            new ValueCompletenessCheck('measurement', 'visit_occurrence_id', 'Measurement should be linked to a visit', 20.0),
            new ValueCompletenessCheck('observation', 'visit_occurrence_id', 'Observation should be linked to a visit', 20.0),

            // End dates for events
            new ValueCompletenessCheck('condition_occurrence', 'condition_end_date', 'Condition should have end date', 30.0),
            new ValueCompletenessCheck('drug_exposure', 'drug_exposure_end_date', 'Drug exposure should have end date', 30.0),

            // Person optional but important fields
            new ValueCompletenessCheck('person', 'person_source_value', 'Person source value should be populated', 5.0),
            new ValueCompletenessCheck('person', 'gender_source_value', 'Gender source value should be populated', 10.0),
        ];
    }

    /**
     * Non-zero concept checks: concept_id fields that should not be 0 (unmapped).
     *
     * @return array<int, NonZeroConceptCheck>
     */
    private static function nonZeroConceptChecks(): array
    {
        return [
            new NonZeroConceptCheck('condition_occurrence', 'condition_concept_id', 'Condition concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('drug_exposure', 'drug_concept_id', 'Drug concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('procedure_occurrence', 'procedure_concept_id', 'Procedure concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('measurement', 'measurement_concept_id', 'Measurement concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('observation', 'observation_concept_id', 'Observation concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('visit_occurrence', 'visit_concept_id', 'Visit concept should not be 0 (unmapped)', 5.0),
            new NonZeroConceptCheck('person', 'gender_concept_id', 'Gender concept should not be 0 (unmapped)', 1.0),
            new NonZeroConceptCheck('person', 'race_concept_id', 'Race concept should not be 0 (unmapped)', 10.0),
            new NonZeroConceptCheck('person', 'ethnicity_concept_id', 'Ethnicity concept should not be 0 (unmapped)', 10.0),
        ];
    }
}
