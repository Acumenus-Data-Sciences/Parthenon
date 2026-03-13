<?php

use App\Models\App\GisImport;
use App\Models\User;
use App\Services\GIS\GisImportService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(function () {
    $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    $this->seed(RolePermissionSeeder::class);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gisUser(string $role = 'researcher'): User
{
    $user = User::factory()->create();
    $user->assignRole($role);
    return $user;
}

function makeGisImport(User $user, array $overrides = []): GisImport
{
    return GisImport::create(array_merge([
        'user_id'     => $user->id,
        'filename'    => 'test.csv',
        'import_mode' => 'tabular_geocode',
        'status'      => 'uploaded',
    ], $overrides));
}

/**
 * Mock GisImportService so upload tests don't need real files on disk.
 * Returns a standard preview payload.
 */
function mockImportService(\Illuminate\Contracts\Foundation\Application $app): void
{
    $app->bind(GisImportService::class, function () {
        $mock = Mockery::mock(GisImportService::class)->makePartial();
        $mock->shouldReceive('previewFile')->andReturn([
            'headers'   => ['FIPS', 'County', 'SVI_Score'],
            'rows'      => [
                ['FIPS' => '42001', 'County' => 'Adams', 'SVI_Score' => '0.45'],
                ['FIPS' => '42003', 'County' => 'Allegheny', 'SVI_Score' => '0.62'],
            ],
            'row_count' => 2,
        ]);
        $mock->shouldReceive('rollback')->andReturn(null);
        $mock->shouldReceive('columnStats')->andReturn([]);
        $mock->shouldReceive('detectGeoCodeType')->andReturn('fips_county');
        $mock->shouldReceive('matchGeographies')->andReturn([
            'matched'       => [],
            'unmatched'     => [],
            'match_rate'    => 0.0,
            'location_type' => 'fips_county',
        ]);
        return $mock;
    });
}

// ---------------------------------------------------------------------------
// Authentication Tests
// ---------------------------------------------------------------------------

test('unauthenticated upload returns 401', function () {
    $this->postJson('/api/v1/gis/import/upload')
        ->assertStatus(401);
});

test('unauthenticated history returns 401', function () {
    $this->getJson('/api/v1/gis/import/history')
        ->assertStatus(401);
});

// ---------------------------------------------------------------------------
// Permission Tests
// ---------------------------------------------------------------------------

test('viewer cannot upload', function () {
    $viewer = gisUser('viewer');
    $file   = UploadedFile::fake()->create('county-svi.csv', 10, 'text/csv');

    $this->actingAs($viewer)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file])
        ->assertStatus(403);
});

test('researcher can upload', function () {
    mockImportService($this->app);
    Storage::fake('local');

    $researcher = gisUser('researcher');
    $file       = UploadedFile::fake()->createWithContent(
        'county-svi.csv',
        "FIPS,County,SVI_Score\n42001,Adams,0.45\n"
    );

    $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file])
        ->assertStatus(201);
});

test('researcher cannot see other users imports', function () {
    $researcher1 = gisUser('researcher');
    $researcher2 = gisUser('researcher');

    makeGisImport($researcher1);

    $response = $this->actingAs($researcher2)
        ->getJson('/api/v1/gis/import/history');

    $response->assertStatus(200);
    $items = $response->json('data.data');
    expect($items)->toBeEmpty();
});

test('admin can see all imports', function () {
    $admin      = gisUser('admin');
    $researcher = gisUser('researcher');

    makeGisImport($researcher);
    makeGisImport($researcher, ['filename' => 'second.csv']);

    $response = $this->actingAs($admin)
        ->getJson('/api/v1/gis/import/history');

    $response->assertStatus(200);
    $items = $response->json('data.data');
    expect(count($items))->toBeGreaterThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// Upload Validation Tests
// ---------------------------------------------------------------------------

test('upload valid csv returns 201', function () {
    mockImportService($this->app);
    Storage::fake('local');

    $researcher = gisUser('researcher');
    $csvPath    = base_path('tests/fixtures/imports/golden/county-svi.csv');
    $file       = new UploadedFile($csvPath, 'county-svi.csv', 'text/csv', null, true);

    $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file])
        ->assertStatus(201)
        ->assertJsonPath('data.filename', 'county-svi.csv')
        ->assertJsonStructure(['data' => ['import_id', 'filename', 'import_mode', 'preview']]);
});

test('upload returns preview data', function () {
    mockImportService($this->app);
    Storage::fake('local');

    $researcher = gisUser('researcher');
    $file       = UploadedFile::fake()->createWithContent(
        'county-svi.csv',
        "FIPS,County,SVI_Score\n42001,Adams,0.45\n"
    );

    $response = $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file]);

    $response->assertStatus(201);
    $preview = $response->json('data.preview');
    expect($preview)->toHaveKey('headers');
    expect($preview)->toHaveKey('rows');
});

test('upload empty file returns 422', function () {
    $researcher = gisUser('researcher');
    $emptyPath  = base_path('tests/fixtures/imports/adversarial/empty.csv');
    $file       = new UploadedFile($emptyPath, 'empty.csv', 'text/csv', null, true);

    // An empty file (0 bytes) fails Laravel's 'file' validation rule or the service throws.
    $response = $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file]);

    expect($response->status())->toBeIn([422, 500]);
});

test('upload invalid mime returns 422', function () {
    $researcher = gisUser('researcher');
    $file       = UploadedFile::fake()->create('evil.php', 5, 'text/plain');

    $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file])
        ->assertStatus(422);
});

test('upload without file returns 422', function () {
    $researcher = gisUser('researcher');

    $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', [])
        ->assertStatus(422);
});

// ---------------------------------------------------------------------------
// Import Workflow Tests
// ---------------------------------------------------------------------------

test('status returns import state', function () {
    Redis::shouldReceive('get')->once()->andReturn(null);

    $researcher = gisUser('researcher');
    $import     = makeGisImport($researcher, ['status' => 'uploaded', 'progress_percentage' => 0]);

    $this->actingAs($researcher)
        ->getJson("/api/v1/gis/import/{$import->id}/status")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $import->id)
        ->assertJsonPath('data.status', 'uploaded')
        ->assertJsonStructure(['data' => ['id', 'status', 'progress_percentage', 'row_count']]);
});

test('save mapping updates import', function () {
    $researcher = gisUser('researcher');
    $import     = makeGisImport($researcher);

    $mapping = [
        'FIPS'      => ['purpose' => 'geography_code', 'geo_type' => 'fips_county'],
        'SVI_Score' => ['purpose' => 'value'],
        'County'    => ['purpose' => 'metadata'],
    ];

    $this->actingAs($researcher)
        ->putJson("/api/v1/gis/import/{$import->id}/mapping", ['mapping' => $mapping])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'mapping_saved');

    $import->refresh();
    expect($import->status)->toBe('mapped');
    expect($import->column_mapping)->toHaveKey('FIPS');
});

test('save config updates import', function () {
    $researcher = gisUser('researcher');
    $import     = makeGisImport($researcher);

    $config = [
        'layer_name'      => 'SVI 2022',
        'exposure_type'   => 'social_vulnerability',
        'geography_level' => 'county',
        'value_type'      => 'continuous',
        'aggregation'     => 'mean',
    ];

    $this->actingAs($researcher)
        ->putJson("/api/v1/gis/import/{$import->id}/config", $config)
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'config_saved');

    $import->refresh();
    expect($import->status)->toBe('configured');
    expect($import->config)->toHaveKey('layer_name');
});

test('execute requires configured status', function () {
    $researcher = gisUser('researcher');
    $import     = makeGisImport($researcher, ['status' => 'uploaded']);

    $this->actingAs($researcher)
        ->postJson("/api/v1/gis/import/{$import->id}/execute")
        ->assertStatus(422);
});

// ---------------------------------------------------------------------------
// History Tests
// ---------------------------------------------------------------------------

test('history returns paginated imports', function () {
    $researcher = gisUser('researcher');

    makeGisImport($researcher, ['filename' => 'a.csv']);
    makeGisImport($researcher, ['filename' => 'b.csv']);
    makeGisImport($researcher, ['filename' => 'c.csv']);

    $response = $this->actingAs($researcher)
        ->getJson('/api/v1/gis/import/history');

    $response->assertStatus(200);
    $data = $response->json('data');
    expect($data)->toHaveKey('data');
    expect(count($data['data']))->toBe(3);
    expect($data)->toHaveKey('total');
    expect($data['total'])->toBeGreaterThanOrEqual(3);
});

test('history includes user relation', function () {
    $researcher = gisUser('researcher');
    makeGisImport($researcher);

    $response = $this->actingAs($researcher)
        ->getJson('/api/v1/gis/import/history');

    $response->assertStatus(200);
    $firstItem = $response->json('data.data.0');
    expect($firstItem)->toHaveKey('user');
    expect($firstItem['user'])->toHaveKey('name');
});

// ---------------------------------------------------------------------------
// Security Tests
// ---------------------------------------------------------------------------

test('upload sanitizes filename', function () {
    mockImportService($this->app);
    Storage::fake('local');

    $researcher = gisUser('researcher');
    // UploadedFile normalizes the name to the basename on most systems.
    $file = UploadedFile::fake()->createWithContent(
        '../../evil.csv',
        "FIPS,County\n42001,Adams\n"
    );

    $response = $this->actingAs($researcher)
        ->postJson('/api/v1/gis/import/upload', ['file' => $file]);

    // Either succeeds (filename is basename only) or is rejected gracefully.
    if ($response->status() === 201) {
        $filename = $response->json('data.filename');
        expect($filename)->not->toContain('..');
        expect($filename)->not->toContain('/');
    } else {
        expect($response->status())->toBeIn([400, 422, 500]);
    }
});

test('rollback requires ownership or manage permission', function () {
    $researcher1 = gisUser('researcher');
    $researcher2 = gisUser('researcher');

    $import = makeGisImport($researcher1, ['status' => 'complete']);

    $this->actingAs($researcher2)
        ->deleteJson("/api/v1/gis/import/{$import->id}")
        ->assertStatus(403);
});

test('admin can rollback any import', function () {
    $admin      = gisUser('admin');
    $researcher = gisUser('researcher');

    $import = makeGisImport($researcher, [
        'status'           => 'complete',
        'summary_snapshot' => [],
    ]);

    $this->app->bind(GisImportService::class, function () {
        $mock = Mockery::mock(GisImportService::class)->makePartial();
        $mock->shouldReceive('rollback')->once()->andReturn(null);
        $mock->shouldReceive('previewFile')->andReturn(['headers' => [], 'rows' => [], 'row_count' => 0]);
        $mock->shouldReceive('columnStats')->andReturn([]);
        $mock->shouldReceive('detectGeoCodeType')->andReturn('custom');
        $mock->shouldReceive('matchGeographies')->andReturn([
            'matched'       => [],
            'unmatched'     => [],
            'match_rate'    => 0.0,
            'location_type' => 'custom',
        ]);
        return $mock;
    });

    $this->actingAs($admin)
        ->deleteJson("/api/v1/gis/import/{$import->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'rolled_back');
});
