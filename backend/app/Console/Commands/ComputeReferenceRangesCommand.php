<?php

namespace App\Console\Commands;

use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ComputeReferenceRangesCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'labs:compute-reference-ranges
        {--source= : Single source_key (omit for all enabled sources)}
        {--min-n=30 : Minimum observations per (concept, unit)}
        {--concepts= : Comma-separated measurement_concept_ids}
        {--dry-run : Report without writing}';

    /**
     * @var string
     */
    protected $description = 'Compute per-source population reference ranges (P2.5/P50/P97.5) from measurement data';

    public function handle(): int
    {
        $sourceKey = $this->option('source');
        $minN = (int) $this->option('min-n');
        $dryRun = (bool) $this->option('dry-run');
        $conceptsRaw = $this->option('concepts');

        /** @var list<int>|null $conceptFilter */
        $conceptFilter = null;
        if (is_string($conceptsRaw) && $conceptsRaw !== '') {
            $conceptFilter = array_map('intval', explode(',', $conceptsRaw));
        }

        $query = Source::with('daimons');
        if (is_string($sourceKey) && $sourceKey !== '') {
            $query->where('source_key', $sourceKey);
        }

        /** @var Collection<int, Source> $sources */
        $sources = $query->get();

        if ($sources->isEmpty()) {
            $this->warn('No sources found.');

            return self::SUCCESS;
        }

        foreach ($sources as $source) {
            try {
                $this->processSource($source, $minN, $dryRun, $conceptFilter);
            } catch (\Throwable $e) {
                $this->error("Source [{$source->source_key}] failed: {$e->getMessage()}");
            }
        }

        return self::SUCCESS;
    }

    /**
     * @param  list<int>|null  $conceptFilter
     */
    private function processSource(Source $source, int $minN, bool $dryRun, ?array $conceptFilter): void
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if ($cdmSchema === null) {
            $this->warn("Source [{$source->source_key}] has no CDM daimon — skipping.");

            return;
        }

        $this->info("Processing source [{$source->source_key}] (schema: {$cdmSchema})...");

        $sql = "
            SELECT
                measurement_concept_id,
                unit_concept_id,
                percentile_cont(0.025) WITHIN GROUP (ORDER BY value_as_number) AS p025,
                percentile_cont(0.500) WITHIN GROUP (ORDER BY value_as_number) AS p500,
                percentile_cont(0.975) WITHIN GROUP (ORDER BY value_as_number) AS p975,
                COUNT(*) AS n
            FROM \"{$cdmSchema}\".measurement
            WHERE value_as_number IS NOT NULL
              AND unit_concept_id IS NOT NULL
        ";

        $bindings = [];

        if ($conceptFilter !== null) {
            $placeholders = implode(',', array_fill(0, count($conceptFilter), '?'));
            $sql .= " AND measurement_concept_id IN ({$placeholders})";
            $bindings = $conceptFilter;
        }

        $sql .= '
            GROUP BY measurement_concept_id, unit_concept_id
            HAVING COUNT(*) >= ?
        ';

        $bindings[] = $minN;

        /** @var list<object> $rows */
        $rows = DB::select($sql, $bindings);

        $this->info('  Found '.count($rows)." concept/unit groups with >= {$minN} observations.");

        if ($dryRun) {
            $this->info('  Dry run — skipping writes.');

            return;
        }

        foreach ($rows as $row) {
            DB::table('lab_reference_range_population')->updateOrInsert(
                [
                    'source_id' => $source->id,
                    'measurement_concept_id' => (int) $row->measurement_concept_id,
                    'unit_concept_id' => (int) $row->unit_concept_id,
                ],
                [
                    'range_low' => $row->p025,
                    'range_high' => $row->p975,
                    'median' => $row->p500,
                    'n_observations' => (int) $row->n,
                    'computed_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }

        $this->info('  Wrote '.count($rows).' rows.');
    }
}
