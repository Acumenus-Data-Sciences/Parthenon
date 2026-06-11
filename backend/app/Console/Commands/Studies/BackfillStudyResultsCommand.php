<?php

namespace App\Console\Commands\Studies;

use App\Models\App\Study;
use App\Services\Studies\StudyResultProjector;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

/**
 * Backfill curated study_results rows from already-completed analysis
 * executions. Idempotent — re-running updates derived fields and preserves
 * reviewer curation (is_primary). Reads analysis_executions; writes study_results.
 */
class BackfillStudyResultsCommand extends Command
{
    protected $signature = 'studies:backfill-results
        {study? : Study id or slug (omit to backfill every study)}
        {--dry-run : Report what would be projected without writing}';

    protected $description = 'Project completed analysis executions into study_results for the study Results tab';

    public function handle(StudyResultProjector $projector): int
    {
        $studies = $this->resolveStudies();

        if ($studies->isEmpty()) {
            $this->warn('No matching studies found.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $grandTotal = 0;

        foreach ($studies as $study) {
            if ($dryRun) {
                $pending = $study->analyses()->count();
                $this->line(sprintf('• [dry-run] %s (#%d): %d linked analyses', $study->title, $study->id, $pending));

                continue;
            }

            $projected = $projector->projectStudy($study);
            $grandTotal += $projected;
            $this->line(sprintf('• %s (#%d): %d result row(s) projected', $study->title, $study->id, $projected));
        }

        if (! $dryRun) {
            $this->info(sprintf('Done. %d study_results row(s) upserted across %d study(ies).', $grandTotal, $studies->count()));
        }

        return self::SUCCESS;
    }

    /**
     * @return Collection<int, Study>
     */
    private function resolveStudies(): Collection
    {
        $arg = $this->argument('study');

        if ($arg === null) {
            return Study::query()->orderBy('id')->get();
        }

        $query = Study::query();
        if (is_numeric($arg)) {
            $query->where('id', (int) $arg);
        } else {
            $query->where('slug', $arg);
        }

        return $query->get();
    }
}
