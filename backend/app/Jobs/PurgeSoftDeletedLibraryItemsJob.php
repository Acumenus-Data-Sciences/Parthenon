<?php

namespace App\Jobs;

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
use Illuminate\Support\Facades\Log;

/**
 * Phase D · §6.7 — nightly purge of soft-deleted library items.
 *
 * Items soft-deleted via admin bulk-delete (D4) enter a 30-day grace window.
 * After that window expires the row is force-deleted. Each purge writes an
 * audit_log row with action='library.purge' so the operation is auditable
 * after the snapshot is gone.
 */
class PurgeSoftDeletedLibraryItemsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Days a soft-deleted item is retained before force-delete. */
    public const GRACE_DAYS = 30;

    /**
     * @return array<class-string, string> Model class → item_type slug
     */
    private function models(): array
    {
        return [
            ConceptSet::class => 'concept_set',
            CohortDefinition::class => 'cohort_definition',
            IncidenceRateAnalysis::class => 'incidence_rate_analysis',
            PathwayAnalysis::class => 'pathway_analysis',
            EstimationAnalysis::class => 'estimation_analysis',
            PredictionAnalysis::class => 'prediction_analysis',
            FeatureAnalysis::class => 'feature_analysis',
            SccsAnalysis::class => 'sccs_analysis',
            EvidenceSynthesisAnalysis::class => 'evidence_synthesis_analysis',
            SelfControlledCohortAnalysis::class => 'self_controlled_cohort_analysis',
        ];
    }

    public function handle(): void
    {
        $cutoff = CarbonImmutable::now()->subDays(self::GRACE_DAYS);
        $totals = ['scanned' => 0, 'purged' => 0];

        foreach ($this->models() as $modelClass => $itemType) {
            $expired = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->onlyTrashed()
                ->where('deleted_at', '<', $cutoff)
                ->get();

            $totals['scanned'] += $expired->count();

            foreach ($expired as $item) {
                DB::transaction(function () use ($item, $itemType): void {
                    DB::table('audit_log')->insert([
                        'actor_id' => null,
                        'action' => 'library.purge',
                        'subject_type' => $itemType,
                        'subject_id' => $item->getKey(),
                        'snapshot' => json_encode($item->toArray()),
                        'created_at' => now(),
                    ]);
                    $item->forceDelete();
                });
                $totals['purged']++;
            }
        }

        if ($totals['purged'] > 0) {
            Log::info('[library.purge] forced-deleted soft-deleted library items', $totals);
        }
    }
}
