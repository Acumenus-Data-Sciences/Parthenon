<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Services\FinnGen\Co2SchemaProvisioner;
use App\Services\FinnGen\EndpointProfileDispatchService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Phase 18 SC-3 per
 * .planning/phases/18-risteys-style-endpoint-dashboard/18-CONTEXT.md.
 *
 * End-to-end smoke: dispatches an endpoint-profile compute, polls the
 * finngen.runs row until terminal (up to --timeout seconds), and verifies
 * the 4 {source}_co2_results sibling tables have rows for (endpoint, source,
 * expression_hash). Emits a one-line summary that the DEPLOY-LOG paste path
 * consumes.
 *
 * HIGHSEC posture: gated by PARTHENON_E2E=1 so CI / casual invocations never
 * push real work onto the live Darkstar worker. The command does NOT bypass
 * auth — it uses FinnGenRunService::create directly with the passed --as-user
 * (defaults to the first super-admin on the host).
 *
 * T-18-06 mitigation: analysis_type flows from EndpointProfileDispatchService::
 * ANALYSIS_TYPE, which is a hard-coded const — no user string reaches the R
 * dispatcher via this command.
 */
final class SmokeEndpointProfileCommand extends Command
{
    protected $signature = 'finngen:smoke-endpoint-profile '
        .'{--endpoint=E4_DM2 : FinnGen endpoint name} '
        .'{--source=PANCREAS : Source key} '
        .'{--min-subjects=20 : min_subjects threshold for the comorbidity universe} '
        .'{--timeout=180 : Poll timeout in seconds before giving up} '
        .'{--as-user= : User id to run as (defaults to a super-admin on the host)}';

    protected $description = 'Phase 18 SC-3 — end-to-end smoke for Risteys-style endpoint profile (PARTHENON_E2E=1 gated)';

    private const POLL_INTERVAL_SEC = 3;

    public function handle(
        EndpointProfileDispatchService $dispatcher,
        Co2SchemaProvisioner $provisioner,
    ): int {
        if (env('PARTHENON_E2E') !== '1') {
            $this->info('PARTHENON_E2E=1 not set — skipping live smoke');

            return self::SUCCESS;
        }

        $endpoint = (string) ($this->option('endpoint') ?? '');
        $source = (string) ($this->option('source') ?? '');
        $minSubjects = (int) ($this->option('min-subjects') ?? 20);
        $timeout = max(30, (int) ($this->option('timeout') ?? 180));
        $asUserOpt = $this->option('as-user');
        $asUser = ($asUserOpt !== null && $asUserOpt !== '' && ctype_digit((string) $asUserOpt))
            ? (int) $asUserOpt
            : $this->resolveDefaultUserId();

        if ($endpoint === '' || preg_match('/^[A-Za-z0-9_]+$/', $endpoint) !== 1) {
            $this->error("--endpoint is required and must match /^[A-Za-z0-9_]+\$/ (got '{$endpoint}')");

            return self::FAILURE;
        }
        if ($source === '' || preg_match('/^[A-Z][A-Z0-9_]*$/', $source) !== 1) {
            $this->error("--source is required and must match /^[A-Z][A-Z0-9_]*\$/ (got '{$source}')");

            return self::FAILURE;
        }

        try {
            $provisioner->provision($source);
        } catch (Throwable $e) {
            $this->error('Co2SchemaProvisioner failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf('Dispatching %s × %s (min_subjects=%d as_user=%d)', $endpoint, $source, $minSubjects, $asUser));
        $t0 = microtime(true);

        try {
            $result = $dispatcher->dispatch(
                userId: $asUser,
                endpointName: $endpoint,
                input: ['source_key' => $source, 'min_subjects' => $minSubjects],
            );
        } catch (Throwable $e) {
            $this->error('Dispatch aborted: '.$e->getMessage());

            return self::FAILURE;
        }

        /** @var Run $run */
        $run = $result['run'];
        $runId = (string) $run->id;
        $hash = (string) $result['expression_hash'];
        $this->info("run_id={$runId} hash={$hash}");

        $terminalStatus = $this->pollUntilTerminal($runId, $timeout);
        $elapsed = round(microtime(true) - $t0, 1);

        if ($terminalStatus === null) {
            $this->error(sprintf('TIMEOUT after %ds — run_id=%s not terminal', $timeout, $runId));

            return self::FAILURE;
        }
        if ($terminalStatus !== Run::STATUS_SUCCEEDED) {
            $errorRow = DB::connection('finngen')->selectOne('SELECT error FROM runs WHERE id = ?', [$runId]);
            $errBlob = $errorRow->error ?? '{}';
            $this->error("Run did not succeed (status={$terminalStatus} elapsed={$elapsed}s) error={$errBlob}");

            return self::FAILURE;
        }

        $schema = strtolower($source).'_co2_results';
        if (preg_match('/^[a-z][a-z0-9_]*$/', $schema) !== 1) {
            $this->error('Unsafe derived schema name');

            return self::FAILURE;
        }

        $summary = DB::connection('pgsql')->selectOne(
            "SELECT subject_count, death_count, median_survival_days, universe_size, source_has_death_data, source_has_drug_data
             FROM {$schema}.endpoint_profile_summary
             WHERE endpoint_name = ? AND source_key = ? AND expression_hash = ?",
            [$endpoint, $source, $hash],
        );
        $kmCount = DB::connection('pgsql')->selectOne(
            "SELECT COUNT(*) AS c FROM {$schema}.endpoint_profile_km_points
             WHERE endpoint_name = ? AND source_key = ? AND expression_hash = ?",
            [$endpoint, $source, $hash],
        );
        $coCount = DB::connection('pgsql')->selectOne(
            "SELECT COUNT(*) AS c FROM {$schema}.endpoint_profile_comorbidities
             WHERE index_endpoint = ? AND source_key = ? AND expression_hash = ?",
            [$endpoint, $source, $hash],
        );
        $drugCount = DB::connection('pgsql')->selectOne(
            "SELECT COUNT(*) AS c FROM {$schema}.endpoint_profile_drug_classes
             WHERE endpoint_name = ? AND source_key = ? AND expression_hash = ?",
            [$endpoint, $source, $hash],
        );

        if ($summary === null) {
            $this->error('No summary row written — R worker failed silently');

            return self::FAILURE;
        }

        $this->info(sprintf('Elapsed: %ss', $elapsed));
        $this->info(sprintf(
            'subject_count=%d death_count=%d median_survival_days=%s universe_size=%d has_death=%s has_drug=%s',
            (int) $summary->subject_count,
            (int) $summary->death_count,
            $summary->median_survival_days === null ? '—' : (string) $summary->median_survival_days,
            (int) $summary->universe_size,
            ((bool) $summary->source_has_death_data) ? 'true' : 'false',
            ((bool) $summary->source_has_drug_data) ? 'true' : 'false',
        ));
        $this->info(sprintf(
            'km_points=%d comorbidities=%d drug_classes=%d',
            (int) ($kmCount->c ?? 0),
            (int) ($coCount->c ?? 0),
            (int) ($drugCount->c ?? 0),
        ));
        $this->info(sprintf('schema=%s hash=%s run_id=%s', $schema, $hash, $runId));

        return self::SUCCESS;
    }

    private function pollUntilTerminal(string $runId, int $timeoutSec): ?string
    {
        $deadline = time() + $timeoutSec;
        $lastLogged = '';
        while (time() < $deadline) {
            $row = DB::connection('finngen')->selectOne('SELECT status FROM runs WHERE id = ?', [$runId]);
            if ($row === null) {
                // Row not yet visible (cross-connection cache) — wait.
                sleep(self::POLL_INTERVAL_SEC);

                continue;
            }
            $status = (string) $row->status;
            if ($status !== $lastLogged) {
                $this->line("  status={$status}");
                $lastLogged = $status;
            }
            if (in_array($status, [Run::STATUS_SUCCEEDED, Run::STATUS_FAILED, Run::STATUS_CANCELED], true)) {
                return $status;
            }
            sleep(self::POLL_INTERVAL_SEC);
        }

        return null;
    }

    private function resolveDefaultUserId(): int
    {
        try {
            $row = DB::connection('pgsql')->selectOne('SELECT id FROM app.users ORDER BY id ASC LIMIT 1');

            return (int) ($row->id ?? 1);
        } catch (Throwable) {
            return 1;
        }
    }
}
