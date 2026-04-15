<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\User;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->viewer = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->admin = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();
    // Parthenon's `admin` role is a platform admin — it intentionally lacks
    // analyses.* permissions (see RolePermissionSeeder). For "can see every
    // run" coverage we use super-admin, which gets wildcard via the seeder.
    $this->superAdmin = User::where('email', 'finngen-test-super-admin@test.local')->firstOrFail();
});

it('POST /runs requires authentication', function () {
    Bus::fake();
    $this->postJson('/api/v1/finngen/runs', [])->assertStatus(401);
});

it('POST /runs denies viewer (no analyses.run permission)', function () {
    Bus::fake();
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/runs', [
            'analysis_type' => 'co2.codewas',
            'source_key' => 'EUNOMIA',
            'params' => [],
        ])->assertStatus(403);
});

it('GET /runs/{id} denies non-owner researcher', function () {
    Bus::fake();
    $otherRun = Run::create([
        'user_id' => $this->admin->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_QUEUED,
    ]);

    $this->actingAs($this->researcher)
        ->getJson("/api/v1/finngen/runs/{$otherRun->id}")
        ->assertStatus(403);
});

it('GET /runs/{id} allows super-admin on any run', function () {
    Bus::fake();
    $otherRun = Run::create([
        'user_id' => $this->researcher->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_QUEUED,
    ]);

    $this->actingAs($this->superAdmin)
        ->getJson("/api/v1/finngen/runs/{$otherRun->id}")
        ->assertStatus(200);
});

it('cancel/pin deny non-owner', function () {
    Bus::fake();
    $otherRun = Run::create([
        'user_id' => $this->admin->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'status' => Run::STATUS_RUNNING,
        'started_at' => now(),
    ]);

    $this->actingAs($this->researcher)->postJson("/api/v1/finngen/runs/{$otherRun->id}/cancel")->assertStatus(403);
    $this->actingAs($this->researcher)->postJson("/api/v1/finngen/runs/{$otherRun->id}/pin")->assertStatus(403);
});

it('module registry requires auth + analyses.view', function () {
    Bus::fake();
    $this->getJson('/api/v1/finngen/analyses/modules')->assertStatus(401);
    $this->actingAs($this->viewer)->getJson('/api/v1/finngen/analyses/modules')->assertStatus(200);
});
