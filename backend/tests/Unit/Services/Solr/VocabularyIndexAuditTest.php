<?php

use App\Services\Solr\VocabularyIndexAudit;

function expectedSolrConcept(int $id = 1): array
{
    return [
        'concept_id' => (string) $id,
        'concept_name' => 'Example concept',
        'concept_code' => 'EXAMPLE',
        'domain_id' => 'Observation',
        'vocabulary_id' => 'IRSF-NHS',
        'concept_class_id' => 'IRSF Clinical',
        'standard_concept' => 'S',
        'invalid_reason' => '',
        'valid_start_date' => '2025-01-01T00:00:00Z',
        'valid_end_date' => '2099-12-31T00:00:00Z',
    ];
}

it('requires exact counts and rejects both missing and surplus documents', function () {
    $audit = new VocabularyIndexAudit;

    expect($audit->countsMatch(100, 100))->toBeTrue()
        ->and($audit->countsMatch(100, 99))->toBeFalse()
        ->and($audit->countsMatch(100, 101))->toBeFalse();
});

it('reports missing and unexpected documents', function () {
    $audit = new VocabularyIndexAudit;
    $expected = [expectedSolrConcept(1), expectedSolrConcept(2)];
    $actual = [expectedSolrConcept(1), expectedSolrConcept(3)];

    $result = $audit->compareBatch($expected, $actual);

    expect($result['missing_ids'])->toBe([2])
        ->and($result['unexpected_ids'])->toBe([3])
        ->and($result['stale_fields'])->toBe([]);
});

it('reports stale standard validity and descriptive fields', function () {
    $audit = new VocabularyIndexAudit;
    $expected = expectedSolrConcept();
    $actual = $expected;
    $actual['concept_name'] = 'Stale name';
    $actual['standard_concept'] = '';
    $actual['invalid_reason'] = 'D';
    $actual['valid_end_date'] = '2026-01-01T00:00:00Z';

    $result = $audit->compareBatch([$expected], [$actual]);

    expect($result['stale_fields'][1])->toBe([
        'concept_name',
        'standard_concept',
        'invalid_reason',
        'valid_end_date',
    ]);
});

it('normalizes PostgreSQL dates and nullable flags to the indexed contract', function () {
    $audit = new VocabularyIndexAudit;

    $document = $audit->expectedDocument([
        'concept_id' => 10,
        'standard_concept' => null,
        'invalid_reason' => null,
        'valid_start_date' => '2026-02-27',
        'valid_end_date' => '2099-12-31',
    ]);

    expect($document['concept_id'])->toBe('10')
        ->and($document['standard_concept'])->toBe('')
        ->and($document['invalid_reason'])->toBe('')
        ->and($document['valid_start_date'])->toBe('2026-02-27T00:00:00Z')
        ->and($document['valid_end_date'])->toBe('2099-12-31T00:00:00Z');
});
