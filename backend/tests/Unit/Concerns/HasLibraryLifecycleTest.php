<?php

namespace Tests\Unit\Concerns;

use App\Enums\LibraryStatus;
use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HasLibraryLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function makeSet(LibraryStatus $status): ConceptSet
    {
        $owner = User::factory()->create();

        return ConceptSet::factory()->create([
            'author_id' => $owner->id,
            'status' => $status->value,
        ]);
    }

    public function test_promote_marks_active_and_stamps_promoted_at(): void
    {
        $set = $this->makeSet(LibraryStatus::DRAFT);
        $actor = User::factory()->create();

        $set->promote($actor);

        $this->assertSame(LibraryStatus::ACTIVE, $set->fresh()->status);
        $this->assertNotNull($set->fresh()->promoted_at);
    }

    public function test_archive_stamps_archived_at_and_archived_by(): void
    {
        $set = $this->makeSet(LibraryStatus::ACTIVE);
        $actor = User::factory()->create();

        $set->archive($actor);

        $fresh = $set->fresh();
        $this->assertSame(LibraryStatus::ARCHIVED, $fresh->status);
        $this->assertSame($actor->id, $fresh->archived_by);
        $this->assertNotNull($fresh->archived_at);
    }

    public function test_restore_lifecycle_from_archived_clears_archive_stamps(): void
    {
        $archiver = User::factory()->create();
        $set = $this->makeSet(LibraryStatus::ARCHIVED);
        $set->forceFill(['archived_at' => now(), 'archived_by' => $archiver->id])->save();

        $set->restore_lifecycle(User::factory()->create());

        $fresh = $set->fresh();
        $this->assertSame(LibraryStatus::ACTIVE, $fresh->status);
        $this->assertNull($fresh->archived_at);
        $this->assertNull($fresh->archived_by);
    }

    public function test_promote_on_already_active_is_noop_does_not_stamp_again(): void
    {
        $set = $this->makeSet(LibraryStatus::ACTIVE);
        $set->forceFill(['promoted_at' => now()->subDays(5)])->save();
        $originalPromotedAt = $set->fresh()->promoted_at;

        $set->promote(User::factory()->create());

        $this->assertEquals($originalPromotedAt->timestamp, $set->fresh()->promoted_at->timestamp);
    }

    public function test_archive_on_already_archived_is_noop(): void
    {
        $originalArchiver = User::factory()->create();
        $set = $this->makeSet(LibraryStatus::ARCHIVED);
        $originalArchivedAt = now()->subDays(3);
        $set->forceFill(['archived_at' => $originalArchivedAt, 'archived_by' => $originalArchiver->id])->save();

        $set->archive(User::factory()->create());

        $fresh = $set->fresh();
        $this->assertSame($originalArchiver->id, $fresh->archived_by);
        $this->assertEquals($originalArchivedAt->timestamp, $fresh->archived_at->timestamp);
    }
}
