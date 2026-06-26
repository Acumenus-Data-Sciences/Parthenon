<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\AbbyProviderProfile;
use App\Models\App\AbbySurfacePolicy;
use App\Models\User;
use App\Services\AI\AbbyProviderPolicyService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AbbyProviderPolicyControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $this->ensureAbbyPolicyTables();
    }

    public function test_non_super_admin_cannot_read_abby_policy(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/abby-ai')->assertForbidden();
    }

    public function test_super_admin_can_create_provider_profile(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $this->postJson('/api/v1/admin/abby-ai/profiles', [
            'profile_id' => 'local-medgemma-27b',
            'display_name' => 'Local MedGemma 27B',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming', 'clinical_rag', 'patient_level_local_only'],
            'safety' => [
                'cloud' => false,
                'phi_allowed' => true,
                'patient_level_context_allowed' => true,
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('profile_id', 'local-medgemma-27b')
            ->assertJsonPath('transport', 'ollama_chat');

        $this->assertDatabaseHas('abby_provider_profiles', [
            'profile_id' => 'local-medgemma-27b',
            'provider_type' => 'ollama',
        ]);
    }

    public function test_surface_policy_rejects_model_without_required_agent_capabilities(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'local-medgemma-27b',
            'display_name' => 'Local MedGemma 27B',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming', 'clinical_rag'],
            'safety' => ['patient_level_context_allowed' => true],
        ]);

        $this->putJson('/api/v1/admin/abby-ai/surfaces/study_agent', [
            'provider_mode' => 'local_only',
            'default_profile_id' => 'local-medgemma-27b',
            'allow_cloud' => false,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('surface_policy');
    }

    public function test_external_subscription_profiles_can_be_cataloged_but_not_routed(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $this->postJson('/api/v1/admin/abby-ai/profiles', [
            'profile_id' => 'anthropic-max-app',
            'display_name' => 'Anthropic Max App',
            'provider_type' => 'anthropic',
            'transport' => 'external_subscription_app',
            'entitlement_type' => 'external_subscription_app',
            'model' => 'claude.ai/max',
            'capabilities' => ['chat', 'long_context'],
            'safety' => [
                'cloud' => true,
                'patient_level_context_allowed' => false,
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('profile_id', 'anthropic-max-app')
            ->assertJsonPath('transport', 'external_subscription_app');

        $this->putJson('/api/v1/admin/abby-ai/surfaces/chat', [
            'provider_mode' => 'cloud_first',
            'default_profile_id' => 'anthropic-max-app',
            'fallback_profile_ids' => [],
            'allow_cloud' => true,
            'never_send_phi_to_cloud' => false,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('surface_policy');
    }

    public function test_super_admin_can_archive_unreferenced_provider_profile(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'local-medgemma-archive',
            'display_name' => 'Local MedGemma Archive',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
        ]);

        $this->postJson('/api/v1/admin/abby-ai/profiles/local-medgemma-archive/archive')
            ->assertOk()
            ->assertJsonPath('profile_id', 'local-medgemma-archive')
            ->assertJsonPath('is_enabled', false);

        $this->assertDatabaseHas('abby_provider_profiles', [
            'profile_id' => 'local-medgemma-archive',
            'is_enabled' => false,
        ]);
    }

    public function test_super_admin_can_delete_unreferenced_provider_profile(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'local-medgemma-delete',
            'display_name' => 'Local MedGemma Delete',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
        ]);

        $this->deleteJson('/api/v1/admin/abby-ai/profiles/local-medgemma-delete')
            ->assertOk()
            ->assertJsonPath('deleted', true)
            ->assertJsonPath('profile_id', 'local-medgemma-delete');

        $this->assertDatabaseMissing('abby_provider_profiles', [
            'profile_id' => 'local-medgemma-delete',
        ]);
    }

    public function test_profile_archive_and_delete_reject_referenced_profiles(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'local-medgemma-referenced',
            'display_name' => 'Local MedGemma Referenced',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
        ]);

        AbbySurfacePolicy::create([
            'surface' => 'chat',
            'provider_mode' => 'local_only',
            'default_profile_id' => 'local-medgemma-referenced',
            'fallback_profile_ids' => [],
            'allow_cloud' => false,
            'never_send_phi_to_cloud' => true,
        ]);

        $this->postJson('/api/v1/admin/abby-ai/profiles/local-medgemma-referenced/archive')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile')
            ->assertJsonPath('references.0.surface', 'chat')
            ->assertJsonPath('references.0.role', 'default_profile_id');

        $this->deleteJson('/api/v1/admin/abby-ai/profiles/local-medgemma-referenced')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile')
            ->assertJsonPath('references.0.surface', 'chat')
            ->assertJsonPath('references.0.role', 'default_profile_id');

        $this->assertDatabaseHas('abby_provider_profiles', [
            'profile_id' => 'local-medgemma-referenced',
            'is_enabled' => true,
        ]);
    }

    public function test_surface_policy_and_route_simulator_use_saved_profile(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'abby-openai-reasoner',
            'display_name' => 'OpenAI Reasoning',
            'provider_type' => 'openai',
            'transport' => 'openai_responses',
            'entitlement_type' => 'org_api_key',
            'model' => 'gpt-5.5',
            'capabilities' => ['chat', 'streaming', 'long_context'],
            'safety' => ['cloud' => true, 'patient_level_context_allowed' => false],
            'limits' => ['monthly_budget_usd' => 25.0],
        ]);

        $this->putJson('/api/v1/admin/abby-ai/surfaces/chat', [
            'provider_mode' => 'cloud_first',
            'default_profile_id' => 'abby-openai-reasoner',
            'fallback_profile_ids' => [],
            'allow_cloud' => true,
            'never_send_phi_to_cloud' => false,
        ])->assertOk()
            ->assertJsonPath('default_profile_id', 'abby-openai-reasoner');

        $this->postJson('/api/v1/admin/abby-ai/simulate-route', [
            'surface' => 'chat',
            'message' => 'Summarize this study design.',
            'page_context' => 'studies',
        ])
            ->assertOk()
            ->assertJsonPath('selected_profile.profile_id', 'abby-openai-reasoner')
            ->assertJsonPath('will_call_paid_provider', true)
            ->assertJsonPath('reason', 'cloud_first');
    }

    public function test_normal_admin_cannot_create_provider_profile(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/abby-ai/profiles', [
            'profile_id' => 'sneaky-cloud',
            'display_name' => 'Sneaky Cloud',
            'provider_type' => 'openai',
            'transport' => 'openai_responses',
            'entitlement_type' => 'org_api_key',
            'model' => 'gpt-5.5',
            'capabilities' => ['chat'],
        ])->assertForbidden();

        $this->putJson('/api/v1/admin/abby-ai/surfaces/chat', [
            'provider_mode' => 'cloud_first',
            'default_profile_id' => 'sneaky-cloud',
        ])->assertForbidden();

        $this->assertDatabaseMissing('abby_provider_profiles', ['profile_id' => 'sneaky-cloud']);
    }

    public function test_catalog_exposes_presets_and_readiness(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'local-ready',
            'display_name' => 'Local Ready',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
        ]);

        $response = $this->getJson('/api/v1/admin/abby-ai')->assertOk();

        // Named presets are catalogued for the policy console.
        $response->assertJsonPath('catalog.presets.clinical_local_only.provider_mode', 'local_only');
        $response->assertJsonPath('catalog.presets.cloud_first_phi_block.never_send_phi_to_cloud', true);

        // Per-profile readiness is surfaced; a local profile with a model is "ready".
        $readiness = collect($response->json('catalog.readiness'));
        $local = $readiness->firstWhere('profile_id', 'local-ready');
        $this->assertNotNull($local);
        $this->assertSame('ready', $local['state']);
    }

    public function test_cloud_profile_without_key_reports_missing_key_readiness(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        AbbyProviderProfile::create([
            'profile_id' => 'openai-nokey',
            'display_name' => 'OpenAI (no key)',
            'provider_type' => 'openai',
            'transport' => 'openai_responses',
            'entitlement_type' => 'org_api_key',
            'model' => 'gpt-5.5',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['cloud' => true],
        ]);

        $readiness = collect($this->getJson('/api/v1/admin/abby-ai')->assertOk()->json('catalog.readiness'));
        $openai = $readiness->firstWhere('profile_id', 'openai-nokey');
        $this->assertNotNull($openai);
        $this->assertSame('missing_key', $openai['state']);
    }

    public function test_payload_for_surface_resolves_fallback_when_default_invalid(): void
    {
        // A disabled default profile must be skipped in favour of the first valid
        // fallback, matching the route simulator's ordered resolution.
        AbbyProviderProfile::create([
            'profile_id' => 'local-default-disabled',
            'display_name' => 'Disabled Default',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'puyangwang/medgemma-27b-it:q4_0',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
            'is_enabled' => false,
        ]);
        AbbyProviderProfile::create([
            'profile_id' => 'local-fallback-ok',
            'display_name' => 'Fallback OK',
            'provider_type' => 'ollama',
            'transport' => 'ollama_chat',
            'entitlement_type' => 'local',
            'model' => 'MedAIBase/MedGemma1.5:4b',
            'base_url' => 'http://host.docker.internal:11434',
            'capabilities' => ['chat', 'streaming'],
            'safety' => ['patient_level_context_allowed' => true],
            'is_enabled' => true,
        ]);
        AbbySurfacePolicy::create([
            'surface' => 'chat',
            'provider_mode' => 'local_first',
            'default_profile_id' => 'local-default-disabled',
            'fallback_profile_ids' => ['local-fallback-ok'],
            'allow_cloud' => false,
            'never_send_phi_to_cloud' => true,
        ]);

        $payload = app(AbbyProviderPolicyService::class)->payloadForSurface('chat');

        $this->assertNotNull($payload);
        $this->assertSame('local-fallback-ok', $payload['profile_id']);
    }

    private function ensureAbbyPolicyTables(): void
    {
        if (! Schema::hasTable('abby_provider_profiles')) {
            Schema::create('abby_provider_profiles', function (Blueprint $table): void {
                $table->id();
                $table->string('profile_id', 100)->unique();
                $table->string('display_name', 120);
                $table->string('provider_type', 50);
                $table->string('transport', 80);
                $table->string('entitlement_type', 80)->default('local');
                $table->string('model', 200)->default('');
                $table->string('base_url', 500)->nullable();
                $table->string('provider_setting_type', 50)->nullable();
                $table->boolean('is_enabled')->default(true);
                $table->jsonb('capabilities')->nullable();
                $table->jsonb('safety')->nullable();
                $table->jsonb('limits')->nullable();
                $table->jsonb('fallback_profile_ids')->nullable();
                $table->jsonb('notes')->nullable();
                $table->foreignId('updated_by')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('abby_surface_policies')) {
            Schema::create('abby_surface_policies', function (Blueprint $table): void {
                $table->id();
                $table->string('surface', 80)->unique();
                $table->string('provider_mode', 40)->default('local_only');
                $table->string('default_profile_id', 100)->nullable();
                $table->jsonb('fallback_profile_ids')->nullable();
                $table->boolean('never_send_phi_to_cloud')->default(true);
                $table->boolean('allow_cloud')->default(false);
                $table->jsonb('required_capabilities')->nullable();
                $table->jsonb('settings')->nullable();
                $table->foreignId('updated_by')->nullable();
                $table->timestamps();
            });
        }
    }
}
