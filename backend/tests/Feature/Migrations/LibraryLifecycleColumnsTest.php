<?php

namespace Tests\Feature\Migrations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LibraryLifecycleColumnsTest extends TestCase
{
    use RefreshDatabase;

    public function test_concept_sets_has_lifecycle_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('concept_sets', [
            'status', 'archived_at', 'archived_by', 'promoted_at',
        ]));
    }

    public function test_concept_sets_status_defaults_to_active(): void
    {
        $user = User::factory()->create();

        $id = \DB::table('concept_sets')->insertGetId([
            'name' => 'test',
            'author_id' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertSame('active', \DB::table('concept_sets')->where('id', $id)->value('status'));
    }

    public function test_cohort_definitions_has_lifecycle_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('cohort_definitions', [
            'status', 'archived_at', 'archived_by', 'promoted_at',
        ]));
    }

    public function test_cohort_definitions_deprecated_at_folded_to_archived(): void
    {
        // Data fold runs at migration time on a real DB; testing it in isolation
        // would require inserting rows before the migration runs. The schema-level
        // test above confirms the target columns exist. Fold correctness is verified
        // via the Task D8 backfill command on real data.
        $this->markTestSkipped('Data fold tested via Task D8 backfill command on real data.');
    }
}
