<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        // --- Domain assignments ---
        $domainMap = [
            'cardiovascular' => [66, 67, 68, 79, 80, 81, 82, 83, 173, 175, 176, 195, 196],
            'metabolic' => [70, 71, 72, 155, 156, 159, 184, 185, 186, 189, 190, 197],
            'renal' => [69, 73, 74, 75, 76, 77, 157, 160, 161, 162, 167, 169],
            'rare-disease' => range(198, 219),
            'oncology' => range(221, 225),
            'pain-substance-use' => range(177, 183),
            'pediatric' => [228],
            'general' => [154, 163, 165, 166, 168, 170, 174],
        ];

        foreach ($domainMap as $domain => $ids) {
            $count = DB::table('cohort_definitions')
                ->whereIn('id', $ids)
                ->whereNull('deleted_at')
                ->update(['domain' => $domain]);

            Log::info("Cohort domain assignment: set {$count} cohorts to domain '{$domain}'");
        }

        // --- Quality tier computation ---
        // Get IDs of cohorts with at least one completed generation
        $completedGenerationIds = DB::table('cohort_generations')
            ->where('status', 'completed')
            ->distinct()
            ->pluck('cohort_definition_id')
            ->toArray();

        // Get IDs of cohorts linked to at least one study
        $studyCohortIds = DB::table('study_cohorts')
            ->distinct()
            ->pluck('cohort_definition_id')
            ->toArray();

        // Process all active cohort definitions
        $cohorts = DB::table('cohort_definitions')
            ->whereNull('deleted_at')
            ->select(['id', 'expression_json'])
            ->get();

        $tierCounts = ['study-ready' => 0, 'validated' => 0, 'draft' => 0];

        foreach ($cohorts as $cohort) {
            $hasCompletedGeneration = in_array($cohort->id, $completedGenerationIds);
            $hasStudyCohort = in_array($cohort->id, $studyCohortIds);

            $tier = 'draft';

            if ($hasCompletedGeneration) {
                $tier = 'validated';

                if ($hasStudyCohort) {
                    // Check expression richness for study-ready
                    $expression = json_decode($cohort->expression_json ?? '{}', true);
                    $conceptSetCount = count($expression['ConceptSets'] ?? []);
                    $hasInclusionRules = ! empty($expression['AdditionalCriteria']['CriteriaList'] ?? []);
                    $hasEndStrategy = isset($expression['EndStrategy']) && $expression['EndStrategy'] !== null;

                    if ($conceptSetCount >= 2 || $hasInclusionRules || $hasEndStrategy) {
                        $tier = 'study-ready';
                    }
                }
            }

            DB::table('cohort_definitions')
                ->where('id', $cohort->id)
                ->update(['quality_tier' => $tier]);

            $tierCounts[$tier]++;
        }

        Log::info('Cohort quality tier assignment complete', $tierCounts);
    }

    public function down(): void
    {
        DB::table('cohort_definitions')->update([
            'domain' => null,
            'quality_tier' => null,
        ]);

        Log::info('Cohort domain and quality_tier values cleared');
    }
};
