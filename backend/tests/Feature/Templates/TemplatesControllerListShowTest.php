<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerListShowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/v1/ingestion/templates')->assertStatus(401);
    }

    public function test_authenticated_without_permission_returns_403(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/v1/ingestion/templates')->assertStatus(403);
    }

    public function test_index_with_permission_returns_catalog(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->andReturn([
            [
                'id' => 'hello_cdm',
                'version' => '0.1.0',
                'name' => 'Hello CDM',
                'category' => 'ingestion',
                'tags' => ['demo'],
                'cdm_versions' => ['5.4'],
                'singleton' => false,
            ],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates')
            ->assertOk()
            ->assertJsonFragment(['id' => 'hello_cdm'])
            ->assertJsonPath('0.category', 'ingestion');
    }

    public function test_show_flattens_kubernetes_style_manifest(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');

        // Upstream registry returns Kubernetes-style {apiVersion, kind, metadata, spec}.
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->with('hello_cdm')->andReturn([
            'apiVersion' => 'parthenon.acumenus.net/v1',
            'kind' => 'Template',
            'metadata' => [
                'id' => 'hello_cdm',
                'name' => 'Hello CDM',
                'version' => '0.1.0',
                'category' => 'ingestion',
                'cdm_versions' => ['5.4'],
                'tags' => ['demo'],
                'singleton' => false,
            ],
            'spec' => [
                'parameters' => [
                    'type' => 'object',
                    'required' => ['target_schema'],
                    'properties' => [
                        'target_schema' => ['type' => 'string'],
                    ],
                ],
                'nodes' => [
                    ['node_id' => 'bootstrap', 'type' => 'python'],
                ],
            ],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/hello_cdm')
            ->assertOk()
            ->assertJsonPath('id', 'hello_cdm')
            ->assertJsonPath('singleton', false)
            ->assertJsonPath('parameters_schema.type', 'object')
            ->assertJsonPath('parameters_schema.required.0', 'target_schema')
            ->assertJsonPath('nodes.0.id', 'bootstrap')
            ->assertJsonPath('nodes.0.kind', 'python');
    }
}
