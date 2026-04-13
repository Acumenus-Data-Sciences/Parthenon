<?php

declare(strict_types=1);

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use App\Services\FinnGen\FinnGenRunService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
    $this->user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->service = app(FinnGenRunService::class);
});

it('create() inserts a queued row and dispatches the Horizon job on the finngen queue', function () {
    Bus::fake();

    $run = $this->service->create($this->user->id, 'EUNOMIA', 'co2.codewas', ['cohortIdCases' => 1]);

    expect($run)->toBeInstanceOf(Run::class);
    expect($run->status)->toBe(Run::STATUS_QUEUED);
    expect($run->user_id)->toBe($this->user->id);
    expect($run->source_key)->toBe('EUNOMIA');
    expect($run->analysis_type)->toBe('co2.codewas');
    expect($run->params)->toBe(['cohortIdCases' => 1]);

    Bus::assertDispatched(RunFinnGenAnalysisJob::class, function ($job) use ($run) {
        return $job->runId === $run->id && $job->queue === 'finngen';
    });
});

it('create() aborts 503 when finngen.pause_dispatch is true', function () {
    config(['finngen.pause_dispatch' => true]);
    Bus::fake();

    try {
        $this->service->create($this->user->id, 'EUNOMIA', 'co2.codewas', []);
        expect(false)->toBeTrue('expected abort(503)');
    } catch (HttpException $e) {
        expect($e->getStatusCode())->toBe(503);
    }

    Bus::assertNothingDispatched();
    expect(Run::count())->toBe(0);
});

it('create() throws FinnGenUnknownAnalysisTypeException for unknown analysis_type', function () {
    Bus::fake();
    $this->service->create($this->user->id, 'EUNOMIA', 'not.a.real.module', []);
})->throws(FinnGenUnknownAnalysisTypeException::class);

it('requestCancel() transitions running → canceling', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_RUNNING, 'started_at' => now(),
    ]);

    $updated = $this->service->requestCancel($run);

    expect($updated->status)->toBe(Run::STATUS_CANCELING);
});

it('requestCancel() is idempotent on terminal state (no-op)', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_SUCCEEDED,
        'started_at' => now(), 'finished_at' => now(),
    ]);

    $updated = $this->service->requestCancel($run);

    expect($updated->status)->toBe(Run::STATUS_SUCCEEDED);
});

it('pin() and unpin() toggle the pinned flag', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_SUCCEEDED,
        'started_at' => now(), 'finished_at' => now(), 'pinned' => false,
    ]);

    expect($this->service->pin($run)->pinned)->toBeTrue();
    expect($this->service->unpin($run)->pinned)->toBeFalse();
});

it('markRunning() sets status=running and stamps started_at', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_QUEUED,
    ]);

    $this->service->markRunning($run);
    $run->refresh();

    expect($run->status)->toBe(Run::STATUS_RUNNING);
    expect($run->started_at)->not->toBeNull();
});

it('markSucceeded() stamps finished_at, artifacts, summary', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_RUNNING, 'started_at' => now(),
    ]);

    $this->service->markSucceeded($run, ['results_db' => 'runs/x/results.duckdb'], ['rows' => 42]);
    $run->refresh();

    expect($run->status)->toBe(Run::STATUS_SUCCEEDED);
    expect($run->artifacts)->toBe(['results_db' => 'runs/x/results.duckdb']);
    expect($run->summary)->toBe(['rows' => 42]);
    expect($run->finished_at)->not->toBeNull();
});

it('markFailed() stamps finished_at + merges error detail with code+category', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_RUNNING, 'started_at' => now(),
    ]);

    $this->service->markFailed($run, 'DARKSTAR_R_DB_CONNECTION_FAILED', 'DB_CONNECTION_FAILED', ['message' => 'refused']);
    $run->refresh();

    expect($run->status)->toBe(Run::STATUS_FAILED);
    expect($run->error['code'])->toBe('DARKSTAR_R_DB_CONNECTION_FAILED');
    expect($run->error['category'])->toBe('DB_CONNECTION_FAILED');
    expect($run->error['message'])->toBe('refused');
    expect($run->finished_at)->not->toBeNull();
});

it('markCanceled() records forced flag', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_CANCELING, 'started_at' => now(),
    ]);

    $this->service->markCanceled($run, forced: true);
    $run->refresh();

    expect($run->status)->toBe(Run::STATUS_CANCELED);
    expect($run->error['code'])->toBe('DARKSTAR_R_CANCELED');
    expect($run->error['forced'])->toBeTrue();
});

it('updateProgress() writes arbitrary progress JSON', function () {
    $run = Run::create([
        'user_id' => $this->user->id, 'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas', 'params' => [],
        'status' => Run::STATUS_RUNNING, 'started_at' => now(),
    ]);

    $this->service->updateProgress($run, ['step' => 'covariates', 'pct' => 35]);
    $run->refresh();

    expect($run->progress)->toEqualCanonicalizing(['step' => 'covariates', 'pct' => 35]);
});
