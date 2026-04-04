<?php

use App\Services\Vocabulary\HierarchyBuilderService;

test('vocabulary:build-hierarchy rejects unsupported domains', function () {
    $service = Mockery::mock(HierarchyBuilderService::class);
    $service->shouldNotReceive('ensureConceptTreeTableExists');

    $this->app->instance(HierarchyBuilderService::class, $service);

    $this->artisan('vocabulary:build-hierarchy --domain=BadDomain')
        ->expectsOutputToContain('Unsupported domain "BadDomain"')
        ->assertExitCode(1);
});

test('vocabulary:build-hierarchy fails clearly when concept_tree is missing', function () {
    $service = Mockery::mock(HierarchyBuilderService::class);
    $service->shouldReceive('ensureConceptTreeTableExists')
        ->once()
        ->andThrow(new RuntimeException('Missing vocab.concept_tree. Create the table before running vocabulary:build-hierarchy.'));
    $service->shouldNotReceive('clearConceptTree');
    $service->shouldNotReceive('buildAll');

    $this->app->instance(HierarchyBuilderService::class, $service);

    $this->artisan('vocabulary:build-hierarchy')
        ->expectsOutputToContain('Missing vocab.concept_tree.')
        ->assertExitCode(1);
});

test('vocabulary:build-hierarchy clears and builds a single domain', function () {
    $service = Mockery::mock(HierarchyBuilderService::class);
    $service->shouldReceive('ensureConceptTreeTableExists')->once();
    $service->shouldReceive('clearConceptTree')->once();
    $service->shouldReceive('buildDomain')->with('Condition')->once()->andReturn(42);
    $service->shouldNotReceive('buildAll');
    $service->shouldNotReceive('populateResultsSchemas');

    $this->app->instance(HierarchyBuilderService::class, $service);

    $this->artisan('vocabulary:build-hierarchy --domain=Condition --fresh')
        ->assertExitCode(0);
});

test('vocabulary:build-hierarchy can populate results after a full build', function () {
    $service = Mockery::mock(HierarchyBuilderService::class);
    $service->shouldReceive('ensureConceptTreeTableExists')->once();
    $service->shouldReceive('buildAll')->once()->andReturn(['Condition' => 10, 'Drug' => 12]);
    $service->shouldReceive('populateResultsSchemas')->once()->andReturn(['results' => 99]);
    $service->shouldNotReceive('clearConceptTree');

    $this->app->instance(HierarchyBuilderService::class, $service);

    $this->artisan('vocabulary:build-hierarchy --populate-results')
        ->assertExitCode(0);
});
