<?php

namespace Tests\Unit\Scopes;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryDefaultScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_query_hides_archived_and_non_owner_drafts(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $aliceActive = ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'active']);
        $aliceDraft = ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'draft']);
        $aliceArchived = ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'archived']);
        $bobActive = ConceptSet::factory()->create(['author_id' => $bob->id, 'status' => 'active']);
        $bobDraft = ConceptSet::factory()->create(['author_id' => $bob->id, 'status' => 'draft']);

        $this->actingAs($alice);

        $ids = ConceptSet::query()->pluck('id')->all();

        // Alice sees: her active + her draft + Bob's active. NOT her archived, NOT Bob's draft.
        $this->assertContains($aliceActive->id, $ids);
        $this->assertContains($aliceDraft->id, $ids);
        $this->assertContains($bobActive->id, $ids);
        $this->assertNotContains($aliceArchived->id, $ids);
        $this->assertNotContains($bobDraft->id, $ids);
        $this->assertCount(3, $ids);
    }

    public function test_with_archived_macro_includes_archived(): void
    {
        $alice = User::factory()->create();
        $this->actingAs($alice);
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'archived']);

        $this->assertCount(1, ConceptSet::query()->withArchived()->get());
        $this->assertCount(0, ConceptSet::query()->get());
    }

    public function test_with_any_status_macro_returns_everything(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $this->actingAs($alice);
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'active']);
        ConceptSet::factory()->create(['author_id' => $bob->id, 'status' => 'draft']);
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'archived']);

        $this->assertCount(3, ConceptSet::query()->withAnyStatus()->get());
    }

    public function test_unauthenticated_request_sees_only_active(): void
    {
        $alice = User::factory()->create();
        // No actingAs.
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'active']);
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'draft']);
        ConceptSet::factory()->create(['author_id' => $alice->id, 'status' => 'archived']);

        $this->assertCount(1, ConceptSet::query()->get());
    }
}
