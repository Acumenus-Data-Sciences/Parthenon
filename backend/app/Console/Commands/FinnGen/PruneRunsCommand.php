<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\Run;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Nightly GC for finished, unpinned runs. Spec §3.5.
 *
 * Deletes rows from app.finngen_runs AND removes the corresponding artifact
 * directory from /opt/finngen-artifacts/runs/{id}. Idempotent: if the
 * directory is already missing, continues deleting the row.
 */
class PruneRunsCommand extends Command
{
    protected $signature = 'finngen:prune-runs {--dry-run : Report what would be deleted without deleting}';

    protected $description = 'Delete finished, unpinned FinnGen runs older than the retention window';

    public function handle(): int
    {
        $retentionDays = (int) config('finngen.gc_retention_days');
        $artifactsPath = rtrim((string) config('finngen.artifacts_path'), '/');
        $dryRun = (bool) $this->option('dry-run');

        $count = Run::eligibleForGC($retentionDays)->count();

        $this->info("Found {$count} runs eligible for prune (retention={$retentionDays}d)".($dryRun ? ' [dry-run]' : ''));

        if ($count === 0) {
            return self::SUCCESS;
        }

        $bytesFreed = 0;
        $deleted = 0;

        Run::eligibleForGC($retentionDays)->chunkById(200, function ($chunk) use ($artifactsPath, $dryRun, &$bytesFreed, &$deleted) {
            foreach ($chunk as $run) {
                $dir = "{$artifactsPath}/runs/{$run->id}";

                if (is_dir($dir)) {
                    $bytesFreed += $this->directorySize($dir);
                    if (! $dryRun) {
                        File::deleteDirectory($dir);
                    }
                }

                if (! $dryRun) {
                    $run->delete();
                }
                $deleted++;
            }
        });

        $this->info(sprintf('Pruned %d runs (%s freed)%s', $deleted, $this->humanBytes($bytesFreed), $dryRun ? ' [dry-run — nothing changed]' : ''));

        if (! $dryRun) {
            Log::info('finngen.gc.pruned', ['count' => $deleted, 'bytes_freed' => $bytesFreed]);
        }

        return self::SUCCESS;
    }

    private function directorySize(string $dir): int
    {
        $size = 0;
        foreach (File::allFiles($dir) as $f) {
            $size += $f->getSize();
        }

        return $size;
    }

    private function humanBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        $n = (float) $bytes;
        while ($n >= 1024 && $i < count($units) - 1) {
            $n /= 1024;
            $i++;
        }

        return sprintf('%.1f %s', $n, $units[$i]);
    }
}
