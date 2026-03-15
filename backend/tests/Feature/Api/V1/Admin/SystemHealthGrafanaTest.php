<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function adminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

test('system health index includes grafana service', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana']);
});

test('grafana service shows healthy when api health returns ok', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'healthy']);
});

test('grafana service shows down when api health is unreachable', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::failedConnection(),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'down']);
});

test('grafana service shows degraded when api health returns non-200', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response([], 503),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health')
        ->assertOk()
        ->assertJsonFragment(['key' => 'grafana', 'status' => 'degraded']);
});

test('system health show returns grafana detail', function () {
    Http::fake([
        'grafana:3000/api/health' => Http::response(
            ['commit' => 'abc123', 'database' => 'ok', 'version' => '11.4.0'],
            200
        ),
    ]);

    $this->actingAs(adminUser(), 'sanctum')
        ->getJson('/api/v1/admin/system-health/grafana')
        ->assertOk()
        ->assertJsonPath('service.key', 'grafana')
        ->assertJsonPath('service.status', 'healthy');
});
