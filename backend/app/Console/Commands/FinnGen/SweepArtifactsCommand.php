<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\Run;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Weekly artifact integrity sweep. Spec §5.9.
 *
 *   1. Mark runs as artifacts_pruned when their files have gone missing on disk.
 *   2. Clean up zombie directories (on disk but no Run row).
 */
class SweepArtifactsCommand extends Command
{
    protected $signature = 'finngen:sweep-artifacts {--dry-run}';

    protected $description = 'Reconcile finngen-artifacts volume against finngen_runs rows';

    public function handle(): int
    {
        $artifactsPath = rtrim((string) config('finngen.artifacts_path'), '/');
        $dryRun = (bool) $this->option('dry-run');

        $runsMarkedPruned = 0;
        $zombieDirsRemoved = 0;
        $bytesFreed = 0;

        // Pass 1: runs with missing artifact files
        Run::where('status', Run::STATUS_SUCCEEDED)
            ->whereNotNull('artifacts')
            ->where('artifacts_pruned', false)
            ->chunkById(200, function ($chunk) use ($artifactsPath, $dryRun, &$runsMarkedPruned) {
                foreach ($chunk as $run) {
                    $artifacts = $run->artifacts;
                    if (empty($artifacts) || ! is_array($artifacts)) {
                        continue;
                    }
                    $anyMissing = false;
                    foreach ($artifacts as $relative) {
                        if (! is_string($relative) || ! is_file("{$artifactsPath}/{$relative}")) {
                            $anyMissing = true;
                            break;
                        }
                    }
                    if ($anyMissing) {
                        if (! $dryRun) {
                            $run->update([
                                'artifacts' => [],
                                'artifacts_pruned' => true,
                                'artifacts_pruned_at' => now(),
                            ]);
                        }
                        $runsMarkedPruned++;
                    }
                }
            });

        // Pass 2: zombie directories
        $runsDir = "{$artifactsPath}/runs";
        if (is_dir($runsDir)) {
            foreach (File::directories($runsDir) as $dir) {
                $id = basename($dir);
                if (! Run::whereKey($id)->exists()) {
                    $size = 0;
                    foreach (File::allFiles($dir) as $f) {
                        $size += $f->getSize();
                    }
                    if (! $dryRun) {
                        File::deleteDirectory($dir);
                    }
                    $zombieDirsRemoved++;
                    $bytesFreed += $size;
                }
            }
        }

        $this->info(sprintf(
            'Sweep complete: %d runs marked pruned, %d zombie dirs removed (%d bytes)%s',
            $runsMarkedPruned,
            $zombieDirsRemoved,
            $bytesFreed,
            $dryRun ? ' [dry-run]' : ''
        ));

        if (! $dryRun) {
            Log::info('finngen.sweep.completed', [
                'runs_marked_pruned' => $runsMarkedPruned,
                'zombie_dirs_removed' => $zombieDirsRemoved,
                'bytes_freed' => $bytesFreed,
            ]);
        }

        return self::SUCCESS;
    }
}
