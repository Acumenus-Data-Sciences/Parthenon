<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\AiProviderSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regression coverage for HIGHSEC secret-hygiene: admin AI provider read
 * endpoints must never return a raw API key (Section 0 of the Abby provider
 * entitlements plan). The masked representation must still round-trip safely so
 * an unchanged admin form does not clobber a stored key with its mask.
 */
class AiProviderControllerTest extends TestCase
{
    use RefreshDatabase;

    private const REAL_KEY = 'sk-ant-api03-REALSECRETVALUE-abcd1234';

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
    }

    private function seedAnthropic(): AiProviderSetting
    {
        return AiProviderSetting::create([
            'provider_type' => 'anthropic',
            'display_name' => 'Anthropic Claude API',
            'is_enabled' => true,
            'is_active' => true,
            'model' => 'claude-sonnet-4-6',
            'settings' => [
                'api_key' => self::REAL_KEY,
                'base_url' => 'https://api.anthropic.com',
                'timeout' => 60,
            ],
        ]);
    }

    private function actingAsSuperAdmin(): User
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        return $super;
    }

    public function test_index_masks_api_key_and_never_returns_raw_secret(): void
    {
        $this->seedAnthropic();
        $this->actingAsSuperAdmin();

        $response = $this->getJson('/api/v1/admin/ai-providers');
        $response->assertOk();

        $this->assertStringNotContainsString(self::REAL_KEY, (string) $response->getContent());
        $masked = $response->json('0.settings.api_key');
        $this->assertIsString($masked);
        $this->assertStringContainsString(AiProviderSetting::MASK_CHAR, $masked);
        // Non-secret fields remain visible.
        $this->assertSame('https://api.anthropic.com', $response->json('0.settings.base_url'));
    }

    public function test_show_masks_api_key(): void
    {
        $this->seedAnthropic();
        $this->actingAsSuperAdmin();

        $response = $this->getJson('/api/v1/admin/ai-providers/anthropic');
        $response->assertOk();

        $this->assertStringNotContainsString(self::REAL_KEY, (string) $response->getContent());
        $this->assertStringContainsString(
            AiProviderSetting::MASK_CHAR,
            (string) $response->json('settings.api_key'),
        );
    }

    public function test_update_with_resubmitted_masked_value_preserves_stored_key(): void
    {
        $this->seedAnthropic();
        $this->actingAsSuperAdmin();

        // Simulate the admin form re-submitting the masked key it was prefilled with.
        $masked = AiProviderSetting::maskSecret(self::REAL_KEY);
        $this->putJson('/api/v1/admin/ai-providers/anthropic', [
            'settings' => ['api_key' => $masked, 'timeout' => 90],
        ])->assertOk();

        $fresh = AiProviderSetting::where('provider_type', 'anthropic')->firstOrFail();
        $settings = $fresh->settings ?? [];
        $this->assertSame(self::REAL_KEY, $settings['api_key'] ?? null);
        $this->assertSame(90, $settings['timeout'] ?? null);
    }

    public function test_update_with_new_real_key_replaces_stored_key(): void
    {
        $this->seedAnthropic();
        $this->actingAsSuperAdmin();

        $newKey = 'sk-ant-api03-ROTATEDVALUE-wxyz9876';
        $this->putJson('/api/v1/admin/ai-providers/anthropic', [
            'settings' => ['api_key' => $newKey],
        ])->assertOk();

        $fresh = AiProviderSetting::where('provider_type', 'anthropic')->firstOrFail();
        $settings = $fresh->settings ?? [];
        $this->assertSame($newKey, $settings['api_key'] ?? null);
    }

    public function test_non_super_admin_cannot_read_providers(): void
    {
        $this->seedAnthropic();
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/ai-providers')->assertForbidden();
    }
}
