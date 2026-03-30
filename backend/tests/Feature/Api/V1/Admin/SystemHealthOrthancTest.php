<?php

use App\Models\App\PacsConnection;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function () {
    /** @var TestCase $this */
    $this->seed(RolePermissionSeeder::class);
});

function orthancAdminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

function createDefaultOrthancConnection(): PacsConnection
{
    return PacsConnection::create([
        'name' => 'Local Orthanc',
        'type' => 'orthanc',
        'base_url' => 'http://orthanc:8042/dicom-web',
        'auth_type' => 'basic',
        'credentials' => [
            'username' => 'parthenon',
            'password' => 'orthanc_secret',
        ],
        'is_default' => true,
        'is_active' => true,
    ]);
}

test('orthanc health falls back to localhost when docker hostname is unreachable', function () {
    /** @var TestCase $this */
    createDefaultOrthancConnection();

    Http::fake([
        'http://orthanc:8042/statistics' => Http::failedConnection(),
        'http://127.0.0.1:8042/statistics' => Http::response([
            'CountStudies' => 12,
            'CountInstances' => 345,
            'CountSeries' => 34,
            'CountPatients' => 10,
            'TotalDiskSizeMB' => 512.4,
        ], 200),
    ]);

    $this->actingAs(orthancAdminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'orthanc', 'status' => 'healthy']);
});

test('orthanc detail metrics fall back to localhost when docker hostname is unreachable', function () {
    /** @var TestCase $this */
    createDefaultOrthancConnection();

    Http::fake([
        'http://orthanc:8042/statistics' => Http::failedConnection(),
        'http://127.0.0.1:8042/statistics' => Http::response([
            'CountStudies' => 12,
            'CountInstances' => 345,
            'CountSeries' => 34,
            'CountPatients' => 10,
            'TotalDiskSizeMB' => 512.4,
        ], 200),
        'http://orthanc:8042/system' => Http::failedConnection(),
        'http://127.0.0.1:8042/system' => Http::response([
            'Version' => '1.12.5',
            'DatabaseVersion' => '6',
            'DicomAet' => 'ORTHANC',
            'PluginsEnabled' => true,
            'OverwriteInstances' => false,
        ], 200),
    ]);

    $this->actingAs(orthancAdminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/orthanc')
        ->assertOk()
        ->assertJsonPath('service.status', 'healthy')
        ->assertJsonPath('metrics.version', '1.12.5');
});
