<?php

namespace App\Console\Commands;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\Results\AchillesRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillReleasesCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'ares:backfill-releases';

    /**
     * @var string
     */
    protected $description = 'Create legacy releases for existing sources with Achilles/DQD runs';

    public function handle(): int
    {
        $created = 0;

        $sources = Source::whereHas('daimons')->get();

        foreach ($sources as $source) {
            // Skip if source already has releases (idempotent)
            if (SourceRelease::where('source_id', $source->id)->exists()) {
                $this->line("  Skipping source [{$source->source_key}] — releases already exist.");

                continue;
            }

            // Skip if source has no Achilles runs
            if (! AchillesRun::where('source_id', $source->id)->exists()) {
                $this->line("  Skipping source [{$source->source_key}] — no Achilles runs found.");

                continue;
            }

            // Create the legacy release
            $release = SourceRelease::create([
                'source_id' => $source->id,
                'release_key' => "{$source->source_key}-legacy",
                'release_name' => 'Pre-Ares Legacy',
                'release_type' => 'snapshot',
                'notes' => 'Auto-created by ares:backfill-releases for pre-existing data.',
            ]);

            // Backfill achilles_runs with null release_id
            $achillesCount = AchillesRun::where('source_id', $source->id)
                ->whereNull('release_id')
                ->update(['release_id' => $release->id]);

            // Backfill dqd_results with null release_id
            $dqdCount = DB::table('dqd_results')
                ->where('source_id', $source->id)
                ->whereNull('release_id')
                ->update(['release_id' => $release->id]);

            $this->info(
                "  Created legacy release [{$release->release_key}] for source [{$source->source_key}]"
                ." — backfilled {$achillesCount} Achilles run(s) and {$dqdCount} DQD result row(s)."
            );

            $created++;
        }

        $this->info("Done. Created {$created} legacy release(s).");

        return self::SUCCESS;
    }
}
