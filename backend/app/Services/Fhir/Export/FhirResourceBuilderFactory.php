<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use App\Services\Fhir\Export\Builders\ConditionBuilder;
use App\Services\Fhir\Export\Builders\EncounterBuilder;
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

    /**
     * Get builder by CDM table name.
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
}
