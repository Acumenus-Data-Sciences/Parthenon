<?php

use App\Services\Fhir\FhirBulkMapper;
use App\Services\Fhir\Mappers\ResourceMapper;

it('dispatches an unknown-to-the-match resource type to a registered mapper', function () {
    $stub = new class implements ResourceMapper
    {
        public function resourceType(): string
        {
            return 'CarePlan';
        }

        public function map(array $resource, string $siteKey): array
        {
            return [['cdm_table' => 'care_plan', 'data' => ['x' => 1]]];
        }
    };
    $mapper = app(FhirBulkMapper::class);
    $mapper->registerMapper($stub);

    $rows = $mapper->mapResource(['resourceType' => 'CarePlan', 'id' => 'cp1'], 'site');

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['cdm_table'])->toBe('care_plan')
        ->and($rows[0]['fhir_resource_type'])->toBe('CarePlan')
        ->and($rows[0]['fhir_resource_id'])->toBe('cp1');
});
