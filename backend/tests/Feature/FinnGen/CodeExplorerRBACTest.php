<?php

declare(strict_types=1);

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
});

it('rejects unauthenticated requests on all routes', function () {
    foreach ([
        '/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA',
        '/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=1',
        '/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=1',
        '/api/v1/finngen/code-explorer/ancestors?source=EUNOMIA&concept_id=1',
    ] as $url) {
        $this->getJson($url)->assertStatus(401);
    }
    $this->postJson('/api/v1/finngen/code-explorer/report', [])->assertStatus(401);
    $this->postJson('/api/v1/finngen/code-explorer/initialize-source', [])->assertStatus(401);
});

it('viewer can view but cannot setup (missing finngen.code-explorer.setup)', function () {
    Bus::fake();

    $this->actingAs($this->viewer)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA')
        ->assertStatus(200);

    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(403);
});

it('researcher has view + report but not setup', function () {
    Bus::fake();

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA')
        ->assertStatus(200);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/report', [
            'source_key' => 'EUNOMIA',
            'concept_id' => 201826,
        ])
        ->assertStatus(201);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(403);
});

it('admin has view + report + setup', function () {
    Bus::fake();

    $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(201);
});
