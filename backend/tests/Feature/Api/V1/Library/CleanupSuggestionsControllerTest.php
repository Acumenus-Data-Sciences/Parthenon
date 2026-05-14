<?php

namespace Tests\Feature\Api\V1\Library;

use App\Models\App\LibraryCleanupSuggestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CleanupSuggestionsControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_index_returns_current_users_suggestions_only(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        LibraryCleanupSuggestion::create([
            'user_id' => $alice->id,
            'item_type' => 'concept_set',
            'item_id' => 1,
            'last_activity_at' => now()->subDays(120),
            'computed_at' => now(),
        ]);
        LibraryCleanupSuggestion::create([
            'user_id' => $bob->id,
            'item_type' => 'concept_set',
            'item_id' => 2,
            'last_activity_at' => now()->subDays(120),
            'computed_at' => now(),
        ]);

        Sanctum::actingAs($alice);
        $resp = $this->getJson('/api/v1/library/cleanup');

        $resp->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.item_id', 1);
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/v1/library/cleanup')->assertUnauthorized();
    }

    public function test_index_orders_by_oldest_activity_first(): void
    {
        $alice = User::factory()->create();
        $recent = LibraryCleanupSuggestion::create([
            'user_id' => $alice->id,
            'item_type' => 'concept_set',
            'item_id' => 1,
            'last_activity_at' => now()->subDays(95),
            'computed_at' => now(),
        ]);
        $oldest = LibraryCleanupSuggestion::create([
            'user_id' => $alice->id,
            'item_type' => 'cohort_definition',
            'item_id' => 2,
            'last_activity_at' => now()->subDays(200),
            'computed_at' => now(),
        ]);

        Sanctum::actingAs($alice);
        $resp = $this->getJson('/api/v1/library/cleanup');

        $resp->assertOk()
            ->assertJsonPath('data.0.item_id', 2)
            ->assertJsonPath('data.1.item_id', 1);
    }
}
