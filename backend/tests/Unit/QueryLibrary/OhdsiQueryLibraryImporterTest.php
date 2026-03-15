<?php

use App\Services\QueryLibrary\OhdsiQueryLibraryImporter;

it('parses ohdsi markdown queries into query library entries', function () {
    $importer = new OhdsiQueryLibraryImporter;
    $entry = $importer->parseMarkdownFile(__DIR__.'/../../Fixtures/query-library/sample-query.md');

    expect($entry)->not->toBeNull();
    expect($entry['name'])->toBe('C01 Find condition by concept ID');
    expect($entry['domain'])->toBe('query_library');
    expect($entry['source'])->toBe('ohdsi_querylibrary');
    expect($entry['sql_template'])->toContain('{@vocabSchema}.concept');
    expect($entry['sql_template'])->toContain('{@cdmSchema}.condition_occurrence');
    expect($entry['sql_template'])->toContain('{@conceptId}');
    expect($entry['parameters_json'])->toBeArray();
    expect(collect($entry['parameters_json'])->pluck('key')->all())->toBe([
        'cdmSchema',
        'vocabSchema',
        'conceptId',
    ]);
});
