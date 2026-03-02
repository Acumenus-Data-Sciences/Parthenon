<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Contracts\DqdCheckInterface;

class PlausibilityCheckFactory
{
    /**
     * Create all plausibility checks.
     *
     * @return array<int, DqdCheckInterface>
     */
    public static function create(): array
    {
        return array_merge(
            self::noFutureDateChecks(),
            self::ageRangeChecks(),
            self::observationPeriodBoundsChecks(),
            self::positiveValueChecks(),
            self::eventAfterBirthChecks(),
            self::eventAfterDeathChecks(),
            self::genderSpecificChecks(),
        );
    }

    /**
     * No future date checks: dates should not be in the future.
     *
     * @return array<int, NoFutureDateCheck>
     */
    private static function noFutureDateChecks(): array
    {
        return [
            new NoFutureDateCheck('condition_occurrence', 'condition_start_date', 'Condition start date should not be in the future'),
            new NoFutureDateCheck('condition_occurrence', 'condition_end_date', 'Condition end date should not be in the future', 1.0),
            new NoFutureDateCheck('drug_exposure', 'drug_exposure_start_date', 'Drug exposure start date should not be in the future'),
            new NoFutureDateCheck('drug_exposure', 'drug_exposure_end_date', 'Drug exposure end date should not be in the future', 1.0),
            new NoFutureDateCheck('procedure_occurrence', 'procedure_date', 'Procedure date should not be in the future'),
            new NoFutureDateCheck('measurement', 'measurement_date', 'Measurement date should not be in the future'),
            new NoFutureDateCheck('observation', 'observation_date', 'Observation date should not be in the future'),
            new NoFutureDateCheck('visit_occurrence', 'visit_start_date', 'Visit start date should not be in the future'),
            new NoFutureDateCheck('visit_occurrence', 'visit_end_date', 'Visit end date should not be in the future', 1.0),
            new NoFutureDateCheck('observation_period', 'observation_period_start_date', 'Observation period start date should not be in the future'),
            new NoFutureDateCheck('death', 'death_date', 'Death date should not be in the future'),
            new NoFutureDateCheck('device_exposure', 'device_exposure_start_date', 'Device exposure start date should not be in the future'),
        ];
    }

    /**
     * Age range check: person age must be 0-130.
     *
     * @return array<int, AgeRangeCheck>
     */
    private static function ageRangeChecks(): array
    {
        return [
            new AgeRangeCheck,
        ];
    }

    /**
     * Observation period bounds: events should fall within an observation period.
     *
     * @return array<int, ObservationPeriodBoundsCheck>
     */
    private static function observationPeriodBoundsChecks(): array
    {
        return [
            new ObservationPeriodBoundsCheck('condition_occurrence', 'condition_start_date', 'Conditions should fall within an observation period'),
            new ObservationPeriodBoundsCheck('drug_exposure', 'drug_exposure_start_date', 'Drug exposures should fall within an observation period'),
            new ObservationPeriodBoundsCheck('procedure_occurrence', 'procedure_date', 'Procedures should fall within an observation period'),
            new ObservationPeriodBoundsCheck('measurement', 'measurement_date', 'Measurements should fall within an observation period'),
            new ObservationPeriodBoundsCheck('observation', 'observation_date', 'Observations should fall within an observation period'),
            new ObservationPeriodBoundsCheck('visit_occurrence', 'visit_start_date', 'Visits should fall within an observation period'),
        ];
    }

    /**
     * Positive value checks: numeric values that should be positive.
     *
     * @return array<int, PositiveValueCheck>
     */
    private static function positiveValueChecks(): array
    {
        return [
            new PositiveValueCheck('measurement', 'value_as_number', 'Measurement value should be positive when present', 5.0),
            new PositiveValueCheck('drug_exposure', 'quantity', 'Drug quantity should be positive when present', 1.0),
            new PositiveValueCheck('drug_exposure', 'days_supply', 'Drug days_supply should be positive when present', 1.0),
            new PositiveValueCheck('drug_exposure', 'refills', 'Drug refills should be positive when present', 5.0),
        ];
    }

    /**
     * Event after birth checks: events should not occur before person was born.
     *
     * @return array<int, EventAfterBirthCheck>
     */
    private static function eventAfterBirthChecks(): array
    {
        return [
            new EventAfterBirthCheck('condition_occurrence', 'condition_start_date', 'Conditions should not occur before person birth year'),
            new EventAfterBirthCheck('drug_exposure', 'drug_exposure_start_date', 'Drug exposures should not occur before person birth year'),
            new EventAfterBirthCheck('procedure_occurrence', 'procedure_date', 'Procedures should not occur before person birth year'),
            new EventAfterBirthCheck('measurement', 'measurement_date', 'Measurements should not occur before person birth year'),
            new EventAfterBirthCheck('observation', 'observation_date', 'Observations should not occur before person birth year'),
            new EventAfterBirthCheck('visit_occurrence', 'visit_start_date', 'Visits should not occur before person birth year'),
        ];
    }

    /**
     * Event after death checks: events should not occur after person has died.
     *
     * @return array<int, EventAfterDeathCheck>
     */
    private static function eventAfterDeathChecks(): array
    {
        return [
            new EventAfterDeathCheck('condition_occurrence', 'condition_start_date', 'Conditions should not occur after person death date'),
            new EventAfterDeathCheck('drug_exposure', 'drug_exposure_start_date', 'Drug exposures should not occur after person death date'),
            new EventAfterDeathCheck('procedure_occurrence', 'procedure_date', 'Procedures should not occur after person death date'),
            new EventAfterDeathCheck('measurement', 'measurement_date', 'Measurements should not occur after person death date'),
            new EventAfterDeathCheck('observation', 'observation_date', 'Observations should not occur after person death date'),
            new EventAfterDeathCheck('visit_occurrence', 'visit_start_date', 'Visits should not occur after person death date'),
        ];
    }

    /**
     * Gender-specific checks: certain conditions/procedures should not appear in wrong gender.
     *
     * @return array<int, GenderSpecificCheck>
     */
    private static function genderSpecificChecks(): array
    {
        // 8507 = Male, 8532 = Female
        return [
            new GenderSpecificCheck('condition_occurrence', 'condition_concept_id', 8507, 'male', 'Female Disease', 'Female-specific conditions should not appear in male patients'),
            new GenderSpecificCheck('condition_occurrence', 'condition_concept_id', 8532, 'female', 'Male Disease', 'Male-specific conditions should not appear in female patients'),
            new GenderSpecificCheck('procedure_occurrence', 'procedure_concept_id', 8507, 'male', 'Female Procedure', 'Female-specific procedures should not appear in male patients'),
            new GenderSpecificCheck('procedure_occurrence', 'procedure_concept_id', 8532, 'female', 'Male Procedure', 'Male-specific procedures should not appear in female patients'),
        ];
    }
}
