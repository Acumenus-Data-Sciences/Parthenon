<?php

namespace Tests\Feature\Jobs;

use App\Jobs\SuggestLibraryCleanupJob;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\Study;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SuggestLibraryCleanupJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_flags_stale_concept_set(): void
    {
        $alice = User::factory()->create();
        $stale = ConceptSet::factory()->create([
            'author_id' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(120),
        ]);
        $fresh = ConceptSet::factory()->create([
            'author_id' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(10),
        ]);

        (new SuggestLibraryCleanupJob)->handle();

        $this->assertDatabaseHas('library_cleanup_suggestions', [
            'user_id' => $alice->id,
            'item_type' => 'concept_set',
            'item_id' => $stale->id,
        ]);
        $this->assertDatabaseMissing('library_cleanup_suggestions', [
            'item_id' => $fresh->id,
        ]);
    }

    public function test_skips_cohort_attached_to_active_study(): void
    {
        $alice = User::factory()->create();
        $attached = CohortDefinition::factory()->create([
            'author_id' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(120),
        ]);
        $study = Study::factory()->create(['status' => 'active']);
        DB::table('study_cohorts')->insert([
            'study_id' => $study->id,
            'cohort_definition_id' => $attached->id,
            'role' => 'target',
            'label' => 'attached',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        (new SuggestLibraryCleanupJob)->handle();

        $this->assertDatabaseMissing('library_cleanup_suggestions', [
            'item_type' => 'cohort_definition',
            'item_id' => $attached->id,
        ]);
    }

    public function test_truncates_previous_suggestions_on_rerun(): void
    {
        $alice = User::factory()->create();
        $stale = ConceptSet::factory()->create([
            'author_id' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(120),
        ]);

        (new SuggestLibraryCleanupJob)->handle();
        $firstCount = DB::table('library_cleanup_suggestions')->count();

        (new SuggestLibraryCleanupJob)->handle();
        $secondCount = DB::table('library_cleanup_suggestions')->count();

        $this->assertSame($firstCount, $secondCount);
        $this->assertSame(1, $secondCount);
    }
}
