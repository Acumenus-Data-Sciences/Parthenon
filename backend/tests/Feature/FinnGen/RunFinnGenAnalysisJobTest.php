<?php

declare(strict_types=1);

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarUnreachableException;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    $this->makeRun = function (string $analysisType = 'co2.codewas', string $status = Run::STATUS_QUEUED): Run {
        return Run::create([
            'user_id' => $this->user->id,
            'source_key' => 'EUNOMIA',
            'analysis_type' => $analysisType,
            'params' => ['cohortIdCases' => 1, 'cohortIdControls' => 2],
            'status' => $status,
        ]);
    };

    $this->runJob = function (Run $run, bool $resume = false): void {
        (new RunFinnGenAnalysisJob($run->id, resumeMode: $resume))->handle(
            FinnGenClient::forContainer(),
            app(FinnGenRunService::class),
            app(FinnGenSourceContextBuilder::class),
            app(FinnGenAnalysisModuleRegistry::class),
        );
    };
});

it('dispatches to Darkstar, records job_id, and marks running', function () {
    $run = ($this->makeRun)();

    Http::fake([
        '*/finngen/co2/codewas' => Http::response(
            ['job_id' => 'job_co2_codewas_20260413_99999', 'status' => 'running', 'run_id' => $run->id],
            202,
        ),
        '*/jobs/status/*' => Http::response(
            ['status' => 'running', 'job_id' => 'job_co2_codewas_20260413_99999'],
            200,
        ),
    ]);

    ($this->runJob)($run);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_RUNNING);
    expect($run->darkstar_job_id)->toBe('job_co2_codewas_20260413_99999');
    expect($run->started_at)->not->toBeNull();
});

it('marks failed with FINNGEN_DARKSTAR_REJECTED on 4xx dispatch', function () {
    $run = ($this->makeRun)();

    Http::fake([
        '*/finngen/co2/codewas' => Http::response(
            ['error' => ['category' => 'DB_SCHEMA_MISMATCH', 'message' => 'missing table']],
            422,
        ),
    ]);

    ($this->runJob)($run);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_FAILED);
    expect($run->error['code'])->toBe('FINNGEN_DARKSTAR_REJECTED');
});

it('marks succeeded when poll returns completed + ok=true', function () {
    $run = ($this->makeRun)();
    $run->update(['darkstar_job_id' => 'job_abc', 'status' => Run::STATUS_RUNNING, 'started_at' => now()]);

    Http::fake([
        '*/jobs/status/job_abc' => Http::response([
            'status' => 'completed',
            'job_id' => 'job_abc',
            'result' => ['ok' => true, 'result' => ['rows' => 42]],
        ], 200),
    ]);

    ($this->runJob)($run, true);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_SUCCEEDED);
    expect($run->summary)->toBe(['rows' => 42]);
    expect($run->finished_at)->not->toBeNull();
});

it('marks failed with DARKSTAR_R_<CATEGORY> when poll returns completed + ok=false', function () {
    $run = ($this->makeRun)();
    $run->update(['darkstar_job_id' => 'job_abc', 'status' => Run::STATUS_RUNNING, 'started_at' => now()]);

    Http::fake([
        '*/jobs/status/job_abc' => Http::response([
            'status' => 'completed',
            'job_id' => 'job_abc',
            'result' => [
                'ok' => false,
                'error' => [
                    'category' => 'DB_CONNECTION_FAILED',
                    'class' => 'DatabaseConnectorError/error/condition',
                    'message' => 'could not connect',
                ],
            ],
        ], 200),
    ]);

    ($this->runJob)($run, true);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_FAILED);
    expect($run->error['code'])->toBe('DARKSTAR_R_DB_CONNECTION_FAILED');
    expect($run->error['category'])->toBe('DB_CONNECTION_FAILED');
});

it('marks failed with MIRAI_TASK_CRASHED when callr job status=failed', function () {
    $run = ($this->makeRun)();
    $run->update(['darkstar_job_id' => 'job_abc', 'status' => Run::STATUS_RUNNING, 'started_at' => now()]);

    Http::fake([
        '*/jobs/status/job_abc' => Http::response([
            'status' => 'failed',
            'job_id' => 'job_abc',
            'error' => 'R process crashed: segfault',
        ], 200),
    ]);

    ($this->runJob)($run, true);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_FAILED);
    expect($run->error['category'])->toBe('MIRAI_TASK_CRASHED');
});

it('cancels the run when DB status is canceling', function () {
    $run = ($this->makeRun)();
    $run->update([
        'darkstar_job_id' => 'job_abc',
        'status' => Run::STATUS_CANCELING,
        'started_at' => now(),
    ]);

    Http::fake([
        '*/jobs/cancel/job_abc' => Http::response(['status' => 'cancelled', 'job_id' => 'job_abc'], 200),
    ]);

    ($this->runJob)($run, true);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_CANCELED);
    expect($run->error['category'])->toBe('CANCELED');
});

it('extracts artifacts from the shared volume on success', function () {
    $run = ($this->makeRun)();
    $run->update(['darkstar_job_id' => 'job_abc', 'status' => Run::STATUS_RUNNING, 'started_at' => now()]);

    $artifactsPath = (string) config('finngen.artifacts_path');
    $runDir = $artifactsPath.'/runs/'.$run->id;
    if (! is_dir($runDir)) {
        @mkdir($runDir, 0777, true);
    }
    $canWrite = is_dir($runDir) && is_writable($runDir);

    if ($canWrite) {
        file_put_contents($runDir.'/summary.json', '{"rows": 42}');
        file_put_contents($runDir.'/log.txt', 'all good');
    }

    Http::fake([
        '*/jobs/status/job_abc' => Http::response([
            'status' => 'completed',
            'job_id' => 'job_abc',
            'result' => ['ok' => true, 'result' => ['rows' => 42]],
        ], 200),
    ]);

    ($this->runJob)($run, true);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_SUCCEEDED);

    if ($canWrite) {
        expect($run->artifacts)->toHaveKey('summary');
        expect($run->artifacts['summary'])->toBe("runs/{$run->id}/summary.json");
        expect($run->artifacts)->toHaveKey('log');

        @unlink($runDir.'/summary.json');
        @unlink($runDir.'/log.txt');
        @rmdir($runDir);
    } else {
        // In CI/sandboxed envs without access to the shared volume, we still
        // require the success path to produce an artifacts array (possibly empty).
        expect($run->artifacts)->toBeArray();
    }
});

it('no-ops when the run is already terminal', function () {
    $run = ($this->makeRun)();
    $run->update([
        'status' => Run::STATUS_SUCCEEDED,
        'finished_at' => now(),
        'started_at' => now(),
    ]);

    Http::fake();

    ($this->runJob)($run);

    Http::assertNothingSent();
});

it('failed() callback marks run failed with transport code', function () {
    $run = ($this->makeRun)();
    $run->update(['status' => Run::STATUS_RUNNING, 'started_at' => now()]);

    $ex = new FinnGenDarkstarUnreachableException('connection refused');
    (new RunFinnGenAnalysisJob($run->id))->failed($ex);

    $run->refresh();
    expect($run->status)->toBe(Run::STATUS_FAILED);
    expect($run->error['code'])->toBe('FINNGEN_DARKSTAR_UNREACHABLE');
});
