<?php

namespace Tests\Feature\Commands;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phase D · Task D8 — library:backfill-lifecycle.
 *
 * Reclassifies legacy library rows. A private (`is_public = false`),
 * currently-active item that has not been touched in > STALE_DAYS and is not
 * attached to any non-archived Study is demoted to `draft`. Published
 * (`is_public = true`) rows, fresh rows, and in-study rows stay `active`.
 * Concept-set attachment is derived from the `study_cohorts.concept_set_ids`
 * JSON array; cohorts and analyses from their Study pivots — matching
 * production storage (analyses keyed by FQCN). `author_id` is NOT NULL on
 * every lifecycle table, so there is no null-owner "seed" case.
 */
class LibraryBackfillLifecycleCommandTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Backdate updated_at via a raw write. CohortDefinition has an observer
     * that re-saves (and bumps updated_at) on `created`, so a factory-supplied
     * updated_at does not survive — a raw update after creation is reliable
     * across every lifecycle table.
     */
    private function backdate(Model $model, int $days): void
    {
        DB::table($model->getTable())
            ->where('id', $model->getKey())
            ->update(['updated_at' => now()->subDays($days)]);
    }

    private function makeStudyCohort(int $studyId, ?int $cohortDefinitionId = null, ?int $conceptSetId = null): void
    {
        DB::table('study_cohorts')->insert([
            'study_id' => $studyId,
            'cohort_definition_id' => $cohortDefinitionId ?? CohortDefinition::factory()->create()->id,
            'role' => 'target',
            'label' => 'T',
            'concept_set_ids' => $conceptSetId !== null ? json_encode([$conceptSetId]) : null,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeStudy(int $ownerId, string $status = 'draft'): int
    {
        return DB::table('studies')->insertGetId([
            'title' => 'Host Study',
            'created_by' => $ownerId,
            'status' => $status,
            'phase' => 'pre_study',
            'priority' => 'medium',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_apply_classifies_concept_sets_per_rules(): void
    {
        $user = User::factory()->create();

        $inStudy = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($inStudy, 120);
        $this->makeStudyCohort($this->makeStudy($user->id), conceptSetId: $inStudy->id);

        $fresh = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($fresh, 5);

        $abandoned = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($abandoned, 120);

        // Published/curated content is protected even when stale + unattached.
        $published = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => true]);
        $this->backdate($published, 200);

        $this->artisan('library:backfill-lifecycle', ['--apply' => true])->assertExitCode(0);

        $this->assertSame('active', $inStudy->fresh()->status->value);
        $this->assertSame('active', $fresh->fresh()->status->value);
        $this->assertSame('draft', $abandoned->fresh()->status->value);
        $this->assertSame('active', $published->fresh()->status->value);
    }

    public function test_apply_demotes_abandoned_cohort_and_keeps_attached(): void
    {
        $user = User::factory()->create();

        $attached = CohortDefinition::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($attached, 150);
        $this->makeStudyCohort($this->makeStudy($user->id), cohortDefinitionId: $attached->id);

        $abandoned = CohortDefinition::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($abandoned, 150);

        $this->artisan('library:backfill-lifecycle', ['--apply' => true])->assertExitCode(0);

        $this->assertSame('active', $attached->fresh()->status->value);
        $this->assertSame('draft', $abandoned->fresh()->status->value);
    }

    public function test_apply_demotes_abandoned_analysis_but_keeps_in_study(): void
    {
        $user = User::factory()->create();

        $inStudy = IncidenceRateAnalysis::factory()->create(['author_id' => $user->id]);
        $this->backdate($inStudy, 150);
        $studyId = $this->makeStudy($user->id);
        // Production stores analysis_type as the model FQCN, not the slug.
        DB::table('study_analyses')->insert([
            'study_id' => $studyId,
            'analysis_type' => IncidenceRateAnalysis::class,
            'analysis_id' => $inStudy->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $abandoned = IncidenceRateAnalysis::factory()->create(['author_id' => $user->id]);
        $this->backdate($abandoned, 150);

        $this->artisan('library:backfill-lifecycle', ['--apply' => true])->assertExitCode(0);

        $this->assertSame('active', $inStudy->fresh()->status->value);
        $this->assertSame('draft', $abandoned->fresh()->status->value);
    }

    public function test_dry_run_makes_no_changes(): void
    {
        $user = User::factory()->create();
        $abandoned = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($abandoned, 120);

        $this->artisan('library:backfill-lifecycle', ['--dry-run' => true])->assertExitCode(0);

        $this->assertSame('active', $abandoned->fresh()->status->value);
    }

    public function test_requires_a_mode_flag(): void
    {
        $user = User::factory()->create();
        $abandoned = ConceptSet::factory()->create(['author_id' => $user->id, 'is_public' => false]);
        $this->backdate($abandoned, 120);

        $this->artisan('library:backfill-lifecycle')->assertExitCode(1);

        $this->assertSame('active', $abandoned->fresh()->status->value);
    }
}
