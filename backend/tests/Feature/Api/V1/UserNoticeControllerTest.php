<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase D · Task D9 — PUT /api/v1/user/library-notice.
 */
class UserNoticeControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_requires_authentication(): void
    {
        $this->putJson('/api/v1/user/library-notice')->assertStatus(401);
    }

    public function test_marks_library_notice_seen(): void
    {
        $user = User::factory()->create(['seen_library_lifecycle_notice' => false]);
        Sanctum::actingAs($user);

        $this->putJson('/api/v1/user/library-notice')
            ->assertOk()
            ->assertJson(['seen_library_lifecycle_notice' => true]);

        $this->assertTrue((bool) $user->fresh()->seen_library_lifecycle_notice);
    }

    public function test_is_idempotent(): void
    {
        $user = User::factory()->create(['seen_library_lifecycle_notice' => true]);
        Sanctum::actingAs($user);

        $this->putJson('/api/v1/user/library-notice')->assertOk();

        $this->assertTrue((bool) $user->fresh()->seen_library_lifecycle_notice);
    }
}
