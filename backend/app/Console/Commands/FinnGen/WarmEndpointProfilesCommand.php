<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\EndpointDefinition;
use App\Services\FinnGen\EndpointExpressionHasher;
use App\Services\FinnGen\EndpointProfileDispatchService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Phase 18 D-08 + D-11 per
 * .planning/phases/18-risteys-style-endpoint-dashboard/18-CONTEXT.md.
 *
 * Nightly warmer that keeps recently-accessed (endpoint × source) profiles
 * fresh. For each row in finngen.endpoint_profile_access touched inside the
 * --since window, the command re-hashes the endpoint's qualifying expression
 * and dispatches a compute when the cached row is missing or stale (D-10
 * invalidation). Cached rows whose hash still matches are skipped.
 *
 * Scheduled daily at 02:00 local via backend/routes/console.php. Runs with
 * --source=PANCREAS --since=14d by default to match the roadmap-locked 14-day
 * warm signal (D-11). Outputs a single summary line: `Dispatched=M skipped=N
 * errored=K (window=... source=...)` — matches Phase 14 + 17 command style.
 *
 * T-18-03 mitigation: the derived {source}_co2_results schema name is
 * validated via regex BEFORE interpolation. T-18-04 mitigation: each row is
 * wrapped in try-catch so a single broken endpoint / missing schema cannot
 * poison the whole warm cycle.
 */
final class WarmEndpointProfilesCommand extends Command
{
    protected $signature = 'finngen:warm-endpoint-profiles '
        .'{--source= : Limit to a specific source_key (e.g. PANCREAS)} '
        .'{--since=14d : Relative window like 14d, 7d, 30d (days/hours/minutes)} '
        .'{--dry-run : Report dispatch plan without invoking the dispatcher}';

    protected $description = 'Phase 18 D-11 — warm stale (endpoint × source) profile caches accessed in the last --since window';

    public function handle(
        EndpointProfileDispatchService $dispatcher,
        EndpointExpressionHasher $hasher,
    ): int {
        $since = (string) ($this->option('since') ?? '14d');
        $sourceOpt = $this->option('source');
        $source = is_string($sourceOpt) ? $sourceOpt : null;
        $dryRun = (bool) $this->option('dry-run');

        if (preg_match('/^(\d+)([dhm])$/', $since, $m) !== 1) {
            $this->error("Invalid --since value: {$since} (expected e.g. 14d, 7d, 30m)");

            return self::FAILURE;
        }

        $intervalUnit = match ($m[2]) {
            'd' => 'days',
            'h' => 'hours',
            'm' => 'minutes',
        };
        $interval = "{$m[1]} {$intervalUnit}";

        $bindings = [];
        $sql = 'SELECT endpoint_name, source_key
                FROM finngen.endpoint_profile_access
                WHERE last_accessed_at >= NOW() - INTERVAL \''.$interval.'\'';

        if (is_string($source) && $source !== '') {
            if (preg_match('/^[A-Z][A-Z0-9_]{0,63}$/', $source) !== 1) {
                $this->error("Invalid --source value: {$source} (expected /^[A-Z][A-Z0-9_]*$/)");

                return self::FAILURE;
            }
            $sql .= ' AND source_key = ?';
            $bindings[] = $source;
        }

        $rows = DB::connection('finngen')->select($sql, $bindings);

        $dispatched = 0;
        $skipped = 0;
        $errored = 0;

        foreach ($rows as $row) {
            $endpointName = (string) $row->endpoint_name;
            $sourceKey = (string) $row->source_key;

            try {
                $endpoint = EndpointDefinition::query()
                    ->where('name', $endpointName)
                    ->first();
                if ($endpoint === null) {
                    $skipped++;

                    continue;
                }

                $spec = is_array($endpoint->qualifying_event_spec)
                    ? $endpoint->qualifying_event_spec
                    : [];
                $currentHash = $hasher->hash($spec);

                $schema = strtolower($sourceKey).'_co2_results';
                if (preg_match('/^[a-z][a-z0-9_]*$/', $schema) !== 1) {
                    $errored++;
                    $this->warn("{$endpointName} × {$sourceKey}: unsafe schema derived");

                    continue;
                }

                $cached = $this->latestCachedHash($schema, $endpointName, $sourceKey);

                if ($cached !== null && $cached === $currentHash) {
                    $skipped++;

                    continue; // cache fresh — no dispatch
                }

                if ($dryRun) {
                    $reason = $cached === null ? 'no_cache' : 'stale_hash';
                    $this->info("[DRY] would dispatch {$endpointName} × {$sourceKey} (reason={$reason})");
                    $dispatched++;

                    continue;
                }

                $dispatcher->dispatch(
                    userId: 0,
                    endpointName: $endpointName,
                    input: ['source_key' => $sourceKey],
                );
                $dispatched++;
            } catch (Throwable $e) {
                $errored++;
                $this->warn("{$endpointName} × {$sourceKey}: {$e->getMessage()}");
            }
        }

        $sourceLabel = $source !== null && $source !== '' ? $source : 'ALL';
        $this->info(sprintf(
            'Dispatched=%d skipped=%d errored=%d (window=%s source=%s)',
            $dispatched,
            $skipped,
            $errored,
            $since,
            $sourceLabel,
        ));

        return self::SUCCESS;
    }

    /**
     * Fetch the most-recent expression_hash cached for (endpoint, source) in
     * the given {source}_co2_results schema. Returns null when the schema /
     * table doesn't exist yet (lazy-provisioned per D-09) or the row is
     * absent — both treated as "stale" by the caller.
     */
    private function latestCachedHash(string $schema, string $endpointName, string $sourceKey): ?string
    {
        try {
            $row = DB::connection('pgsql')->selectOne(
                "SELECT expression_hash
                 FROM {$schema}.endpoint_profile_summary
                 WHERE endpoint_name = ? AND source_key = ?
                 ORDER BY computed_at DESC
                 LIMIT 1",
                [$endpointName, $sourceKey],
            );
        } catch (Throwable $e) {
            return null;
        }

        if ($row === null) {
            return null;
        }

        $hash = $row->expression_hash ?? null;

        return is_string($hash) ? $hash : null;
    }
}
