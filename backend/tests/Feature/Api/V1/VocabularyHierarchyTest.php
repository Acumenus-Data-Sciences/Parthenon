<?php

use App\Http\Controllers\Api\V1\VocabularyController;
use App\Services\Solr\VocabularySearchService;
use Illuminate\Support\Facades\DB;

test('hierarchy filters child and sibling queries to the active domain', function () {
    $controller = new VocabularyController(Mockery::mock(VocabularySearchService::class));
    $connection = Mockery::mock();

    DB::shouldReceive('connection')->with('vocab')->andReturn($connection);

    $connection->shouldReceive('selectOne')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept WHERE concept_id = \?/'), [100])
        ->andReturn((object) [
            'concept_id' => 100,
            'concept_name' => 'Type 2 diabetes mellitus',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
        ]);

    $connection->shouldReceive('selectOne')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept_tree ct/'), [100, 'Condition'])
        ->andReturn((object) [
            'parent_concept_id' => -1,
            'concept_id' => 10,
            'concept_name' => 'Disorder of endocrine system',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
        ]);

    $connection->shouldReceive('selectOne')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept_tree ct/'), [10, 'Condition'])
        ->andReturn(null);

    $connection->shouldReceive('select')
        ->once()
        ->with(
            Mockery::on(fn (string $sql) => str_contains($sql, 'AND c.domain_id = ?') && str_contains($sql, 'WHERE ca.ancestor_concept_id = ?')),
            [100, 'Condition']
        )
        ->andReturn([
            (object) [
                'concept_id' => 101,
                'concept_name' => 'Type 2 diabetes with neuropathy',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_class_id' => 'Clinical Finding',
                'standard_concept' => 'S',
            ],
        ]);

    $connection->shouldReceive('select')
        ->once()
        ->with(
            Mockery::on(fn (string $sql) => str_contains($sql, 'AND c.domain_id = ?') && str_contains($sql, 'ca.descendant_concept_id != ?')),
            [10, 100, 'Condition']
        )
        ->andReturn([
            (object) [
                'concept_id' => 102,
                'concept_name' => 'Type 1 diabetes mellitus',
                'domain_id' => 'Condition',
                'vocabulary_id' => 'SNOMED',
                'concept_class_id' => 'Clinical Finding',
                'standard_concept' => 'S',
            ],
        ]);

    $payload = $controller->hierarchy(100)->getData(true);

    expect($payload['data']['concept_id'])->toBe(10);
    expect($payload['data']['children'][0]['is_current'])->toBeTrue();
    expect($payload['data']['children'][0]['children'][0]['domain_id'])->toBe('Condition');
    expect($payload['data']['children'][1]['domain_id'])->toBe('Condition');
});

test('hierarchy falls back to concept_ancestor when concept_tree has no lineage', function () {
    $controller = new VocabularyController(Mockery::mock(VocabularySearchService::class));
    $connection = Mockery::mock();

    DB::shouldReceive('connection')->with('vocab')->andReturn($connection);

    $connection->shouldReceive('selectOne')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept WHERE concept_id = \?/'), [200])
        ->andReturn((object) [
            'concept_id' => 200,
            'concept_name' => 'Fallback concept',
            'domain_id' => 'Drug',
            'vocabulary_id' => 'RxNorm',
            'concept_class_id' => 'Clinical Drug',
            'standard_concept' => 'S',
        ]);

    $connection->shouldReceive('selectOne')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept_tree ct/'), [200, 'Drug'])
        ->andReturn(null);

    $connection->shouldReceive('select')
        ->once()
        ->with(Mockery::pattern('/FROM vocab\.concept_ancestor ca/'), [200, 'Drug'])
        ->andReturn([
            (object) [
                'concept_id' => 20,
                'concept_name' => 'Antidiabetic agents',
                'domain_id' => 'Drug',
                'vocabulary_id' => 'ATC',
                'concept_class_id' => 'ATC 4th',
                'standard_concept' => 'C',
                'distance' => 1,
            ],
        ]);

    $connection->shouldReceive('select')
        ->once()
        ->with(
            Mockery::on(fn (string $sql) => str_contains($sql, 'AND c.domain_id = ?') && str_contains($sql, 'WHERE ca.ancestor_concept_id = ?')),
            [200, 'Drug']
        )
        ->andReturn([]);

    $connection->shouldReceive('select')
        ->once()
        ->with(
            Mockery::on(fn (string $sql) => str_contains($sql, 'AND c.domain_id = ?') && str_contains($sql, 'ca.descendant_concept_id != ?')),
            [20, 200, 'Drug']
        )
        ->andReturn([]);

    $payload = $controller->hierarchy(200)->getData(true);

    expect($payload['data']['concept_id'])->toBe(20);
    expect($payload['data']['children'][0]['concept_id'])->toBe(200);
    expect($payload['data']['children'][0]['is_current'])->toBeTrue();
});
