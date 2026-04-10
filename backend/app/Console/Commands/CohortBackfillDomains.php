<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Services\Cohort\CohortDomainDetector;
use Illuminate\Console\Command;

class CohortBackfillDomains extends Command
{
    protected $signature = 'cohort:backfill-domains {--dry-run : Show what would be changed without saving}';

    protected $description = 'Backfill NULL domains on cohort definitions using auto-detection';

    public function handle(CohortDomainDetector $detector): int
    {
        $isDryRun = $this->option('dry-run');

        // Include soft-deleted records — ALTER COLUMN SET NOT NULL affects ALL rows in PostgreSQL.
        $cohorts = CohortDefinition::withTrashed()
            ->whereNull('domain')
            ->whereNotNull('expression_json')
            ->get();

        // Soft-deleted rows with no expression_json get a default of 'general'.
        $nullNoExpression = CohortDefinition::withTrashed()
            ->whereNull('domain')
            ->whereNull('expression_json')
            ->count();

        if ($cohorts->isEmpty() && $nullNoExpression === 0) {
            $this->info('No cohorts with NULL domain found. Nothing to backfill.');

            return self::SUCCESS;
        }

        $total = $cohorts->count() + $nullNoExpression;
        $this->info("Found {$total} cohorts with NULL domain ({$nullNoExpression} with no expression, defaulting to 'general').");

        $filled = 0;
        $skipped = 0;

        // Default any null-expression rows to 'general' via raw update (avoids loading each model).
        if ($nullNoExpression > 0) {
            if ($isDryRun) {
                $this->line("  {$nullNoExpression} cohort(s) with NULL expression → general (dry run)");
            } else {
                CohortDefinition::withTrashed()
                    ->whereNull('domain')
                    ->whereNull('expression_json')
                    ->update(['domain' => 'general']);
                $this->line("  {$nullNoExpression} cohort(s) with NULL expression → general");
            }
            $filled += $nullNoExpression;
        }

        foreach ($cohorts as $cohort) {
            $expression = $cohort->expression_json;
            if (empty($expression)) {
                // Empty array [] stored as JSON — treat as no expression, default to general.
                if ($isDryRun) {
                    $this->line("  [{$cohort->id}] {$cohort->name} → general (empty expression, dry run)");
                } else {
                    $cohort->updateQuietly(['domain' => 'general']);
                    $this->line("  [{$cohort->id}] {$cohort->name} → general (empty expression)");
                }
                $filled++;

                continue;
            }

            $detected = $detector->detect($expression);
            $label = $cohort->deleted_at ? ' (soft-deleted)' : '';

            if ($isDryRun) {
                $this->line("  [{$cohort->id}] {$cohort->name}{$label} → {$detected->value} (dry run)");
            } else {
                $cohort->updateQuietly(['domain' => $detected->value]);
                $this->line("  [{$cohort->id}] {$cohort->name}{$label} → {$detected->value}");
            }

            $filled++;
        }

        $remainingNulls = CohortDefinition::withTrashed()
            ->whereNull('domain')
            ->count();

        $this->newLine();
        $this->info("Backfilled: {$filled} | Skipped: {$skipped} | Remaining NULLs: {$remainingNulls}");

        if ($remainingNulls === 0 && ! $isDryRun) {
            $this->info('All cohorts (including soft-deleted) have domains. Safe to run the NOT NULL migration.');
        }

        return self::SUCCESS;
    }
}
