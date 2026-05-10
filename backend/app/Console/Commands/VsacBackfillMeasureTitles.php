<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class VsacBackfillMeasureTitles extends Command
{
    protected $signature = 'vsac:backfill-measure-titles
        {--file=database/data/vsac_measure_titles.json : Path to the CMS_ID → title JSON map (relative to base_path)}
        {--overwrite : Overwrite existing non-empty titles}
        {--dry-run : Preview without writing}';

    protected $description = 'Populate app.vsac_measures.title from a curated CMS_ID → title JSON map (CMS eCQI catalog).';

    public function handle(): int
    {
        $path = base_path($this->option('file'));
        if (! is_file($path)) {
            $this->error("Title map not found: {$path}");

            return self::FAILURE;
        }

        $map = json_decode((string) file_get_contents($path), true);
        if (! is_array($map) || $map === []) {
            $this->error('Title map is empty or invalid JSON.');

            return self::FAILURE;
        }

        $overwrite = (bool) $this->option('overwrite');
        $dryRun = (bool) $this->option('dry-run');

        $existing = DB::table('vsac_measures')
            ->select('cms_id', 'title')
            ->get()
            ->keyBy('cms_id');

        $updated = 0;
        $skippedExisting = 0;
        $missingInDb = 0;

        foreach ($map as $cmsId => $title) {
            if (! isset($existing[$cmsId])) {
                $missingInDb++;

                continue;
            }

            $current = $existing[$cmsId]->title;
            if (! $overwrite && filled($current)) {
                $skippedExisting++;

                continue;
            }

            if ($dryRun) {
                $this->line(sprintf('  would set %s → %s', $cmsId, mb_substr((string) $title, 0, 60)));
            } else {
                DB::table('vsac_measures')
                    ->where('cms_id', $cmsId)
                    ->update(['title' => $title]);
            }
            $updated++;
        }

        $unmappedInDb = $existing->keys()
            ->diff(array_keys($map))
            ->filter(fn ($cid) => blank($existing[$cid]->title))
            ->values();

        $this->info(sprintf(
            '%s: updated=%d skipped_existing=%d not_in_db=%d unmapped_in_db_still_blank=%d',
            $dryRun ? 'DRY RUN' : 'OK',
            $updated,
            $skippedExisting,
            $missingInDb,
            $unmappedInDb->count(),
        ));

        if ($unmappedInDb->isNotEmpty()) {
            $this->warn('DB measures still missing title (no entry in JSON map):');
            foreach ($unmappedInDb as $cid) {
                $this->line("  {$cid}");
            }
        }

        return self::SUCCESS;
    }
}
