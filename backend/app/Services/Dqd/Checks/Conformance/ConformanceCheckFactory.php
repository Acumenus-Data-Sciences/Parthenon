<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Contracts\DqdCheckInterface;

class ConformanceCheckFactory
{
    /**
     * Create all conformance checks.
     *
     * @return array<int, DqdCheckInterface>
     */
    public static function create(): array
    {
        return array_merge(
            self::conceptIdValidChecks(),
            self::domainConformanceChecks(),
            self::foreignKeyChecks(),
            self::dateValidityChecks(),
            self::standardConceptChecks(),
            self::typeConceptValidChecks(),
        );
    }

    /**
     * Concept ID validity: non-zero concept_id values must exist in vocab.concept.
     *
     * @return array<int, ConceptIdValidCheck>
     */
    private static function conceptIdValidChecks(): array
    {
        return [
            new ConceptIdValidCheck('condition_occurrence', 'condition_concept_id', 'Condition concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('drug_exposure', 'drug_concept_id', 'Drug concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('procedure_occurrence', 'procedure_concept_id', 'Procedure concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('measurement', 'measurement_concept_id', 'Measurement concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('observation', 'observation_concept_id', 'Observation concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('visit_occurrence', 'visit_concept_id', 'Visit concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('person', 'gender_concept_id', 'Gender concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('person', 'race_concept_id', 'Race concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('person', 'ethnicity_concept_id', 'Ethnicity concept_id must exist in vocabulary'),
            new ConceptIdValidCheck('device_exposure', 'device_concept_id', 'Device concept_id must exist in vocabulary'),
        ];
    }

    /**
     * Domain conformance: concept domain_id should match the table where the concept is used.
     *
     * @return array<int, DomainConformanceCheck>
     */
    private static function domainConformanceChecks(): array
    {
        return [
            new DomainConformanceCheck('condition_occurrence', 'condition_concept_id', 'Condition', 'Condition concepts should belong to the Condition domain'),
            new DomainConformanceCheck('drug_exposure', 'drug_concept_id', 'Drug', 'Drug concepts should belong to the Drug domain'),
            new DomainConformanceCheck('procedure_occurrence', 'procedure_concept_id', 'Procedure', 'Procedure concepts should belong to the Procedure domain'),
            new DomainConformanceCheck('measurement', 'measurement_concept_id', 'Measurement', 'Measurement concepts should belong to the Measurement domain'),
            new DomainConformanceCheck('observation', 'observation_concept_id', 'Observation', 'Observation concepts should belong to the Observation domain'),
            new DomainConformanceCheck('device_exposure', 'device_concept_id', 'Device', 'Device concepts should belong to the Device domain'),
            new DomainConformanceCheck('person', 'gender_concept_id', 'Gender', 'Gender concepts should belong to the Gender domain'),
            new DomainConformanceCheck('person', 'race_concept_id', 'Race', 'Race concepts should belong to the Race domain'),
            new DomainConformanceCheck('person', 'ethnicity_concept_id', 'Ethnicity', 'Ethnicity concepts should belong to the Ethnicity domain'),
        ];
    }

    /**
     * Foreign key checks: FK columns reference valid records in the target table.
     *
     * @return array<int, ForeignKeyCheck>
     */
    private static function foreignKeyChecks(): array
    {
        return [
            // person_id FK in event tables
            new ForeignKeyCheck('condition_occurrence', 'person_id', 'person', 'person_id', false, 'Condition person_id must reference a valid person'),
            new ForeignKeyCheck('drug_exposure', 'person_id', 'person', 'person_id', false, 'Drug exposure person_id must reference a valid person'),
            new ForeignKeyCheck('procedure_occurrence', 'person_id', 'person', 'person_id', false, 'Procedure person_id must reference a valid person'),
            new ForeignKeyCheck('measurement', 'person_id', 'person', 'person_id', false, 'Measurement person_id must reference a valid person'),
            new ForeignKeyCheck('observation', 'person_id', 'person', 'person_id', false, 'Observation person_id must reference a valid person'),
            new ForeignKeyCheck('visit_occurrence', 'person_id', 'person', 'person_id', false, 'Visit person_id must reference a valid person'),
            new ForeignKeyCheck('observation_period', 'person_id', 'person', 'person_id', false, 'Observation period person_id must reference a valid person'),
            new ForeignKeyCheck('death', 'person_id', 'person', 'person_id', false, 'Death person_id must reference a valid person'),
            new ForeignKeyCheck('device_exposure', 'person_id', 'person', 'person_id', false, 'Device exposure person_id must reference a valid person'),

            // visit_occurrence_id FK in event tables (nullable)
            new ForeignKeyCheck('condition_occurrence', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Condition visit_occurrence_id must reference a valid visit'),
            new ForeignKeyCheck('drug_exposure', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Drug visit_occurrence_id must reference a valid visit'),
            new ForeignKeyCheck('procedure_occurrence', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Procedure visit_occurrence_id must reference a valid visit'),
            new ForeignKeyCheck('measurement', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Measurement visit_occurrence_id must reference a valid visit'),
            new ForeignKeyCheck('observation', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Observation visit_occurrence_id must reference a valid visit'),
            new ForeignKeyCheck('device_exposure', 'visit_occurrence_id', 'visit_occurrence', 'visit_occurrence_id', true, 'Device exposure visit_occurrence_id must reference a valid visit'),
        ];
    }

    /**
     * Date validity checks: start_date should not be after end_date.
     *
     * @return array<int, DateValidityCheck>
     */
    private static function dateValidityChecks(): array
    {
        return [
            new DateValidityCheck('visit_occurrence', 'visit_start_date', 'visit_end_date', 'Visit start date must not be after end date'),
            new DateValidityCheck('condition_occurrence', 'condition_start_date', 'condition_end_date', 'Condition start date must not be after end date'),
            new DateValidityCheck('drug_exposure', 'drug_exposure_start_date', 'drug_exposure_end_date', 'Drug exposure start date must not be after end date'),
            new DateValidityCheck('device_exposure', 'device_exposure_start_date', 'device_exposure_end_date', 'Device exposure start date must not be after end date'),
            new DateValidityCheck('observation_period', 'observation_period_start_date', 'observation_period_end_date', 'Observation period start date must not be after end date'),
        ];
    }

    /**
     * Standard concept checks: primary concept_id columns should use standard concepts.
     *
     * @return array<int, StandardConceptCheck>
     */
    private static function standardConceptChecks(): array
    {
        return [
            new StandardConceptCheck('condition_occurrence', 'condition_concept_id', 'Condition concept should be a standard concept'),
            new StandardConceptCheck('drug_exposure', 'drug_concept_id', 'Drug concept should be a standard concept'),
            new StandardConceptCheck('procedure_occurrence', 'procedure_concept_id', 'Procedure concept should be a standard concept'),
            new StandardConceptCheck('measurement', 'measurement_concept_id', 'Measurement concept should be a standard concept'),
            new StandardConceptCheck('observation', 'observation_concept_id', 'Observation concept should be a standard concept'),
            new StandardConceptCheck('visit_occurrence', 'visit_concept_id', 'Visit concept should be a standard concept'),
        ];
    }

    /**
     * Type concept validity: type_concept_id columns should reference valid concepts.
     *
     * @return array<int, TypeConceptValidCheck>
     */
    private static function typeConceptValidChecks(): array
    {
        return [
            new TypeConceptValidCheck('condition_occurrence', 'condition_type_concept_id', 'Condition type concept must exist in vocabulary'),
            new TypeConceptValidCheck('drug_exposure', 'drug_type_concept_id', 'Drug type concept must exist in vocabulary'),
            new TypeConceptValidCheck('procedure_occurrence', 'procedure_type_concept_id', 'Procedure type concept must exist in vocabulary'),
            new TypeConceptValidCheck('measurement', 'measurement_type_concept_id', 'Measurement type concept must exist in vocabulary'),
            new TypeConceptValidCheck('observation', 'observation_type_concept_id', 'Observation type concept must exist in vocabulary'),
            new TypeConceptValidCheck('visit_occurrence', 'visit_type_concept_id', 'Visit type concept must exist in vocabulary'),
            new TypeConceptValidCheck('observation_period', 'period_type_concept_id', 'Period type concept must exist in vocabulary'),
            new TypeConceptValidCheck('death', 'death_type_concept_id', 'Death type concept must exist in vocabulary'),
            new TypeConceptValidCheck('device_exposure', 'device_type_concept_id', 'Device type concept must exist in vocabulary'),
        ];
    }
}
