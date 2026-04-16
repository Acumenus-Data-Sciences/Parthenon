<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
});

it('GET /analyses/modules returns all enabled modules', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules');

    $response->assertStatus(200)
        ->assertJsonStructure(['data']);

    $modules = $response->json('data');
    // Should include at least 4 CO2 modules
    $co2Keys = array_filter(
        array_column($modules, 'key'),
        fn ($k) => str_starts_with($k, 'co2.')
    );
    expect(count($co2Keys))->toBeGreaterThanOrEqual(4);
});

it('GET /analyses/modules/{key} returns a single module with schema', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules/co2.codewas');

    $response->assertStatus(200)
        ->assertJsonStructure(['data' => ['key', 'label', 'settings_schema']]);

    $mod = $response->json('data');
    expect($mod['key'])->toBe('co2.codewas');
    expect($mod['settings_schema'])->not->toBeNull();
    expect($mod['settings_schema']['required'])->toContain('case_cohort_id');
});

it('GET /analyses/modules/{key} returns 404 for unknown key', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules/nonexistent.module');

    $response->assertStatus(404);
    expect($response->json('error.code'))->toBe('FINNGEN_MODULE_NOT_FOUND');
});

it('unauthenticated request returns 401', function () {
    $this->getJson('/api/v1/finngen/analyses/modules')
        ->assertStatus(401);
    $this->getJson('/api/v1/finngen/analyses/modules/co2.codewas')
        ->assertStatus(401);
});

it('all 4 CO2 modules have non-null settings_schema and result_component', function () {
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/analyses/modules');

    $modules = $response->json('data');
    $co2Modules = array_filter($modules, fn ($m) => str_starts_with($m['key'], 'co2.'));

    foreach ($co2Modules as $mod) {
        expect($mod['settings_schema'])->not->toBeNull("settings_schema is null for {$mod['key']}");
        expect($mod['result_component'])->not->toBeNull("result_component is null for {$mod['key']}");
    }
});
