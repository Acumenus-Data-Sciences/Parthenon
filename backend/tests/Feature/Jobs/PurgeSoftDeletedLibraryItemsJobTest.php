<?php

namespace Tests\Feature\Jobs;

use App\Jobs\PurgeSoftDeletedLibraryItemsJob;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\IncidenceRateAnalysis;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phase D · Task D5 — PurgeSoftDeletedLibraryItemsJob.
 *
 * Asserts the 30-day grace window: items soft-deleted > 30 days ago are
 * force-deleted, items soft-deleted < 30 days ago survive.
 */
class PurgeSoftDeletedLibraryItemsJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_purges_items_past_grace_window(): void
    {
        $stale = ConceptSet::factory()->create(['status' => 'archived']);
        $stale->delete();
        // Backdate deleted_at past the grace window via raw update so the
        // SoftDeletes cast does not coerce or skip the write.
        DB::table('concept_sets')
            ->where('id', $stale->id)
            ->update(['deleted_at' => Carbon::now()->subDays(PurgeSoftDeletedLibraryItemsJob::GRACE_DAYS + 1)]);

        (new PurgeSoftDeletedLibraryItemsJob)->handle();

        $this->assertDatabaseMissing('concept_sets', ['id' => $stale->id]);
        $this->assertDatabaseHas('audit_log', [
            'action' => 'library.purge',
            'subject_type' => 'concept_set',
            'subject_id' => $stale->id,
        ]);
    }

    public function test_retains_items_inside_grace_window(): void
    {
        $fresh = CohortDefinition::factory()->create(['status' => 'archived']);
        $fresh->delete(); // deleted_at = now()

        (new PurgeSoftDeletedLibraryItemsJob)->handle();

        $this->assertSoftDeleted('cohort_definitions', ['id' => $fresh->id]);
        $this->assertDatabaseMissing('audit_log', [
            'action' => 'library.purge',
            'subject_id' => $fresh->id,
        ]);
    }

    public function test_purges_across_all_lifecycle_tables(): void
    {
        $cs = ConceptSet::factory()->create(['status' => 'archived']);
        $cd = CohortDefinition::factory()->create(['status' => 'archived']);
        $ir = IncidenceRateAnalysis::factory()->create(['status' => 'archived']);

        $cutoff = Carbon::now()->subDays(PurgeSoftDeletedLibraryItemsJob::GRACE_DAYS + 1);
        foreach ([
            'concept_sets' => $cs,
            'cohort_definitions' => $cd,
            'incidence_rate_analyses' => $ir,
        ] as $table => $item) {
            $item->delete();
            DB::table($table)
                ->where('id', $item->id)
                ->update(['deleted_at' => $cutoff]);
        }

        (new PurgeSoftDeletedLibraryItemsJob)->handle();

        $this->assertDatabaseMissing('concept_sets', ['id' => $cs->id]);
        $this->assertDatabaseMissing('cohort_definitions', ['id' => $cd->id]);
        $this->assertDatabaseMissing('incidence_rate_analyses', ['id' => $ir->id]);
    }

    public function test_noop_when_nothing_eligible(): void
    {
        ConceptSet::factory()->create(['status' => 'active']);
        ConceptSet::factory()->create(['status' => 'archived']);

        (new PurgeSoftDeletedLibraryItemsJob)->handle();

        $this->assertDatabaseMissing('audit_log', ['action' => 'library.purge']);
    }
}
