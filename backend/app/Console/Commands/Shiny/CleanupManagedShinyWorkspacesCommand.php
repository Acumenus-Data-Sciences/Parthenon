<?php

declare(strict_types=1);

namespace App\Console\Commands\Shiny;

use App\Models\App\ManagedShinyLaunch;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use JsonException;
use Throwable;

class CleanupManagedShinyWorkspacesCommand extends Command
{
    protected $signature = 'shiny:cleanup-workspaces
        {--grace-minutes= : Override minutes after token expiry before deleting a workspace}
        {--orphan-grace-minutes= : Override minutes after directory mtime before deleting an untracked UUID workspace}
        {--dry-run : Print JSONL cleanup plan without deleting workspaces}';

    protected $description = 'Delete expired managed OHDSI Shiny launch workspaces after the configured grace period.';

    public function handle(): int
    {
        $graceMinutes = $this->resolveGraceMinutes();
        if ($graceMinutes === null) {
            return self::FAILURE;
        }

        $orphanGraceMinutes = $this->resolveOrphanGraceMinutes();
        if ($orphanGraceMinutes === null) {
            return self::FAILURE;
        }

        $workspaceRoot = $this->workspaceRoot();
        if ($workspaceRoot === null) {
            return self::FAILURE;
        }

        $launchesRoot = $workspaceRoot.'/launches';
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->subMinutes($graceMinutes);
        $orphanCutoff = now()->subMinutes($orphanGraceMinutes);

        if (! File::isDirectory($launchesRoot)) {
            $this->emitJsonLine([
                'status' => 'ok',
                'message' => 'launches_root_missing',
                'deleted' => 0,
                'skipped' => 0,
                'errors' => 0,
                'dry_run' => $dryRun,
                'grace_minutes' => $graceMinutes,
                'orphan_grace_minutes' => $orphanGraceMinutes,
                'launches_root' => $launchesRoot,
            ]);

            return self::SUCCESS;
        }

        $deleted = 0;
        $skipped = 0;
        $errors = 0;

        foreach (File::directories($launchesRoot) as $workspacePath) {
            $workspaceId = basename($workspacePath);

            if (is_link($workspacePath)) {
                $skipped++;
                $this->emitJsonLine([
                    'action' => 'skip_symlink',
                    'workspace_id' => $workspaceId,
                    'workspace_path' => $workspacePath,
                ]);

                continue;
            }

            if (! Str::isUuid($workspaceId)) {
                $skipped++;
                $this->emitJsonLine([
                    'action' => 'skip_malformed',
                    'workspace_id' => $workspaceId,
                    'workspace_path' => $workspacePath,
                ]);

                continue;
            }

            $launch = ManagedShinyLaunch::query()
                ->where('workspace_id', $workspaceId)
                ->latest('id')
                ->first();

            if (! $launch instanceof ManagedShinyLaunch) {
                $mtime = @filemtime($workspacePath);
                if ($mtime === false || Carbon::createFromTimestamp($mtime)->greaterThan($orphanCutoff)) {
                    $skipped++;
                    $this->emitJsonLine([
                        'action' => 'skip_untracked',
                        'workspace_id' => $workspaceId,
                        'workspace_path' => $workspacePath,
                        'mtime' => $mtime !== false ? Carbon::createFromTimestamp($mtime)->toIso8601String() : null,
                        'orphan_cutoff' => $orphanCutoff->toIso8601String(),
                    ]);

                    continue;
                }

                $this->emitJsonLine([
                    'action' => $dryRun ? 'would_delete_untracked' : 'delete_untracked',
                    'workspace_id' => $workspaceId,
                    'workspace_path' => $workspacePath,
                    'mtime' => Carbon::createFromTimestamp($mtime)->toIso8601String(),
                    'orphan_cutoff' => $orphanCutoff->toIso8601String(),
                ]);

                if ($dryRun) {
                    $deleted++;

                    continue;
                }

                try {
                    $this->deleteWorkspace($workspacePath);
                    $deleted++;
                } catch (Throwable $e) {
                    Log::error(sprintf(
                        'shiny:cleanup-workspaces failed to delete untracked %s: %s',
                        $workspacePath,
                        $e->getMessage(),
                    ));
                    $errors++;
                }

                continue;
            }

            if (! $this->isExpiredPastGrace($launch, $cutoff)) {
                $skipped++;
                $this->emitJsonLine([
                    'action' => 'skip_active',
                    'workspace_id' => $workspaceId,
                    'workspace_path' => $workspacePath,
                    'expires_at' => $launch->expires_at?->toIso8601String(),
                    'cutoff' => $cutoff->toIso8601String(),
                ]);

                continue;
            }

            $this->emitJsonLine([
                'action' => $dryRun ? 'would_delete' : 'delete',
                'workspace_id' => $workspaceId,
                'workspace_path' => $workspacePath,
                'expires_at' => $launch->expires_at?->toIso8601String(),
                'cutoff' => $cutoff->toIso8601String(),
            ]);

            if ($dryRun) {
                $deleted++;

                continue;
            }

            try {
                $this->deleteWorkspace($workspacePath);
                $this->markWorkspaceCleaned($launch);
                $deleted++;
            } catch (Throwable $e) {
                Log::error(sprintf(
                    'shiny:cleanup-workspaces failed to delete %s: %s',
                    $workspacePath,
                    $e->getMessage(),
                ));
                $errors++;
            }
        }

        $this->emitJsonLine([
            'status' => $errors > 0 ? 'partial' : 'ok',
            'deleted' => $deleted,
            'skipped' => $skipped,
            'errors' => $errors,
            'dry_run' => $dryRun,
            'grace_minutes' => $graceMinutes,
            'orphan_grace_minutes' => $orphanGraceMinutes,
            'launches_root' => $launchesRoot,
        ]);

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }

    protected function workspaceRoot(): ?string
    {
        $root = rtrim((string) (config('services.shiny_proxy.workspace_root') ?: storage_path('app/managed-shiny')), '/');

        if ($root === '' || $root === '/') {
            $this->error('Refusing to clean managed Shiny workspaces with an unsafe root.');

            return null;
        }

        return $root;
    }

    private function resolveGraceMinutes(): ?int
    {
        return $this->resolveMinutesOption(
            'grace-minutes',
            (int) config('services.shiny_proxy.workspace_cleanup_grace_minutes', 60),
        );
    }

    private function resolveOrphanGraceMinutes(): ?int
    {
        return $this->resolveMinutesOption(
            'orphan-grace-minutes',
            (int) config('services.shiny_proxy.workspace_orphan_cleanup_grace_minutes', 1440),
        );
    }

    private function resolveMinutesOption(string $option, int $default): ?int
    {
        $raw = $this->option($option);
        $value = $raw === null || $raw === ''
            ? $default
            : filter_var($raw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);

        if ($value === false || $value < 0) {
            $this->error("Invalid --{$option} value; expected a non-negative integer.");

            return null;
        }

        return (int) $value;
    }

    private function isExpiredPastGrace(ManagedShinyLaunch $launch, Carbon $cutoff): bool
    {
        return $launch->expires_at instanceof Carbon && $launch->expires_at->lessThanOrEqualTo($cutoff);
    }

    private function deleteWorkspace(string $workspacePath): void
    {
        if (! File::deleteDirectory($workspacePath)) {
            throw new \RuntimeException('deleteDirectory returned false');
        }
    }

    private function markWorkspaceCleaned(ManagedShinyLaunch $launch): void
    {
        $metadata = $launch->metadata ?? [];
        $metadata['workspace_cleaned_at'] = now()->toIso8601String();

        $launch->forceFill(['metadata' => $metadata])->save();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function emitJsonLine(array $payload): void
    {
        try {
            $this->line(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        } catch (JsonException $e) {
            $this->warn('Failed to encode JSONL payload: '.$e->getMessage());
        }
    }
}
