<?php

declare(strict_types=1);

use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\Exceptions\FinnGenArtifactNotFoundException;
use App\Services\FinnGen\Exceptions\FinnGenArtifactPathTraversalException;
use App\Services\FinnGen\FinnGenArtifactService;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->tmpRoot = sys_get_temp_dir().'/finngen-artifact-test-'.uniqid();
    mkdir($this->tmpRoot.'/runs/run_1', 0777, true);
    $this->service = new FinnGenArtifactService($this->tmpRoot, 10 * 1024 * 1024);

    $this->seed(FinnGenTestingSeeder::class);
    $user = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();

    $this->run = Run::create([
        'user_id' => $user->id,
        'source_key' => 'EUNOMIA',
        'analysis_type' => 'co2.codewas',
        'params' => [],
        'artifacts' => [
            'results_db' => 'runs/run_1/results.duckdb',
            'log' => 'runs/run_1/log.txt',
        ],
    ]);
});

afterEach(function () {
    if (isset($this->tmpRoot) && is_dir($this->tmpRoot)) {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->tmpRoot, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $f) {
            $f->isDir() ? rmdir($f->getRealPath()) : unlink($f->getRealPath());
        }
        rmdir($this->tmpRoot);
    }
});

it('resolvePath returns absolute path for a valid key + existing file', function () {
    file_put_contents($this->tmpRoot.'/runs/run_1/log.txt', 'sample log');

    $path = $this->service->resolvePath($this->run, 'log');

    expect($path)->toEndWith('runs/run_1/log.txt');
    expect(is_file($path))->toBeTrue();
});

it('resolvePath throws NotFound when the key is missing from the run', function () {
    $this->service->resolvePath($this->run, 'nonexistent_key');
})->throws(FinnGenArtifactNotFoundException::class);

it('resolvePath throws NotFound when the file is not on disk', function () {
    $this->service->resolvePath($this->run, 'results_db');
})->throws(FinnGenArtifactNotFoundException::class);

it('resolvePath rejects ".." path traversal', function () {
    $this->run->update(['artifacts' => ['evil' => 'runs/run_1/../../../../etc/passwd']]);
    $this->service->resolvePath($this->run, 'evil');
})->throws(FinnGenArtifactPathTraversalException::class);

it('resolvePath rejects absolute paths', function () {
    $this->run->update(['artifacts' => ['evil' => '/etc/passwd']]);
    $this->service->resolvePath($this->run, 'evil');
})->throws(FinnGenArtifactPathTraversalException::class);

it('resolvePath rejects null-byte injection', function () {
    // Postgres json columns reject \0 at the driver layer, so bypass the DB
    // round-trip by poking the model's in-memory attribute directly.
    $this->run->setAttribute('artifacts', ['evil' => "runs/run_1/log.txt\0.php"]);
    $this->service->resolvePath($this->run, 'evil');
})->throws(FinnGenArtifactPathTraversalException::class);

it('contentTypeFor infers by extension', function () {
    expect($this->service->contentTypeFor('foo.duckdb'))->toBe('application/vnd.duckdb');
    expect($this->service->contentTypeFor('foo.html'))->toBe('text/html');
    expect($this->service->contentTypeFor('foo.json'))->toBe('application/json');
    expect($this->service->contentTypeFor('foo.txt'))->toBe('text/plain');
    expect($this->service->contentTypeFor('foo.log'))->toBe('text/plain');
    expect($this->service->contentTypeFor('foo.unknown'))->toBe('application/octet-stream');
});

it('shouldStream returns true at threshold, false below', function () {
    $svc = new FinnGenArtifactService('/tmp', 10);
    expect($svc->shouldStream(9))->toBeFalse();
    expect($svc->shouldStream(10))->toBeTrue();
    expect($svc->shouldStream(11))->toBeTrue();
});

it('respond returns BinaryFileResponse for small files', function () {
    file_put_contents($this->tmpRoot.'/runs/run_1/log.txt', 'tiny');
    $path = $this->tmpRoot.'/runs/run_1/log.txt';

    $response = $this->service->respond($path, 'log.txt');

    expect($response)->toBeInstanceOf(BinaryFileResponse::class);
    expect($response->headers->get('Content-Type'))->toBe('text/plain');
});

it('respond returns X-Accel-Redirect for large files', function () {
    $svc = new FinnGenArtifactService($this->tmpRoot, 10);
    $path = $this->tmpRoot.'/runs/run_1/results.duckdb';
    file_put_contents($path, str_repeat('x', 100));

    $response = $svc->respond($path, 'results.duckdb');

    expect($response->headers->get('X-Accel-Redirect'))->toBe('/_artifacts/runs/run_1/results.duckdb');
    expect($response->headers->get('Content-Type'))->toBe('application/vnd.duckdb');
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
});

it('signedUrl generates a signed URL (requires the route to exist — smoke-only)', function () {
    Route::get('/api/v1/finngen/runs/{run}/artifacts/{key}', fn () => 'stub')
        ->name('finngen.runs.artifact');
    Route::getRoutes()->refreshNameLookups();

    $url = $this->service->signedUrl($this->run, 'results_db', 5);

    expect($url)->toContain('signature=');
    expect($url)->toContain($this->run->id);
    expect($url)->toContain('results_db');
});
