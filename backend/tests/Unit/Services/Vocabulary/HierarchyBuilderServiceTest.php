<?php

use App\Services\Vocabulary\HierarchyBuilderService;

test('populateResultsSchema rejects invalid schema identifiers', function () {
    $service = new HierarchyBuilderService;

    expect(fn () => $service->populateResultsSchema('bad-schema;drop table'))
        ->toThrow(InvalidArgumentException::class, 'Invalid SQL identifier');
});

test('supportedDomains returns the full allowed domain list', function () {
    expect(HierarchyBuilderService::supportedDomains())
        ->toBe(['Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Visit']);
});
