<?php

namespace Tests\Unit\Models;

use App\Models\App\LibraryCleanupSuggestion;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryCleanupSuggestionTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_persist_and_read(): void
    {
        $user = User::factory()->create();
        $row = LibraryCleanupSuggestion::create([
            'user_id' => $user->id,
            'item_type' => 'cohort_definition',
            'item_id' => 42,
            'last_activity_at' => now()->subDays(120),
            'computed_at' => now(),
        ]);

        $this->assertSame('cohort_definition', $row->item_type);
        $this->assertSame(42, $row->item_id);
        $this->assertSame($user->id, $row->user_id);
    }

    public function test_composite_primary_key_enforced(): void
    {
        $user = User::factory()->create();
        LibraryCleanupSuggestion::create([
            'user_id' => $user->id,
            'item_type' => 'cohort_definition',
            'item_id' => 1,
            'last_activity_at' => now(),
            'computed_at' => now(),
        ]);

        $this->expectException(QueryException::class);
        LibraryCleanupSuggestion::create([
            'user_id' => $user->id,
            'item_type' => 'cohort_definition',
            'item_id' => 1,
            'last_activity_at' => now(),
            'computed_at' => now(),
        ]);
    }
}
