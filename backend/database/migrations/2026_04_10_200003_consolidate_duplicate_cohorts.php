<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // 1. Rename canonical cohorts (strip study prefixes)
            $renames = [
                75 => 'CKD Advanced Progression — Stages 4-5 or Dialysis',
                173 => 'Composite MACE — First Occurrence (With CHF)',
                155 => 'Metabolic Syndrome — First Occurrence',
                81 => 'Composite MACE — MI or Stroke First Occurrence',
                174 => 'All-Cause Death',
            ];

            foreach ($renames as $id => $newName) {
                $oldName = DB::table('cohort_definitions')->where('id', $id)->value('name');
                DB::table('cohort_definitions')->where('id', $id)->update(['name' => $newName]);
                Log::info("Cohort rename: #{$id} '{$oldName}' → '{$newName}'");
            }

            // 2. Re-point study_cohorts from duplicate → canonical
            $repoints = [
                158 => 72,
                78 => 75,
                187 => 173,
                164 => 155,
                84 => 81,
                181 => 174,
                188 => 174,
            ];

            foreach ($repoints as $fromId => $toId) {
                $count = DB::table('study_cohorts')
                    ->where('cohort_definition_id', $fromId)
                    ->update(['cohort_definition_id' => $toId]);

                Log::info("Study cohorts re-pointed: {$count} rows from cohort #{$fromId} → #{$toId}");
            }

            // 3. Add "shared" tag to canonical cohorts
            $canonicalIds = [72, 75, 173, 155, 81, 174];

            foreach ($canonicalIds as $id) {
                $row = DB::table('cohort_definitions')->where('id', $id)->first(['tags']);
                $tags = json_decode($row->tags ?? '[]', true);

                if (! in_array('shared', $tags)) {
                    $tags[] = 'shared';
                    DB::table('cohort_definitions')
                        ->where('id', $id)
                        ->update(['tags' => json_encode($tags)]);

                    Log::info("Cohort #{$id}: added 'shared' tag");
                }
            }

            // 4. Soft-delete 9 duplicate/orphan cohorts
            $deleteIds = [139, 229, 158, 78, 187, 164, 84, 181, 188];

            DB::table('cohort_definitions')
                ->whereIn('id', $deleteIds)
                ->update(['deleted_at' => now()]);

            Log::info('Soft-deleted 9 duplicate/orphan cohorts: '.implode(', ', $deleteIds));
        });
    }

    public function down(): void
    {
        // Restore soft-deleted cohorts
        $deleteIds = [139, 229, 158, 78, 187, 164, 84, 181, 188];

        DB::table('cohort_definitions')
            ->whereIn('id', $deleteIds)
            ->update(['deleted_at' => null]);

        Log::info('Restored 9 soft-deleted cohorts: '.implode(', ', $deleteIds));

        // Reverse renames
        $reverseRenames = [
            75 => 'CKD Advanced Progression — Stages 4-5 or Dialysis First Occurrence',
            173 => 'S7: Composite MACE — First Occurrence (With CHF)',
            155 => 'S10: Metabolic Syndrome — First Occurrence',
            81 => 'Major Adverse Cardiovascular Events — MI or Stroke First Occurrence (Study 4)',
            174 => 'S7: All-Cause Death',
        ];

        foreach ($reverseRenames as $id => $oldName) {
            DB::table('cohort_definitions')->where('id', $id)->update(['name' => $oldName]);
        }

        Log::info('Reversed cohort renames');

        // NOTE: study_cohorts re-pointing (step 2) requires manual rollback.
        // The original cohort_definition_id values were: 158→158, 78→78, 187→187, 164→164, 84→84, 181→181, 188→188
        // Run manually if needed:
        //   UPDATE app.study_cohorts SET cohort_definition_id = 158 WHERE cohort_definition_id = 72 AND ...;
        //   (etc. — requires knowledge of which rows were originally pointed at the duplicate)
    }
};
