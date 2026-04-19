<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\User;
use App\Services\FinnGen\Exceptions\SourceNotPreparedException;
use App\Services\FinnGen\Exceptions\Step1ArtifactMissingException;
use App\Services\FinnGen\GwasRunService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use JsonException;
use Throwable;

/**
 * Phase 14 (D-15, D-16) per
 * .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md.
 *
 * End-to-end GWAS smoke test: dispatches step-1 via GwasRunService, polls
 * the Run until terminal, dispatches step-2 on step-1 success, polls again,
 * and asserts ≥ 1 row landed in {source}_gwas_results.summary_stats keyed
 * by the step-2 run id. On success prints a single-line JSON summary that
 * Wave 6 operators paste into GATE-EVIDENCE.md.
 *
 * Optional --assert-cache-hit-on-rerun re-dispatches step-1 and asserts
 * the Run's summary envelope reports cache_hit=true (GENOMICS-01 SC #2).
 *
 * Safety posture (HIGHSEC):
 *   §1.1 Least privilege — super-admin gate OR APP_ENV=local|testing OR
 *        --force-as-user=ID (mirrors PrepareSourceVariantsCommand)
 *   §3.2 Read-only access to {source}_gwas_results.summary_stats for the
 *        assertion query; all mutation happens inside GwasRunService /
 *        FinnGenRunService / Darkstar R worker.
 *   §10  No shell_exec / passthru / exec — dispatch goes through
 *        GwasRunService + the existing Horizon queue.
 *
 * Timeouts:
 *   --timeout-minutes=30 default. Polls every 5 seconds. Regenie step-1
 *   can legitimately run ~15 min at biobank scale; step-2 faster but
 *   chromosome-serial (D-22), so 30 min is the conservative ceiling.
 *
 * Not invoked by Pest's end-to-end path — the mocked Darkstar (via a fake
 * FinnGenRunService that marks Run rows terminal immediately) provides the
 * CI-fast test surface. The real E2E run happens in Wave 6.
 */
final class GwasSmokeTestCommand extends Command
{
    protected $signature = 'finngen:gwas-smoke-test
        {--via-http : Dispatch via the HTTP POST /gwas endpoint (authenticates via Sanctum) — Phase 15 SC-4 mode}
        {--endpoint=E4_DM2 : FinnGen endpoint name (used by --via-http)}
        {--control-cohort=221 : app.cohort_definitions.id of a non-FinnGen control cohort (used by --via-http)}
        {--base-url= : Base URL of the Parthenon API; defaults to config(app.url) (used by --via-http)}
        {--user-email=admin@acumenus.net : Email of the user whose Sanctum token to mint (used by --via-http)}
        {--source=PANCREAS : CDM source key (normalized to lowercase internally)}
        {--cohort-id=221 : Case cohort definition id}
        {--covariate-set-id= : Defaults to the is_default=true covariate set}
        {--assert-cache-hit-on-rerun : After step-2 success, re-run step-1 and assert cache_hit=true (GENOMICS-01 SC #2)}
        {--force-as-user= : Run as user id X (super-admin test bypass)}
        {--timeout-minutes=30 : Poll timeout per step (Phase 14) or total deadline (--via-http)}';

    protected $description = 'End-to-end GWAS smoke test: step-1 → step-2 → summary_stats assertion (D-15)';

    /**
     * Poll interval in seconds between Run::fresh() reads. 5s keeps CLI
     * output responsive without hammering the DB; regenie step timings
     * are 5–90 min, so sub-second polling would be wasteful.
     */
    private const POLL_INTERVAL_SEC = 5;

    public function __construct(private readonly GwasRunService $dispatcher)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        // Phase 15 SC-4 — exercise the REAL HTTP dispatch path instead of the
        // direct-service Phase 14 path. Branches early so none of the Phase 14
        // preconditions / auth gate / poll logic below apply to --via-http.
        if ((bool) $this->option('via-http')) {
            return $this->handleViaHttp();
        }

        // 1. Auth gate (HIGHSEC §1.1).
        if (! $this->authorizedToRun()) {
            $this->error('finngen:gwas-smoke-test requires super-admin.');
            $this->line('  - Run inside APP_ENV=local|testing, OR');
            $this->line('  - Pass --force-as-user=ID where ID is a super-admin user, OR');
            $this->line('  - Invoke as an authenticated super-admin via `php artisan`.');

            return self::FAILURE;
        }

        // 2. Parse + normalize inputs.
        $sourceRaw = (string) ($this->option('source') ?? '');
        if ($sourceRaw === '') {
            $this->error('--source is required (e.g., --source=PANCREAS).');

            return self::FAILURE;
        }
        $sourceLower = strtolower($sourceRaw);
        if (preg_match('/^[a-z][a-z0-9_]*$/', $sourceLower) !== 1) {
            $this->error("--source must match /^[a-z][a-z0-9_]*$/i (got '{$sourceRaw}').");

            return self::FAILURE;
        }
        $sourceUpper = strtoupper($sourceLower);
        $cohortId = (int) $this->option('cohort-id');
        if ($cohortId <= 0) {
            $this->error('--cohort-id must be a positive integer.');

            return self::FAILURE;
        }

        // 3. Resolve covariate set id (default = is_default=true row).
        try {
            $covariateSetId = $this->resolveCovariateSetId();
        } catch (Throwable $e) {
            $this->error('Unable to resolve covariate set: '.$e->getMessage());

            return self::FAILURE;
        }

        $timeoutSec = max(60, (int) $this->option('timeout-minutes') * 60);
        $userId = $this->resolveUserId() ?? 0;

        // 4. Precondition: SourceVariantIndex row must exist.
        if (! SourceVariantIndex::where('source_key', $sourceLower)->exists()) {
            $this->error(sprintf(
                "Source '%s' is not prepared. Run 'php artisan finngen:prepare-source-variants --source=%s' first.",
                $sourceUpper,
                $sourceUpper
            ));

            return self::FAILURE;
        }

        // 5. Dispatch step-1 + poll.
        $this->info(sprintf(
            'Dispatching step-1 (source=%s cohort=%d covariate_set=%d).',
            $sourceUpper,
            $cohortId,
            $covariateSetId
        ));
        try {
            $step1 = $this->dispatcher->dispatchStep1(
                userId: $userId,
                cohortDefinitionId: $cohortId,
                covariateSetId: $covariateSetId,
                sourceKey: $sourceUpper,
            );
        } catch (SourceNotPreparedException $e) {
            $this->error('step-1 dispatch precondition failed: '.$e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('step-1 dispatch raised: '.$e->getMessage());

            return self::FAILURE;
        }
        $step1 = $this->pollUntilTerminal($step1, $timeoutSec, 'step-1');
        if ($step1 === null || $step1->status !== Run::STATUS_SUCCEEDED) {
            $errorBlob = $step1 === null ? '{"code":"TIMEOUT"}' : (string) json_encode($step1->error ?? []);
            $this->error("step-1 did not succeed: {$errorBlob}");

            return self::FAILURE;
        }

        // 6. Dispatch step-2 + poll.
        $this->info('step-1 succeeded. Dispatching step-2.');
        try {
            $step2 = $this->dispatcher->dispatchStep2(
                userId: $userId,
                cohortDefinitionId: $cohortId,
                covariateSetId: $covariateSetId,
                sourceKey: $sourceUpper,
            );
        } catch (Step1ArtifactMissingException $e) {
            $this->error('step-2 precondition failed (LOCO cache miss): '.$e->getMessage());

            return self::FAILURE;
        } catch (Throwable $e) {
            $this->error('step-2 dispatch raised: '.$e->getMessage());

            return self::FAILURE;
        }
        $step2 = $this->pollUntilTerminal($step2, $timeoutSec, 'step-2');
        if ($step2 === null || $step2->status !== Run::STATUS_SUCCEEDED) {
            $errorBlob = $step2 === null ? '{"code":"TIMEOUT"}' : (string) json_encode($step2->error ?? []);
            $this->error("step-2 did not succeed: {$errorBlob}");

            return self::FAILURE;
        }

        // 7. Assert ≥ 1 summary_stats row with this gwas_run_id. Parameterized
        //    query — no SQL interpolation risk. Schema/table name is an
        //    allow-list-derived identifier (validated above via the same
        //    preg_match as PrepareSourceVariantsCommand), so the identifier
        //    interpolation is safe.
        $rowCount = $this->countSummaryStatsRows($sourceLower, (string) $step2->id);
        if ($rowCount < 1) {
            $this->error(sprintf(
                'Smoke test failed: expected ≥ 1 %s_gwas_results.summary_stats row for gwas_run_id=%s; got %d.',
                $sourceLower,
                (string) $step2->id,
                $rowCount
            ));

            return self::FAILURE;
        }

        // 8. Optional cache-hit-on-rerun assertion.
        $cacheHitOnRerun = null;
        if ((bool) $this->option('assert-cache-hit-on-rerun')) {
            $this->info('Re-dispatching step-1 to assert LOCO cache hit.');
            try {
                $rerun = $this->dispatcher->dispatchStep1(
                    userId: $userId,
                    cohortDefinitionId: $cohortId,
                    covariateSetId: $covariateSetId,
                    sourceKey: $sourceUpper,
                );
            } catch (Throwable $e) {
                $this->error('step-1 rerun dispatch raised: '.$e->getMessage());

                return self::FAILURE;
            }
            $rerun = $this->pollUntilTerminal($rerun, $timeoutSec, 'step-1 rerun');
            if ($rerun === null || $rerun->status !== Run::STATUS_SUCCEEDED) {
                $errorBlob = $rerun === null ? '{"code":"TIMEOUT"}' : (string) json_encode($rerun->error ?? []);
                $this->error("step-1 rerun did not succeed: {$errorBlob}");

                return self::FAILURE;
            }
            $cacheHitOnRerun = $this->extractCacheHit($rerun);
            if ($cacheHitOnRerun !== true) {
                $this->error(sprintf(
                    'Cache-hit assertion failed: summary.cache_hit=%s on rerun (expected true).',
                    var_export($cacheHitOnRerun, true)
                ));

                return self::FAILURE;
            }
        }

        // 9. Structured summary — Wave 6 GATE-EVIDENCE.md parses this.
        $this->printSummary([
            'status' => 'ok',
            'source' => $sourceUpper,
            'cohort_id' => $cohortId,
            'covariate_set_id' => $covariateSetId,
            'step1_run_id' => (string) $step1->id,
            'step2_run_id' => (string) $step2->id,
            'summary_stats_rows' => $rowCount,
            'cache_hit_on_rerun' => $cacheHitOnRerun,
        ]);

        return self::SUCCESS;
    }

    // ------------------------------------------------------------------
    // Phase 15 SC-4 — --via-http mode
    // ------------------------------------------------------------------

    /**
     * Phase 15 (GENOMICS-03 SC-4) per 15-CONTEXT.md §D-29 and
     * 15-RESEARCH.md §Primary recommendation #6.
     *
     * Mints a Sanctum token for --user-email (default: admin@acumenus.net),
     * POSTs to the live /api/v1/finngen/endpoints/{endpoint}/gwas route,
     * polls the finngen.endpoint_gwas_runs tracking row every 30s until
     * terminal or --timeout-minutes (default: 30) elapses, then asserts
     * status='succeeded' AND {source_lower}_gwas_results.summary_stats row
     * count > 0 for the step-2 run_id returned in the 202 body.
     *
     * HIGHSEC §5.2 — the raw Sanctum token is NEVER echoed to stdout. We log
     * only "[smoke] minting token" and "[smoke] token cleanup" breadcrumbs;
     * the transcript is safe to commit as gate evidence.
     *
     * Cleanup — the minted token is deleted in a finally{} block (best effort).
     * Sanctum's 8h expiration (HIGHSEC §1.2) is the backstop if delete fails.
     */
    private function handleViaHttp(): int
    {
        $endpoint = (string) ($this->option('endpoint') ?? '');
        $sourceRaw = (string) ($this->option('source') ?? '');
        $controlCohort = (int) ($this->option('control-cohort') ?? 0);
        $baseUrlOpt = (string) ($this->option('base-url') ?? '');
        $timeoutMinutes = max(1, (int) ($this->option('timeout-minutes') ?? 30));
        $userEmail = (string) ($this->option('user-email') ?? '');

        // Validate inputs up-front so the mint-then-cleanup dance is skipped on
        // obvious misuse.
        if ($endpoint === '' || preg_match('/^[A-Za-z0-9_]+$/', $endpoint) !== 1) {
            $this->error("--endpoint is required and must match /^[A-Za-z0-9_]+\$/ (got '{$endpoint}').");

            return self::FAILURE;
        }
        if ($sourceRaw === '') {
            $this->error('--source is required (e.g., --source=PANCREAS).');

            return self::FAILURE;
        }
        $sourceLower = strtolower($sourceRaw);
        if (preg_match('/^[a-z][a-z0-9_]*$/', $sourceLower) !== 1) {
            $this->error("--source must match /^[a-z][a-z0-9_]*\$/i (got '{$sourceRaw}').");

            return self::FAILURE;
        }
        $sourceUpper = strtoupper($sourceLower);
        if ($controlCohort <= 0) {
            $this->error('--control-cohort must be a positive integer.');

            return self::FAILURE;
        }
        if ($userEmail === '') {
            $this->error('--user-email is required.');

            return self::FAILURE;
        }

        $configuredUrl = config('app.url');
        $baseUrl = rtrim(
            $baseUrlOpt !== ''
                ? $baseUrlOpt
                : (is_string($configuredUrl) && $configuredUrl !== ''
                    ? $configuredUrl
                    : 'http://localhost:8082'),
            '/'
        );

        /** @var User|null $user */
        $user = User::query()->where('email', $userEmail)->first();
        if ($user === null) {
            $this->error("User {$userEmail} not found.");

            return self::FAILURE;
        }

        $this->line("[smoke] minting Sanctum token for {$userEmail}");
        $tokenRecord = $user->createToken('finngen-gwas-smoke');
        // HIGHSEC §5.2 — never echo $tokenRecord->plainTextToken.
        $token = $tokenRecord->plainTextToken;

        try {
            $url = "{$baseUrl}/api/v1/finngen/endpoints/{$endpoint}/gwas";
            $this->line("[smoke] POST {$url}");
            $dispatchedAt = CarbonImmutable::now();

            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(30)
                ->post($url, [
                    'source_key' => $sourceUpper,
                    'control_cohort_id' => $controlCohort,
                ]);

            if ($response->status() !== 202) {
                $this->error("[smoke] unexpected status {$response->status()}");
                $this->line($response->body());

                return self::FAILURE;
            }

            $body = (array) $response->json();
            $data = (array) ($body['data'] ?? []);
            $gwasRun = (array) ($data['gwas_run'] ?? []);
            $trackingId = (int) ($gwasRun['id'] ?? 0);
            $runId = (string) ($gwasRun['run_id'] ?? '');
            $step1RunId = (string) ($gwasRun['step1_run_id'] ?? '');
            $cached = (bool) ($data['cached_step1'] ?? false);

            if ($trackingId <= 0 || $runId === '') {
                $this->error('[smoke] 202 body missing gwas_run.id or gwas_run.run_id');
                $this->line($response->body());

                return self::FAILURE;
            }

            $this->line(sprintf(
                '[smoke] 202 tracking_id=%d run_id=%s step1_run_id=%s cached_step1=%s',
                $trackingId,
                $runId,
                $step1RunId !== '' ? $step1RunId : '—',
                $cached ? 'true' : 'false'
            ));

            // Poll loop — every 30s until terminal or deadline.
            $deadline = $dispatchedAt->addMinutes($timeoutMinutes);
            $lastStatusLogged = '';
            while (CarbonImmutable::now()->lessThan($deadline)) {
                $tracking = EndpointGwasRun::find($trackingId);
                if ($tracking === null) {
                    $this->error('[smoke] tracking row disappeared');

                    return self::FAILURE;
                }
                $status = (string) $tracking->status;
                if ($status !== $lastStatusLogged) {
                    $this->line(sprintf(
                        '[smoke] status=%s case_n=%s control_n=%s',
                        $status,
                        $tracking->case_n !== null ? (string) $tracking->case_n : '—',
                        $tracking->control_n !== null ? (string) $tracking->control_n : '—'
                    ));
                    $lastStatusLogged = $status;
                }
                if (in_array($status, EndpointGwasRun::TERMINAL_STATUSES, true)) {
                    break;
                }
                sleep(30);
            }

            $tracking = EndpointGwasRun::find($trackingId);
            if ($tracking === null) {
                $this->error('[smoke] tracking row missing after poll');

                return self::FAILURE;
            }
            $terminalStatus = (string) $tracking->status;
            if ($terminalStatus !== EndpointGwasRun::STATUS_SUCCEEDED) {
                $this->error(sprintf(
                    '[smoke] terminal status is %s (expected succeeded); tracking_id=%d run_id=%s',
                    $terminalStatus !== '' ? $terminalStatus : 'null',
                    $trackingId,
                    $runId
                ));

                return self::FAILURE;
            }

            // Assert {source_lower}_gwas_results.summary_stats has at least one
            // row for this gwas_run_id (the step-2 ULID). Identifier schema name
            // is validated by the same preg_match allow-list as the Phase 14
            // path — parameter binding handles the $runId.
            $schema = $sourceLower.'_gwas_results';
            if (preg_match('/^[a-z][a-z0-9_]*$/', $schema) !== 1) {
                $this->error('[smoke] invalid schema derived from source key');

                return self::FAILURE;
            }
            $row = DB::selectOne(
                sprintf('SELECT COUNT(*) AS c FROM %s.summary_stats WHERE gwas_run_id = ?', $schema),
                [$runId]
            );
            $count = (int) ($row->c ?? 0);
            if ($count <= 0) {
                $this->error(sprintf(
                    '[smoke] summary_stats count is 0 for gwas_run_id=%s (schema=%s)',
                    $runId,
                    $schema
                ));

                return self::FAILURE;
            }

            $elapsedMinutes = $dispatchedAt->diffInMinutes(CarbonImmutable::now());
            $this->info(sprintf(
                '[smoke] PASS — tracking_id=%d run_id=%s summary_stats=%d case_n=%s control_n=%s top_hit_p_value=%s elapsed=%dmin',
                $trackingId,
                $runId,
                $count,
                $tracking->case_n !== null ? (string) $tracking->case_n : '—',
                $tracking->control_n !== null ? (string) $tracking->control_n : '—',
                $tracking->top_hit_p_value !== null ? (string) $tracking->top_hit_p_value : '—',
                $elapsedMinutes
            ));

            return self::SUCCESS;
        } finally {
            // Best-effort token cleanup — HIGHSEC §5.2 & T-15-31.
            try {
                $tokenRecord->accessToken?->delete();
                $this->line('[smoke] token cleanup: ok');
            } catch (Throwable $e) {
                $this->warn('[smoke] token cleanup failed: '.$e->getMessage());
            }
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

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
     * Returns the user_id to pass to GwasRunService::dispatch*.
     * Honors --force-as-user first, then the authenticated session user.
     * Falls back to 0 (callers interpret as "system").
     */
    private function resolveUserId(): ?int
    {
        $forceAs = $this->option('force-as-user');
        if ($forceAs !== null && $forceAs !== '' && ctype_digit((string) $forceAs)) {
            return (int) $forceAs;
        }

        try {
            $current = auth()->user();
        } catch (Throwable) {
            $current = null;
        }
        if ($current instanceof User) {
            return (int) $current->getKey();
        }

        return null;
    }

    /**
     * Resolve the covariate set id to use. Explicit --covariate-set-id wins;
     * otherwise look up the is_default=true row (seeded by D-18).
     */
    private function resolveCovariateSetId(): int
    {
        $opt = $this->option('covariate-set-id');
        if ($opt !== null && $opt !== '' && ctype_digit((string) $opt)) {
            return (int) $opt;
        }

        return (int) GwasCovariateSet::query()->where('is_default', true)->firstOrFail()->id;
    }

    /**
     * Poll the Run row every POLL_INTERVAL_SEC seconds until it reaches a
     * terminal status or $timeoutSec elapses. Returns the fresh Run on
     * terminal, null on timeout. Emits periodic progress lines so long
     * runs don't look hung.
     *
     * At ~15-minute biobank-scale step-1 runtimes, the 5-second poll
     * interval produces ~180 DB reads per step — well within budget.
     */
    private function pollUntilTerminal(Run $run, int $timeoutSec, string $label): ?Run
    {
        $deadline = time() + $timeoutSec;
        $lastStatusLogged = '';
        while (time() < $deadline) {
            /** @var Run|null $fresh */
            $fresh = $run->fresh();
            if ($fresh === null) {
                // Row disappeared (GC? cross-DB visibility gap?) — treat as timeout.
                return null;
            }
            if ($fresh->status !== $lastStatusLogged) {
                $this->line(sprintf('  %s status=%s (run_id=%s)', $label, $fresh->status, (string) $fresh->id));
                $lastStatusLogged = $fresh->status;
            }
            if ($fresh->isTerminal()) {
                return $fresh;
            }
            sleep(self::POLL_INTERVAL_SEC);
        }

        return null;
    }

    /**
     * Count rows in {source_lower}_gwas_results.summary_stats where
     * gwas_run_id matches. Identifier interpolation is safe because
     * $sourceLower has been validated by the same preg_match allow-list
     * used by PrepareSourceVariantsCommand.
     */
    private function countSummaryStatsRows(string $sourceLower, string $runId): int
    {
        $row = DB::selectOne(
            sprintf(
                'SELECT COUNT(*) AS c FROM %s_gwas_results.summary_stats WHERE gwas_run_id = ?',
                $sourceLower
            ),
            [$runId]
        );

        return (int) ($row->c ?? 0);
    }

    /**
     * Extract the cache_hit boolean from a step-1 Run. The R worker writes
     * cache_hit into summary on step-1 success (per 14-05 SUMMARY).
     * Defaults to null when the envelope is missing — the caller treats
     * that as a failure (we expect cache_hit=true, not "absent").
     */
    private function extractCacheHit(Run $run): ?bool
    {
        $summary = $run->summary;
        if (! is_array($summary)) {
            return null;
        }
        if (! array_key_exists('cache_hit', $summary)) {
            return null;
        }

        return (bool) $summary['cache_hit'];
    }

    /**
     * Emit a single-line JSON summary on stdout. Mirrors
     * PrepareSourceVariantsCommand::printSummary shape so Wave 6's
     * GATE-EVIDENCE.md paste target stays consistent.
     *
     * @param  array<string, mixed>  $payload
     */
    private function printSummary(array $payload): void
    {
        try {
            $json = json_encode(
                $payload,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $e) {
            $this->warn('Failed to encode summary JSON: '.$e->getMessage());

            return;
        }
        $this->line($json);
    }
}
