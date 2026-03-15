<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['design_fixtures.path' => sys_get_temp_dir().'/parthenon-import-test-'.uniqid()]);
    mkdir(config('design_fixtures.path'), 0755, true);
    mkdir(config('design_fixtures.path').'/cohort_definitions', 0755, true);
    mkdir(config('design_fixtures.path').'/concept_sets', 0755, true);
});

afterEach(function () {
    $path = config('design_fixtures.path');
    if (is_dir($path)) {
        $it = new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($path);
    }
});

function writeFixture(string $entityType, array $data): void
{
    $dir = config('design_fixtures.path')."/{$entityType}";
    if (! is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $slug = strtolower((string) preg_replace('/[^a-z0-9]/i', '-', $data['name']));
    file_put_contents("{$dir}/{$slug}.json", json_encode($data));
}

it('imports a cohort definition from fixture files', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id' => 99,
        'name' => 'Imported Cohort',
        'description' => 'Imported from fixture',
        'expression_json' => ['PrimaryCriteria' => []],
        'author_id' => $admin->id,
        'is_public' => true,
        'version' => 1,
        'tags' => ['imported'],
        'deleted_at' => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $this->assertDatabaseHas('cohort_definitions', ['name' => 'Imported Cohort']);
});

it('is idempotent — running twice does not duplicate rows', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id' => 99,
        'name' => 'Idempotent Cohort',
        'expression_json' => [],
        'author_id' => $admin->id,
        'is_public' => false,
        'version' => 1,
        'tags' => null,
        'deleted_at' => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();
    $this->artisan('parthenon:import-designs')->assertSuccessful();

    expect(CohortDefinition::where('name', 'Idempotent Cohort')->count())->toBe(1);
});

it('remaps author_id to admin when original author is missing', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id' => 99,
        'name' => 'Orphaned Cohort',
        'expression_json' => [],
        'author_id' => 99999, // non-existent user
        'is_public' => false,
        'version' => 1,
        'tags' => null,
        'deleted_at' => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $cohort = CohortDefinition::where('name', 'Orphaned Cohort')->first();
    expect($cohort)->not->toBeNull()
        ->and($cohort->author_id)->toBe($admin->id);
});

it('imports concept set items from nested items array', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('concept_sets', [
        'id' => 50,
        'name' => 'Metformin Drugs',
        'description' => 'Metformin ingredients',
        'author_id' => $admin->id,
        'is_public' => true,
        'tags' => null,
        'deleted_at' => null,
        'items' => [
            ['concept_id' => 1503297, 'is_excluded' => false, 'include_descendants' => true, 'include_mapped' => false],
        ],
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $cs = ConceptSet::where('name', 'Metformin Drugs')->first();
    expect($cs)->not->toBeNull();
    expect(ConceptSetItem::where('concept_set_id', $cs->id)->count())->toBe(1);
    expect(ConceptSetItem::where('concept_set_id', $cs->id)->first()->concept_id)->toBe(1503297);
});

it('fails with clear message when admin user is missing', function () {
    // No admin@acumenus.net user created

    writeFixture('cohort_definitions', [
        'id' => 1, 'name' => 'Test', 'expression_json' => [], 'author_id' => 1,
        'is_public' => false, 'version' => 1, 'tags' => null, 'deleted_at' => null,
    ]);

    $this->artisan('parthenon:import-designs')
        ->expectsOutputToContain('Admin user admin@acumenus.net not found')
        ->assertFailed();
});
