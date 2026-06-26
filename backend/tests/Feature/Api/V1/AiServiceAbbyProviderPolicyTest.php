<?php

use App\Models\App\AbbyProviderProfile;
use App\Models\App\AbbySurfacePolicy;
use App\Models\App\AiProviderSetting;
use App\Services\AiService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    ensureAbbyProviderPolicyTablesForTest();
});

it('sends the active OpenAI provider policy to python Abby chat', function () {
    config(['services.ai.url' => 'http://python-ai.test']);

    AiProviderSetting::create([
        'provider_type' => 'openai',
        'display_name' => 'OpenAI',
        'is_enabled' => true,
        'is_active' => true,
        'model' => 'gpt-5.5',
        'settings' => [
            'api_key' => 'sk-test-openai',
            'base_url' => 'https://api.openai.com/v1',
            'timeout' => 45,
            'max_output_tokens' => 1200,
            'monthly_budget_usd' => 25.5,
        ],
    ]);

    Http::fake([
        'http://python-ai.test/abby/chat' => Http::response([
            'reply' => 'ok',
            'suggestions' => [],
        ]),
    ]);

    (new AiService)->abbyChat('Summarize this study.');

    Http::assertSent(function ($request) {
        $payload = $request->data();

        return $request->url() === 'http://python-ai.test/abby/chat'
            && ($payload['provider_policy']['provider_type'] ?? null) === 'openai'
            && ($payload['provider_policy']['profile_id'] ?? null) === 'openai-responses'
            && ($payload['provider_policy']['mode'] ?? null) === 'cloud_first'
            && ($payload['provider_policy']['model'] ?? null) === 'gpt-5.5'
            && ($payload['provider_policy']['settings']['api_key'] ?? null) === 'sk-test-openai'
            && ($payload['provider_policy']['settings']['base_url'] ?? null) === 'https://api.openai.com/v1'
            && ($payload['provider_policy']['settings']['timeout'] ?? null) === 45
            && ($payload['provider_policy']['settings']['max_output_tokens'] ?? null) === 1200
            && ($payload['provider_policy']['settings']['monthly_budget_usd'] ?? null) === 25.5;
    });
});

it('sends unsupported active providers as local-only Abby policy', function () {
    config(['services.ai.url' => 'http://python-ai.test']);

    AiProviderSetting::create([
        'provider_type' => 'gemini',
        'display_name' => 'Google Gemini',
        'is_enabled' => true,
        'is_active' => true,
        'model' => 'gemini-2.5-pro',
        'settings' => ['api_key' => 'gemini-key'],
    ]);

    Http::fake([
        'http://python-ai.test/abby/chat' => Http::response([
            'reply' => 'ok',
            'suggestions' => [],
        ]),
    ]);

    (new AiService)->abbyChat('Summarize this study.');

    Http::assertSent(function ($request) {
        $payload = $request->data();

        return ($payload['provider_policy']['provider_type'] ?? null) === 'gemini'
            && ($payload['provider_policy']['profile_id'] ?? null) === 'local-medgemma'
            && ($payload['provider_policy']['mode'] ?? null) === 'local_only'
            && ($payload['provider_policy']['settings'] ?? null) === [];
    });
});

it('prefers saved Abby chat surface policy over the active provider fallback', function () {
    config(['services.ai.url' => 'http://python-ai.test']);

    AiProviderSetting::create([
        'provider_type' => 'openai',
        'display_name' => 'OpenAI',
        'is_enabled' => true,
        'is_active' => false,
        'model' => 'gpt-5.5',
        'settings' => [
            'api_key' => 'sk-test-openai',
            'base_url' => 'https://api.openai.com/v1',
            'timeout' => 30,
            'max_output_tokens' => 1000,
        ],
    ]);

    AiProviderSetting::create([
        'provider_type' => 'anthropic',
        'display_name' => 'Anthropic',
        'is_enabled' => true,
        'is_active' => true,
        'model' => 'claude-sonnet-4-20250514',
        'settings' => ['api_key' => 'sk-test-anthropic'],
    ]);

    AbbyProviderProfile::create([
        'profile_id' => 'abby-openai-reasoner',
        'display_name' => 'OpenAI Reasoning',
        'provider_type' => 'openai',
        'transport' => 'openai_responses',
        'entitlement_type' => 'org_api_key',
        'model' => 'gpt-5.5',
        'provider_setting_type' => 'openai',
        'capabilities' => ['chat', 'streaming', 'long_context'],
        'safety' => ['cloud' => true, 'patient_level_context_allowed' => false],
        'limits' => [
            'timeout' => 45,
            'max_output_tokens' => 1200,
            'monthly_budget_usd' => 50.0,
        ],
    ]);

    AbbySurfacePolicy::create([
        'surface' => 'chat',
        'provider_mode' => 'cloud_first',
        'default_profile_id' => 'abby-openai-reasoner',
        'fallback_profile_ids' => [],
        'allow_cloud' => true,
        'never_send_phi_to_cloud' => false,
    ]);

    Http::fake([
        'http://python-ai.test/abby/chat' => Http::response([
            'reply' => 'ok',
            'suggestions' => [],
        ]),
    ]);

    (new AiService)->abbyChat('Summarize this study.');

    Http::assertSent(function ($request) {
        $payload = $request->data();

        return ($payload['provider_policy']['provider_type'] ?? null) === 'openai'
            && ($payload['provider_policy']['profile_id'] ?? null) === 'abby-openai-reasoner'
            && ($payload['provider_policy']['mode'] ?? null) === 'cloud_first'
            && ($payload['provider_policy']['model'] ?? null) === 'gpt-5.5'
            && ($payload['provider_policy']['settings']['api_key'] ?? null) === 'sk-test-openai'
            && ($payload['provider_policy']['settings']['timeout'] ?? null) === 45
            && ($payload['provider_policy']['settings']['max_output_tokens'] ?? null) === 1200
            && (float) ($payload['provider_policy']['settings']['monthly_budget_usd'] ?? 0) === 50.0;
    });
});

function ensureAbbyProviderPolicyTablesForTest(): void
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
