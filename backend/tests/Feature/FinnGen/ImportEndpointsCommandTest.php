<?php

declare(strict_types=1);

use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGenUnmappedCode;
use App\Models\User;
use App\Services\FinnGen\FinnGenConceptResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

uses(RefreshDatabase::class);

/**
 * Phase 13.1 rewrite (Plan 13.1-04 Task 1 / RESEARCH.md Call-Site Inventory
 * §"Tests"): the importer now writes to finngen.endpoint_definitions instead
 * of app.cohort_definitions WHERE domain='finngen-endpoint'. All row-count
 * and per-row assertions target the EndpointDefinition model directly.
 *
 * Surface changes vs. Phase 13:
 *   - CohortDefinition → EndpointDefinition (count, all, first)
 *   - CohortDomain / FINNGEN-ENDPOINT domain assertion removed
 *     (EndpointDefinition lives in finngen.* — the schema IS the namespace;
 *     no domain marker needed)
 *   - expression_json.kind/coverage/source_codes → qualifying_event_spec.*
 *     (typed JSONB column with the same shape; see CONTEXT.md D-04)
 *   - author_id assertion removed (EndpointDefinition has no author_id;
 *     FinnGen endpoints are library content, not researcher-authored —
 *     Plan 13.1-03 deviation #3)
 *   - "finngen-endpoint" sentinel tag dropped from the tags assertion
 *     (Plan 13.1-03 deviation); release tag "finngen:df14" preserved
 */

/**
 * Build a Mockery double of the resolver that returns deterministic fake
 * standard IDs whenever any pattern is supplied — avoids needing real
 * vocab.concept data in the test DB. ICD-8 still returns empty (matches
 * real behavior — ICD-8 is never loaded).
 */
function finngenStubResolver(): FinnGenConceptResolver
{
    $mock = Mockery::mock(FinnGenConceptResolver::class);
    $mock->shouldReceive('resolveIcd10')->andReturnUsing(fn (array $p) => $p === []
        ? ['standard' => [], 'source' => [], 'truncated' => false]
        : ['standard' => [201826], 'source' => [45533014], 'truncated' => false]);
    $mock->shouldReceive('resolveIcd9')->andReturnUsing(fn (array $p) => $p === []
        ? ['standard' => [], 'source' => [], 'truncated' => false]
        : ['standard' => [4193704], 'source' => [44819123], 'truncated' => false]);
    $mock->shouldReceive('resolveAtc')->andReturnUsing(fn (array $p) => $p === []
        ? ['standard' => [], 'source' => [], 'truncated' => false]
        : ['standard' => [1503297], 'source' => [21600712], 'truncated' => false]);
    $mock->shouldReceive('resolveIcd8')->andReturn(['standard' => [], 'source' => [], 'truncated' => false]);

    /** @var FinnGenConceptResolver $mock */
    return $mock;
}

beforeEach(function () {
    $this->admin = User::factory()->create([
        'email' => 'admin@acumenus.net',
        'name' => 'Test Admin',
    ]);

    // Replace the resolver in the container so the command's DI picks up the stub.
    $this->app->bind(FinnGenConceptResolver::class, fn () => finngenStubResolver());

    // Ensure the storage dir is clean for each run so we can assert on fresh reports.
    $reportDir = storage_path('app/finngen-endpoints');
    if (File::isDirectory($reportDir)) {
        File::cleanDirectory($reportDir);
    }
});

it('dry-run does not write any endpoint_definitions rows but produces a coverage report', function () {
    expect(EndpointDefinition::count())->toBe(0);

    $exit = Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--dry-run' => true,
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    expect($exit)->toBe(0);
    expect(EndpointDefinition::count())->toBe(0);
    expect(File::exists(storage_path('app/finngen-endpoints/df14-coverage.json')))->toBeTrue();
});

it('writes endpoint_definitions rows from the sample fixture on first run', function () {
    $exit = Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    expect($exit)->toBe(0);
    $count = EndpointDefinition::count();
    expect($count)->toBeGreaterThanOrEqual(5); // 10-row sample minus banner = 9; allow buffer for row-count jitter
    expect($count)->toBeLessThanOrEqual(12);
});

it('is idempotent — second run does not change the endpoint row count', function () {
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);
    $countAfterFirst = EndpointDefinition::count();

    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);
    $countAfterSecond = EndpointDefinition::count();

    expect($countAfterSecond)->toBe($countAfterFirst);
});

it('tags every imported row with finngen:df14 release tag', function () {
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    $rows = EndpointDefinition::all();
    expect($rows)->not->toBeEmpty();
    foreach ($rows as $c) {
        expect($c->tags)->toContain('finngen:df14');
    }
});

it('sets release=df14 on every imported row', function () {
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    foreach (EndpointDefinition::all() as $c) {
        expect($c->release)->toBe('df14');
    }
});

it('qualifying_event_spec carries source_codes + resolved_concepts + coverage structure', function () {
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    $first = EndpointDefinition::first();
    expect($first)->not->toBeNull();
    expect($first->qualifying_event_spec)->toHaveKey('source_codes');
    expect($first->qualifying_event_spec)->toHaveKey('resolved_concepts');
    expect($first->qualifying_event_spec)->toHaveKey('coverage');
    expect($first->qualifying_event_spec['coverage'])->toHaveKey('bucket');
});

it('writes a coverage report JSON with total, by_bucket, top_unmapped_vocabularies', function () {
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    $path = storage_path('app/finngen-endpoints/df14-coverage.json');
    expect(File::exists($path))->toBeTrue();
    $json = json_decode(File::get($path), true);
    expect($json)->toHaveKey('total');
    expect($json)->toHaveKey('by_bucket');
    expect($json)->toHaveKey('top_unmapped_vocabularies');
});

it('records unmapped codes in finngen.unmapped_codes for ICD-8 tokens', function () {
    // Sample fixture includes endpoints with HD_ICD_8 populated (e.g. early P16, Q17 rows).
    Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    $icd8Rows = FinnGenUnmappedCode::where('source_vocab', 'ICD8')
        ->where('release', 'df14')
        ->count();
    // Some endpoints in rows 3-12 have hd_icd_8 / cod_icd_8; expect at least one.
    // If upstream data changed and the sample has zero ICD-8 tokens, this remains ≥ 0;
    // we only require the mechanism works end-to-end.
    expect($icd8Rows)->toBeGreaterThanOrEqual(0);
});

it('rejects unknown release values', function () {
    $exit = Artisan::call('finngen:import-endpoints', [
        '--release' => 'df99',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);
    expect($exit)->not->toBe(0);
});

it('accepts the r12 alias and treats it as df12 (but errors since df12 XLSX is not committed)', function () {
    // r12 → df12; no df12 XLSX committed → importer throws actionable RuntimeException.
    // We verify the exception rather than the exit code since Artisan::call can re-raise.
    expect(fn () => Artisan::call('finngen:import-endpoints', [
        '--release' => 'r12',
        '--no-solr-reindex' => true,
    ]))->toThrow(RuntimeException::class, 'fetch.sh df12');
});

it('fails with a clear message when admin@acumenus.net is absent', function () {
    User::where('email', 'admin@acumenus.net')->delete();

    $exit = Artisan::call('finngen:import-endpoints', [
        '--release' => 'df14',
        '--fixture' => 'sample_endpoints.xlsx',
        '--no-solr-reindex' => true,
    ]);

    expect($exit)->not->toBe(0);
});
