<?php

declare(strict_types=1);

namespace Tests\Feature\Api\V1\Admin;

use App\Models\App\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AgentSettingsControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Minimal role bootstrap — mirror LibraryControllerTest pattern.
        Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
    }

    // ── GET /api/v1/admin/ai-agents ───────────────────────────────────────────

    public function test_unauthenticated_get_returns_401(): void
    {
        $this->getJson('/api/v1/admin/ai-agents')->assertUnauthorized();
    }

    public function test_non_super_admin_get_returns_403(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/admin/ai-agents')->assertForbidden();
    }

    public function test_super_admin_get_returns_shape(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $res = $this->getJson('/api/v1/admin/ai-agents');

        $res->assertOk()
            ->assertJsonStructure(['enabled', 'anthropic_ready'])
            ->assertJsonPath('enabled', false);  // default: no DB row → '0'
    }

    // ── PUT /api/v1/admin/ai-agents ───────────────────────────────────────────

    public function test_unauthenticated_put_returns_401(): void
    {
        $this->putJson('/api/v1/admin/ai-agents', ['enabled' => true])->assertUnauthorized();
    }

    public function test_non_super_admin_put_returns_403(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $this->putJson('/api/v1/admin/ai-agents', ['enabled' => true])->assertForbidden();
    }

    public function test_put_enabled_true_persists_and_get_reflects_it(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $put = $this->putJson('/api/v1/admin/ai-agents', ['enabled' => true]);

        $put->assertOk()
            ->assertJsonPath('enabled', true);

        // DB row must be set.
        $this->assertSame('1', SystemSetting::getValue('agents.enabled', '0'));

        // Subsequent GET also reflects the new state.
        $this->getJson('/api/v1/admin/ai-agents')
            ->assertOk()
            ->assertJsonPath('enabled', true);
    }

    public function test_put_enabled_false_flips_back(): void
    {
        // Pre-seed an enabled state.
        SystemSetting::setValue('agents.enabled', '1', 'agents');

        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $put = $this->putJson('/api/v1/admin/ai-agents', ['enabled' => false]);

        $put->assertOk()
            ->assertJsonPath('enabled', false);

        $this->assertSame('0', SystemSetting::getValue('agents.enabled', '0'));
    }

    public function test_put_missing_enabled_field_returns_422(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        Sanctum::actingAs($super);

        $this->putJson('/api/v1/admin/ai-agents', [])->assertUnprocessable();
    }
}
