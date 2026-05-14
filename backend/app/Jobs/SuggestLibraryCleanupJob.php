<?php

namespace App\Jobs;

use App\Enums\LibraryStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\FeatureAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\SelfControlledCohortAnalysis;
use App\Scopes\LibraryDefaultScope;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

/**
 * Nightly job: rebuild the library_cleanup_suggestions cache.
 *
 * A library item is "stale" if:
 *   1. status = 'active'
 *   2. updated_at < NOW() - 90 days
 *   3. NOT referenced by any non-archived Study
 *
 * Concept sets attach indirectly (via cohort_definitions.expression_json or
 * study_cohorts.concept_set_ids jsonb). For now we only check direct study
 * attachments for cohorts + analyses; concept-set staleness uses the
 * updated_at heuristic alone. Refine later if cleanup-suggestions UI shows
 * too many false positives.
 */
class SuggestLibraryCleanupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** @var array<class-string, string> */
    private const ANALYSIS_TYPES = [
        IncidenceRateAnalysis::class => 'incidence_rate_analysis',
        PathwayAnalysis::class => 'pathway_analysis',
        EstimationAnalysis::class => 'estimation_analysis',
        PredictionAnalysis::class => 'prediction_analysis',
        FeatureAnalysis::class => 'feature_analysis',
        SccsAnalysis::class => 'sccs_analysis',
        EvidenceSynthesisAnalysis::class => 'evidence_synthesis_analysis',
        SelfControlledCohortAnalysis::class => 'self_controlled_cohort_analysis',
    ];

    public function handle(): void
    {
        $cutoff = CarbonImmutable::now()->subDays(90);
        $now = CarbonImmutable::now();

        DB::transaction(function () use ($cutoff, $now) {
            DB::table('library_cleanup_suggestions')->truncate();

            $this->collectConceptSets($cutoff, $now);
            $this->collectCohortDefinitions($cutoff, $now);
            $this->collectAnalyses($cutoff, $now);
        });
    }

    private function collectConceptSets(CarbonImmutable $cutoff, CarbonImmutable $now): void
    {
        $rows = ConceptSet::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('updated_at', '<', $cutoff)
            ->get(['id', 'author_id', 'updated_at']);

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('library_cleanup_suggestions')->insert(
                $chunk->map(fn ($r) => [
                    'user_id' => $r->author_id,
                    'item_type' => 'concept_set',
                    'item_id' => $r->id,
                    'last_activity_at' => $r->updated_at,
                    'computed_at' => $now,
                ])->all()
            );
        }
    }

    private function collectCohortDefinitions(CarbonImmutable $cutoff, CarbonImmutable $now): void
    {
        $rows = CohortDefinition::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('updated_at', '<', $cutoff)
            ->whereNotIn('id', function ($q) {
                $q->select('cohort_definition_id')
                    ->from('study_cohorts')
                    ->join('studies', 'studies.id', '=', 'study_cohorts.study_id')
                    ->where('studies.status', '!=', 'archived');
            })
            ->get(['id', 'author_id', 'updated_at']);

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('library_cleanup_suggestions')->insert(
                $chunk->map(fn ($r) => [
                    'user_id' => $r->author_id,
                    'item_type' => 'cohort_definition',
                    'item_id' => $r->id,
                    'last_activity_at' => $r->updated_at,
                    'computed_at' => $now,
                ])->all()
            );
        }
    }

    private function collectAnalyses(CarbonImmutable $cutoff, CarbonImmutable $now): void
    {
        foreach (self::ANALYSIS_TYPES as $modelClass => $itemType) {
            $rows = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->where('status', LibraryStatus::ACTIVE->value)
                ->where('updated_at', '<', $cutoff)
                ->whereNotIn('id', function ($q) use ($modelClass) {
                    $q->select('analysis_id')
                        ->from('study_analyses')
                        ->join('studies', 'studies.id', '=', 'study_analyses.study_id')
                        ->where('study_analyses.analysis_type', $modelClass)
                        ->where('studies.status', '!=', 'archived');
                })
                ->get(['id', 'author_id', 'updated_at']);

            foreach ($rows->chunk(500) as $chunk) {
                DB::table('library_cleanup_suggestions')->insert(
                    $chunk->map(fn ($r) => [
                        'user_id' => $r->author_id,
                        'item_type' => $itemType,
                        'item_id' => $r->id,
                        'last_activity_at' => $r->updated_at,
                        'computed_at' => $now,
                    ])->all()
                );
            }
        }
    }
}
