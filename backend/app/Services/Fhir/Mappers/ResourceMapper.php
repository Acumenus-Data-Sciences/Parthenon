<?php

namespace App\Services\Fhir\Mappers;

interface ResourceMapper
{
    /** The FHIR resourceType this maps, e.g. 'CarePlan'. */
    public function resourceType(): string;

    /** @return list<array{cdm_table: string, data: array<string, mixed>}> */
    public function map(array $resource, string $siteKey): array;
}
