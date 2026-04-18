<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use JsonException;
use Throwable;

/**
 * Phase 14 (D-04) — step-1 LOCO artifact pruning.
 *
 * Default eviction policy per D-04 is "keep forever"; this command is the
 * manual safety valve operators invoke when disk pressure warrants it.
 *
 * Cache layout (owned by Wave 5 GwasRunService::step1CacheDir):
 *   {CACHE_ROOT}/gwas/step1/{source_lower}/{cache_key}/
 *     fit_pred.list     ← marker file (stats this for mtime)
 *     chr_{chrom}.loco  ← per-chromosome predictions
 *     summary.json      ← step-1 R worker envelope
 *
 * Walks the {source_lower}/{cache_key} subtree, stats fit_pred.list (falls
 * back to the directory mtime when the marker is absent), and removes
 * directories older than --older-than. --dry-run emits a JSONL eviction
 * plan without touching disk.
 *
 * Safety posture (HIGHSEC):
 *   §1.1 Least privilege — super-admin gate OR APP_ENV=local|testing OR
 *        --force-as-user=ID (mirrors PrepareSourceVariantsCommand).
 *   §10  No shell_exec / passthru / exec — deletion uses
 *        Illuminate\Support\Facades\File::deleteDirectory. --source is
 *        preg_match allow-list validated before any filesystem call so
 *        shell-injection via glob is impossible.
 *
 * T-14-28 mitigation (cache-prune tampering) — --source is re-validated
 * against /^[a-z][a-z0-9_]*$/ before glob() runs; unsafe values throw an
 * InvalidArgumentException that the command catches and surfaces as exit 1.
 *
 * T-14-29 mitigation (destructive scope) — every deletion emits a
 * per-directory JSONL line with action + path + mtime BEFORE the rmdir
 * call, so operators have an audit trail even if the command is aborted.
 */
class GwasCachePruneCommand extends Command
{
    /**
     * Canonical cache root. The tests override cacheRoot() to point at a
     * tempdir; production resolves via the finngen config artifacts_path.
     * Kept as a class constant for the documentation value — the actual
     * path comes from the cacheRoot() method below.
     */
    private const DEFAULT_CACHE_SUBPATH = 'gwas/step1';

    protected $signature = 'finngen:gwas-cache-prune
        {--older-than=30d : Age threshold (e.g., 30d, 12h, 7d, 1h, 90s)}
        {--source= : Limit to one source subtree (preg_match allow-list validated)}
        {--dry-run : Print JSONL eviction plan; do not delete}
        {--force-as-user= : Run as user id X (super-admin test bypass)}';

    protected $description = 'Prune step-1 LOCO cache artifacts older than threshold (D-04)';

    public function handle(): int
    {
        // 1. Auth gate (HIGHSEC §1.1).
        if (! $this->authorizedToRun()) {
            $this->error('finngen:gwas-cache-prune requires super-admin.');
            $this->line('  - Run inside APP_ENV=local|testing, OR');
            $this->line('  - Pass --force-as-user=ID where ID is a super-admin user, OR');
            $this->line('  - Invoke as an authenticated super-admin via `php artisan`.');

            return self::FAILURE;
        }

        // 2. Parse --older-than.
        $ageStr = (string) $this->option('older-than');
        $ageSec = $this->parseAge($ageStr);
        if ($ageSec === null) {
            $this->error("Invalid --older-than format '{$ageStr}'; expected like 30d, 12h, 7d, 1h, 90s.");

            return self::FAILURE;
        }
        $cutoff = time() - $ageSec;
        $dryRun = (bool) $this->option('dry-run');

        // 3. Build glob — may throw on unsafe --source (T-14-28).
        try {
            $glob = $this->buildGlobPath();
        } catch (\InvalidArgumentException $e) {
            $this->error('Invalid --source: '.$e->getMessage());

            return self::FAILURE;
        }

        // 4. Enumerate candidates. If the cache root doesn't exist yet, no-op.
        $candidates = glob($glob, GLOB_ONLYDIR) ?: [];

        $evicted = 0;
        $skipped = 0;
        $errors = 0;

        foreach ($candidates as $cacheDir) {
            $marker = $cacheDir.'/fit_pred.list';
            // Marker file is authoritative per the cache layout spec; fall
            // back to directory mtime when absent (partial / aborted run).
            $mtime = @filemtime(is_file($marker) ? $marker : $cacheDir);
            if ($mtime === false) {
                $skipped++;

                continue;
            }
            if ($mtime >= $cutoff) {
                $skipped++;

                continue;
            }

            // Emit BEFORE the delete so we never lose the audit trail even
            // if the rmdir is aborted (T-14-29 mitigation).
            $this->emitJsonLine([
                'action' => $dryRun ? 'would_delete' : 'delete',
                'cache_dir' => $cacheDir,
                'mtime' => Carbon::createFromTimestamp($mtime)->toIso8601String(),
                'age_seconds' => time() - $mtime,
            ]);

            if ($dryRun) {
                $evicted++;

                continue;
            }

            try {
                File::deleteDirectory($cacheDir);
                $evicted++;
            } catch (Throwable $e) {
                Log::error(sprintf(
                    'gwas-cache-prune: failed to delete %s: %s',
                    $cacheDir,
                    $e->getMessage()
                ));
                $errors++;
            }
        }

        $this->emitJsonLine([
            'status' => $errors > 0 ? 'partial' : 'ok',
            'evicted' => $evicted,
            'skipped' => $skipped,
            'errors' => $errors,
            'dry_run' => $dryRun,
            'older_than' => $ageStr,
            'cache_root' => $this->cacheRoot(),
        ]);

        // Exit 0 when no deletion errors occurred (per D-04 operational
        // semantics — empty cache is a normal no-op).
        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }

    // ------------------------------------------------------------------
    // Helpers (testability hooks)
    // ------------------------------------------------------------------

    /**
     * Resolve the cache root — subclasses override for test isolation
     * (see GwasCachePruneCommandTest which binds a tempdir subclass).
     *
     * Production: reads finngen.artifacts_path config (default
     * /opt/finngen-artifacts) and appends the canonical step-1 subpath.
     */
    protected function cacheRoot(): string
    {
        $artifactsRoot = rtrim((string) config('finngen.artifacts_path', '/opt/finngen-artifacts'), '/');

        return $artifactsRoot.'/'.self::DEFAULT_CACHE_SUBPATH;
    }

    /**
     * HIGHSEC §1.1 gate — identical posture to PrepareSourceVariantsCommand.
     */
    private function authorizedToRun(): bool
    {
        $env = app()->environment();
        if ($env === 'local' || $env === 'testing') {
            return true;
        }

        $forceAs = $this->option('force-as-user');
        if ($forceAs !== null && $forceAs !== '') {
            $user = User::query()->find((int) $forceAs);
            if ($user !== null && $user->hasRole('super-admin')) {
                return true;
            }

            return false;
        }

        try {
            $current = auth()->user();
        } catch (Throwable) {
            $current = null;
        }
        if ($current instanceof User && $current->hasRole('super-admin')) {
            return true;
        }

        return false;
    }

    /**
     * Parse a duration string into seconds. Accepts integer + {s,m,h,d}
     * suffix. Returns null on malformed input — the caller surfaces that
     * as an error exit.
     *
     * Examples:
     *   '30d' → 2_592_000
     *   '12h' → 43_200
     *   '7d'  → 604_800
     *   '90s' → 90
     *   '1h'  → 3_600
     */
    private function parseAge(string $arg): ?int
    {
        if (preg_match('/^(\d+)([smhd])$/', $arg, $m) !== 1) {
            return null;
        }
        $n = (int) $m[1];
        if ($n <= 0) {
            return null;
        }

        return match ($m[2]) {
            's' => $n,
            'm' => $n * 60,
            'h' => $n * 3600,
            'd' => $n * 86400,
        };
    }

    /**
     * Build the glob pattern for cache candidates. Shape:
     *   - with --source=pancreas → {cache_root}/pancreas/*
     *   - without --source        → {cache_root}/* /*
     *
     * --source is re-validated here via preg_match (T-14-28) before
     * interpolation; a mismatch throws InvalidArgumentException.
     */
    private function buildGlobPath(): string
    {
        $root = rtrim($this->cacheRoot(), '/');
        $source = $this->option('source');
        if ($source !== null && $source !== '') {
            $normalized = strtolower((string) $source);
            if (preg_match('/^[a-z][a-z0-9_]*$/', $normalized) !== 1) {
                throw new \InvalidArgumentException("unsafe --source '{$source}'");
            }

            return $root."/{$normalized}/*";
        }

        return $root.'/*/*';
    }

    /**
     * Emit a single JSON object on stdout (JSONL format).
     *
     * @param  array<string, mixed>  $payload
     */
    private function emitJsonLine(array $payload): void
    {
        try {
            $json = json_encode(
                $payload,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $e) {
            $this->warn('Failed to encode JSONL payload: '.$e->getMessage());

            return;
        }
        $this->line($json);
    }
}
