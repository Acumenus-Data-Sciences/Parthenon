<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class OmopToFhirService
{
    /** FHIR resource type → CDM table mapping. */
    private const RESOURCE_TABLE_MAP = [
        'Patient' => 'person',
        'Condition' => 'condition_occurrence',
        'Encounter' => 'visit_occurrence',
        'Observation' => 'observation',
        'MedicationStatement' => 'drug_exposure',
        'Procedure' => 'procedure_occurrence',
        'Immunization' => 'drug_exposure',
        'AllergyIntolerance' => 'observation',
    ];

    private string $cdmSchema;

    public function __construct(
        private readonly FhirResourceBuilderFactory $factory,
        private readonly ReverseVocabularyService $vocab,
    ) {
        $this->cdmSchema = config('database.connections.cdm.search_path', 'omop') ?: 'omop';
        $this->cdmSchema = explode(',', $this->cdmSchema)[0];
    }

    /**
     * Search OMOP CDM and return FHIR resources.
     *
     * @param  array<string, mixed>  $params  FHIR search parameters
     * @return array{resources: list<array<string, mixed>>, total: int}
     */
    public function search(string $resourceType, array $params = []): array
    {
        $table = self::RESOURCE_TABLE_MAP[$resourceType] ?? null;
        if (! $table) {
            return ['resources' => [], 'total' => 0];
        }

        $count = (int) ($params['_count'] ?? 20);
        $offset = (int) ($params['_offset'] ?? 0);
        $count = min($count, 100); // Cap at 100

        $query = DB::connection('cdm')->table("{$this->cdmSchema}.{$table}");

        // Apply resource-specific filters
        $this->applyFilters($query, $resourceType, $params);

        $total = $query->count();
        $rows = $query->offset($offset)->limit($count)->get();

        $resources = [];
        foreach ($rows as $row) {
            $resource = $this->buildResource($resourceType, $row);
            if ($resource) {
                $resources[] = $resource;
            }
        }

        return ['resources' => $resources, 'total' => $total];
    }

    /**
     * Read a single OMOP CDM record and return as FHIR resource.
     *
     * @return array<string, mixed>|null
     */
    public function read(string $resourceType, int $id): ?array
    {
        $table = self::RESOURCE_TABLE_MAP[$resourceType] ?? null;
        if (! $table) {
            return null;
        }

        $pkColumn = $this->getPrimaryKey($table);
        $row = DB::connection('cdm')
            ->table("{$this->cdmSchema}.{$table}")
            ->where($pkColumn, $id)
            ->first();

        if (! $row) {
            return null;
        }

        return $this->buildResource($resourceType, $row);
    }

    /**
     * Build a FHIR resource from an OMOP CDM row.
     *
     * @return array<string, mixed>|null
     */
    private function buildResource(string $resourceType, object $row): ?array
    {
        return match ($resourceType) {
            'Patient' => $this->buildPatient($row),
            'Condition' => $this->factory->condition()->build($row),
            'Encounter' => $this->factory->encounter()->build($row),
            'Observation' => $this->factory->observation()->build($row),
            'MedicationStatement' => $this->factory->medication()->build($row),
            'Procedure' => $this->factory->procedure()->build($row),
            'Immunization' => $this->factory->immunization()->build($row),
            'AllergyIntolerance' => $this->factory->allergy()->build($row),
            default => null,
        };
    }

    /**
     * Build Patient with optional death join.
     *
     * @return array<string, mixed>
     */
    private function buildPatient(object $person): array
    {
        $death = DB::connection('cdm')
            ->table("{$this->cdmSchema}.death")
            ->where('person_id', $person->person_id)
            ->first();

        return $this->factory->patient()->build($person, $death);
    }

    /**
     * Apply FHIR search parameter filters to the query.
     *
     * @param  array<string, mixed>  $params
     */
    private function applyFilters(Builder $query, string $resourceType, array $params): void
    {
        // Common: patient filter
        if (isset($params['patient'])) {
            $query->where('person_id', (int) $params['patient']);
        }

        // Common: _id filter
        if (isset($params['_id'])) {
            $pkColumn = $this->getPrimaryKey(self::RESOURCE_TABLE_MAP[$resourceType]);
            $query->where($pkColumn, (int) $params['_id']);
        }

        // Resource-specific filters
        match ($resourceType) {
            'Patient' => $this->applyPatientFilters($query, $params),
            'Condition' => $this->applyConditionFilters($query, $params),
            'Encounter' => $this->applyEncounterFilters($query, $params),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function applyPatientFilters(Builder $query, array $params): void
    {
        if (isset($params['gender'])) {
            $genderMap = ['male' => 8507, 'female' => 8532, 'other' => 44814653, 'unknown' => 8551];
            $conceptId = $genderMap[$params['gender']] ?? null;
            if ($conceptId) {
                $query->where('gender_concept_id', $conceptId);
            }
        }

        if (isset($params['birthdate'])) {
            $query->whereRaw("CAST(CONCAT(year_of_birth, '-', LPAD(COALESCE(month_of_birth, 1)::text, 2, '0'), '-', LPAD(COALESCE(day_of_birth, 1)::text, 2, '0')) AS date) = ?", [$params['birthdate']]);
        }
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function applyConditionFilters(Builder $query, array $params): void
    {
        if (isset($params['code'])) {
            $query->where('condition_source_value', 'like', "%|{$params['code']}");
        }

        if (isset($params['onset-date'])) {
            $query->where('condition_start_date', '>=', $params['onset-date']);
        }
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function applyEncounterFilters(Builder $query, array $params): void
    {
        if (isset($params['class'])) {
            $query->where('visit_source_value', strtoupper($params['class']));
        }

        if (isset($params['date'])) {
            $query->where('visit_start_date', '>=', $params['date']);
        }
    }

    private function getPrimaryKey(string $table): string
    {
        return match ($table) {
            'person' => 'person_id',
            'condition_occurrence' => 'condition_occurrence_id',
            'visit_occurrence' => 'visit_occurrence_id',
            'observation' => 'observation_id',
            'drug_exposure' => 'drug_exposure_id',
            'procedure_occurrence' => 'procedure_occurrence_id',
            'measurement' => 'measurement_id',
            default => 'id',
        };
    }
}
