<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use App\Services\Fhir\Export\Builders\AllergyBuilder;
use App\Services\Fhir\Export\Builders\ConditionBuilder;
use App\Services\Fhir\Export\Builders\EncounterBuilder;
use App\Services\Fhir\Export\Builders\ImmunizationBuilder;
use App\Services\Fhir\Export\Builders\MeasurementBuilder;
use App\Services\Fhir\Export\Builders\MedicationBuilder;
use App\Services\Fhir\Export\Builders\ObservationBuilder;
use App\Services\Fhir\Export\Builders\PatientBuilder;
use App\Services\Fhir\Export\Builders\ProcedureBuilder;

class FhirResourceBuilderFactory
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function patient(): PatientBuilder
    {
        return new PatientBuilder($this->vocab);
    }

    public function condition(): ConditionBuilder
    {
        return new ConditionBuilder($this->vocab);
    }

    public function encounter(): EncounterBuilder
    {
        return new EncounterBuilder($this->vocab);
    }

    public function observation(): ObservationBuilder
    {
        return new ObservationBuilder($this->vocab);
    }

    public function measurement(): MeasurementBuilder
    {
        return new MeasurementBuilder($this->vocab);
    }

    public function medication(): MedicationBuilder
    {
        return new MedicationBuilder($this->vocab);
    }

    public function procedure(): ProcedureBuilder
    {
        return new ProcedureBuilder($this->vocab);
    }

    public function immunization(): ImmunizationBuilder
    {
        return new ImmunizationBuilder($this->vocab);
    }

    public function allergy(): AllergyBuilder
    {
        return new AllergyBuilder($this->vocab);
    }

    /**
     * Get builder by CDM table name.
     * Note: immunization and allergy share tables with other resources;
     * use forResourceType() when the FHIR resource type is known.
     */
    public function forTable(string $cdmTable): ?object
    {
        return match ($cdmTable) {
            'person' => $this->patient(),
            'condition_occurrence' => $this->condition(),
            'visit_occurrence' => $this->encounter(),
            'observation' => $this->observation(),
            'measurement' => $this->measurement(),
            'drug_exposure' => $this->medication(),
            'procedure_occurrence' => $this->procedure(),
            default => null,
        };
    }

    /**
     * Get builder by FHIR resource type name.
     */
    public function forResourceType(string $resourceType): ?object
    {
        return match ($resourceType) {
            'Patient' => $this->patient(),
            'Condition' => $this->condition(),
            'Encounter' => $this->encounter(),
            'Observation' => $this->observation(),
            'MedicationStatement' => $this->medication(),
            'Procedure' => $this->procedure(),
            'Immunization' => $this->immunization(),
            'AllergyIntolerance' => $this->allergy(),
            default => null,
        };
    }
}
