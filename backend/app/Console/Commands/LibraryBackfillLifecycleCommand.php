<?php

namespace App\Console\Commands;

use App\Enums\LibraryStatus;
use App\Jobs\SuggestLibraryCleanupJob;
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
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Phase D · Task D8 — one-time backfill of library lifecycle status.
 *
 * Legacy rows pre-date the DRAFT/ACTIVE/ARCHIVED lifecycle and are all stored
 * as `active`. This command demotes the rows that should never have been in
 * the shared active library: an item is demoted to `draft` when it is
 *
 *   1. currently `active`,
 *   2. untouched for more than {@see self::STALE_DAYS} days,
 *   3. not attached to any non-archived Study, and
 *   4. for concept sets / cohort definitions, NOT published (`is_public = false`).
 *
 * The `is_public` guard protects curated, shared library content (e.g. the
 * OHDSI phenotype library) from being silently demoted. Analysis tables have
 * no `is_public` column, so they are demoted on staleness alone. `author_id`
 * is NOT NULL on every lifecycle table, so there is no null-owner "seed" case.
 *
 * Attachment is read from the same pivots the admin preflight uses:
 * concept sets via the `study_cohorts.concept_set_ids` JSON array, cohorts via
 * `study_cohorts.cohort_definition_id`, and analyses via the polymorphic
 * `study_analyses` pair — where `analysis_type` is the model FQCN in production.
 *
 * The staleness rule mirrors {@see SuggestLibraryCleanupJob}, so the
 * items demoted here are a subset of those the nightly job would flag as stale.
 */
class LibraryBackfillLifecycleCommand extends Command
{
    protected $signature = 'library:backfill-lifecycle {--dry-run : Report counts without writing} {--apply : Persist the status changes}';

    protected $description = 'Demote owned, stale (>90d), unattached active library items to draft.';

    /** Active items untouched for this many days are demotion candidates. */
    public const STALE_DAYS = 90;

    /** @var array<class-string, string> analysis model FQCN => backing table */
    private const ANALYSIS_MODELS = [
        IncidenceRateAnalysis::class => 'incidence_rate_analyses',
        PathwayAnalysis::class => 'pathway_analyses',
        EstimationAnalysis::class => 'estimation_analyses',
        PredictionAnalysis::class => 'prediction_analyses',
        FeatureAnalysis::class => 'feature_analyses',
        SccsAnalysis::class => 'sccs_analyses',
        EvidenceSynthesisAnalysis::class => 'evidence_synthesis_analyses',
        SelfControlledCohortAnalysis::class => 'self_controlled_cohort_analyses',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $apply = (bool) $this->option('apply');

        if (! $dryRun && ! $apply) {
            $this->error('Specify --dry-run or --apply.');

            return self::FAILURE;
        }

        if ($dryRun && $apply) {
            $this->error('Specify only one of --dry-run or --apply.');

            return self::FAILURE;
        }

        $cutoff = CarbonImmutable::now()->subDays(self::STALE_DAYS);
        $rows = [];
        $total = 0;

        foreach ($this->demotionCandidates($cutoff) as $table => $ids) {
            if ($apply && $ids !== []) {
                DB::table($table)
                    ->whereIn('id', $ids)
                    ->update(['status' => LibraryStatus::DRAFT->value]);
            }

            $total += count($ids);
            $rows[] = [$table, count($ids), $apply ? 'demoted' : 'would demote'];
        }

        $this->table(['Table', 'Count', 'Action'], $rows);

        $this->info($apply
            ? "Backfill applied — {$total} item(s) demoted to draft."
            : "Dry run complete — {$total} item(s) would be demoted to draft. Re-run with --apply to persist.");

        return self::SUCCESS;
    }

    /**
     * @return array<string, list<int>> table name => ids to demote to draft
     */
    private function demotionCandidates(CarbonImmutable $cutoff): array
    {
        return [
            'concept_sets' => $this->staleConceptSets($cutoff),
            'cohort_definitions' => $this->staleCohortDefinitions($cutoff),
            ...$this->staleAnalyses($cutoff),
        ];
    }

    /**
     * @return list<int>
     */
    private function staleConceptSets(CarbonImmutable $cutoff): array
    {
        return ConceptSet::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('is_public', false)
            ->where('updated_at', '<', $cutoff)
            ->whereNotIn('id', $this->attachedConceptSetIds())
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * @return list<int>
     */
    private function staleCohortDefinitions(CarbonImmutable $cutoff): array
    {
        return CohortDefinition::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('is_public', false)
            ->where('updated_at', '<', $cutoff)
            ->whereNotIn('id', function ($q): void {
                $q->select('cohort_definition_id')
                    ->from('study_cohorts')
                    ->join('studies', 'studies.id', '=', 'study_cohorts.study_id')
                    ->where('studies.status', '!=', 'archived');
            })
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * @return array<string, list<int>>
     */
    private function staleAnalyses(CarbonImmutable $cutoff): array
    {
        $result = [];

        foreach (self::ANALYSIS_MODELS as $modelClass => $table) {
            $result[$table] = $modelClass::query()
                ->withoutGlobalScope(LibraryDefaultScope::class)
                ->where('status', LibraryStatus::ACTIVE->value)
                ->where('updated_at', '<', $cutoff)
                ->whereNotIn('id', function ($q) use ($modelClass): void {
                    $q->select('analysis_id')
                        ->from('study_analyses')
                        ->join('studies', 'studies.id', '=', 'study_analyses.study_id')
                        ->where('study_analyses.analysis_type', $modelClass)
                        ->where('studies.status', '!=', 'archived');
                })
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        return $result;
    }

    /**
     * Concept-set ids referenced by any non-archived Study, via the
     * `study_cohorts.concept_set_ids` JSON array.
     *
     * @return list<int>
     */
    private function attachedConceptSetIds(): array
    {
        $arrays = DB::table('study_cohorts')
            ->join('studies', 'studies.id', '=', 'study_cohorts.study_id')
            ->where('studies.status', '!=', 'archived')
            ->whereNotNull('study_cohorts.concept_set_ids')
            ->pluck('study_cohorts.concept_set_ids');

        $ids = [];
        foreach ($arrays as $raw) {
            $decoded = is_array($raw) ? $raw : json_decode((string) $raw, true);
            if (is_array($decoded)) {
                foreach ($decoded as $value) {
                    $ids[(int) $value] = true;
                }
            }
        }

        return array_keys($ids);
    }
}
