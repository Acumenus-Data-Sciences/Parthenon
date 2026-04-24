<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\User;
use App\Services\FinnGen\Exceptions\SourceNotPreparedException;
use App\Services\FinnGen\Exceptions\Step1ArtifactMissingException;
use App\Services\FinnGen\GwasRunService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
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
        {--source=PANCREAS : CDM source key (normalized to lowercase internally)}
        {--cohort-id=221 : Case cohort definition id}
        {--covariate-set-id= : Defaults to the is_default=true covariate set}
        {--assert-cache-hit-on-rerun : After step-2 success, re-run step-1 and assert cache_hit=true (GENOMICS-01 SC #2)}
        {--force-as-user= : Run as user id X (super-admin test bypass)}
        {--seed-cohort-split : Materialize a 50/50 case/control split on the smoke cohort before dispatch (dev fixtures only)}
        {--timeout-minutes=30 : Poll timeout per step}';

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

        // 4a. Precondition: the case cohort must have both cases AND controls.
        //     regenie aborts with `sd=0` on a case-only (or control-only) Y1
        //     column (null-model fit collapses). The synthetic PANCREAS PGEN
        //     generator ships a 361-of-361 case cohort by default — opt-in
        //     --seed-cohort-split halves it to 180/181 for the smoke fixture.
        $splitReport = $this->ensureCaseControlSplit(
            $sourceLower,
            $cohortId,
            (bool) $this->option('seed-cohort-split')
        );
        if ($splitReport !== null) {
            $this->error($splitReport);

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
     * Verify the smoke cohort has both cases AND controls, optionally
     * materializing a 50/50 split when --seed-cohort-split is passed.
     *
     * regenie's null model fit requires sd(Y1) > 0. A cohort that contains
     * every row of {source}.person (as the synthetic PANCREAS generator
     * currently produces for cohort 221) yields 100% cases / 0% controls
     * and aborts step-1 with an opaque `phenotype 'Y1' has sd=0` error.
     *
     * Identifier interpolation is safe: $sourceLower has been validated by
     * the same preg_match allow-list used elsewhere in this command.
     *
     * Returns null when the cohort is balanced (or was successfully split).
     * Returns a human-readable error string on imbalance without --seed-.
     */
    private function ensureCaseControlSplit(string $sourceLower, int $cohortId, bool $seed): ?string
    {
        $cohortSchema = $sourceLower.'_results';
        $cdmSchema = $sourceLower;

        $counts = $this->countCaseControl($cdmSchema, $cohortSchema, $cohortId);
        $cases = $counts['cases'];
        $controls = $counts['controls'];

        if ($cases > 0 && $controls > 0) {
            return null;
        }

        if (! $seed) {
            return sprintf(
                'Cohort %d on source %s has %d cases and %d controls — regenie will abort with sd=0. '.
                'Re-run with --seed-cohort-split to halve the cohort in-place, '.
                'or fix the fixture (SQL: DELETE FROM %s.cohort WHERE cohort_definition_id=%d AND subject_id > '.
                '(SELECT MAX(person_id)/2 FROM %s.person);).',
                $cohortId,
                strtoupper($sourceLower),
                $cases,
                $controls,
                $cohortSchema,
                $cohortId,
                $cdmSchema,
            );
        }

        // Safety: only allow auto-seed in dev/local/testing OR when the
        // caller explicitly super-admin-forced. authorizedToRun() already
        // enforced one of these before reaching here.
        $this->warn(sprintf(
            'Auto-materializing 50/50 case/control split on cohort %d (cases=%d controls=%d → halving).',
            $cohortId,
            $cases,
            $controls
        ));

        // Halve the cohort by subject_id. Idempotent: if cohort already has
        // controls, we return early above. DELETE uses parameterized bindings.
        $deleted = DB::delete(
            sprintf(
                'DELETE FROM %s.cohort WHERE cohort_definition_id = ? '.
                'AND subject_id > (SELECT COALESCE(MAX(person_id),0)/2 FROM %s.person)',
                $cohortSchema,
                $cdmSchema
            ),
            [$cohortId]
        );

        $post = $this->countCaseControl($cdmSchema, $cohortSchema, $cohortId);
        $this->info(sprintf(
            'Seeded smoke split: deleted %d cohort rows; now cases=%d controls=%d.',
            $deleted,
            $post['cases'],
            $post['controls']
        ));

        if ($post['cases'] === 0 || $post['controls'] === 0) {
            return sprintf(
                'Auto-seed ran but cohort is still imbalanced (cases=%d controls=%d). Check %s.person population.',
                $post['cases'],
                $post['controls'],
                $cdmSchema
            );
        }

        return null;
    }

    /**
     * @return array{cases:int, controls:int}
     */
    private function countCaseControl(string $cdmSchema, string $cohortSchema, int $cohortId): array
    {
        $cases = (int) (DB::selectOne(
            sprintf(
                'SELECT COUNT(DISTINCT subject_id) AS c FROM %s.cohort WHERE cohort_definition_id = ?',
                $cohortSchema
            ),
            [$cohortId]
        )->c ?? 0);

        $controls = (int) (DB::selectOne(
            sprintf(
                'SELECT COUNT(*) AS c FROM %s.person p '.
                'WHERE NOT EXISTS (SELECT 1 FROM %s.cohort c WHERE c.cohort_definition_id = ? AND c.subject_id = p.person_id)',
                $cdmSchema,
                $cohortSchema
            ),
            [$cohortId]
        )->c ?? 0);

        return ['cases' => $cases, 'controls' => $controls];
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
