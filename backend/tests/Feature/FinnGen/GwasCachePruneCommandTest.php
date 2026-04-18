<?php

declare(strict_types=1);

use App\Console\Commands\FinnGen\GwasCachePruneCommand;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;

// Deliberately NOT using RefreshDatabase — this command makes zero DB
// calls (it's pure filesystem + config). We bind a test-local tempdir
// subclass of the command so we never touch /opt/finngen-artifacts in CI.

beforeEach(function (): void {
    $this->cacheRoot = sys_get_temp_dir().'/gwas-cache-prune-test-'.uniqid('', true);

    // Clean any stragglers from failed prior runs.
    if (is_dir($this->cacheRoot)) {
        removeDirRecursive($this->cacheRoot);
    }
    mkdir($this->cacheRoot, 0o755, true);

    // Seed two cache directories: one old (40 days), one fresh (3 days).
    mkdir($this->cacheRoot.'/pancreas/old_key', 0o755, true);
    mkdir($this->cacheRoot.'/pancreas/new_key', 0o755, true);
    mkdir($this->cacheRoot.'/synpuf/ancient_key', 0o755, true);

    $oldTime = time() - 40 * 86400;
    $freshTime = time() - 3 * 86400;
    $ancientTime = time() - 365 * 86400;

    file_put_contents($this->cacheRoot.'/pancreas/old_key/fit_pred.list', 'dummy');
    file_put_contents($this->cacheRoot.'/pancreas/new_key/fit_pred.list', 'dummy');
    file_put_contents($this->cacheRoot.'/synpuf/ancient_key/fit_pred.list', 'dummy');

    touch($this->cacheRoot.'/pancreas/old_key/fit_pred.list', $oldTime);
    touch($this->cacheRoot.'/pancreas/new_key/fit_pred.list', $freshTime);
    touch($this->cacheRoot.'/synpuf/ancient_key/fit_pred.list', $ancientTime);

    // Bind an anonymous command subclass with cacheRoot() pointing at the
    // tempdir. The global container will resolve `finngen:gwas-cache-prune`
    // to this instance during Artisan::call.
    $testCommand = new class extends GwasCachePruneCommand
    {
        public string $testCacheRoot = '';

        protected function cacheRoot(): string
        {
            return $this->testCacheRoot;
        }
    };
    $testCommand->testCacheRoot = $this->cacheRoot;

    // Re-bind the command in the Artisan registry to our subclass.
    $this->app->make(Kernel::class)->registerCommand($testCommand);
});

afterEach(function (): void {
    if (isset($this->cacheRoot) && is_dir($this->cacheRoot)) {
        removeDirRecursive($this->cacheRoot);
    }
});

/**
 * Recursive rmdir — avoids shell_exec per HIGHSEC §10.
 */
function removeDirRecursive(string $path): void
{
    if (! is_dir($path)) {
        return;
    }
    $entries = scandir($path) ?: [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        $full = $path.'/'.$entry;
        if (is_dir($full) && ! is_link($full)) {
            removeDirRecursive($full);
        } else {
            @unlink($full);
        }
    }
    @rmdir($path);
}

it('rejects invalid --older-than format', function () {
    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => 'garbage',
        '--force-as-user' => 1,
    ]);
    expect($exit)->not->toBe(0);
});

it('--dry-run lists old candidates but does not delete', function () {
    expect(is_dir($this->cacheRoot.'/pancreas/old_key'))->toBeTrue();
    expect(is_dir($this->cacheRoot.'/pancreas/new_key'))->toBeTrue();

    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--dry-run' => true,
        '--force-as-user' => 1,
    ]);
    expect($exit)->toBe(0);

    // Old dir still exists — dry-run made no mutations.
    expect(is_dir($this->cacheRoot.'/pancreas/old_key'))->toBeTrue();
    expect(is_dir($this->cacheRoot.'/pancreas/new_key'))->toBeTrue();
    expect(is_dir($this->cacheRoot.'/synpuf/ancient_key'))->toBeTrue();

    // Output contains JSONL for the old key + the ancient synpuf key.
    $output = Artisan::output();
    expect($output)->toContain('"action":"would_delete"');
    expect($output)->toContain('pancreas/old_key');
    expect($output)->toContain('synpuf/ancient_key');
    // Fresh new_key must NOT be listed.
    expect($output)->not->toContain('pancreas/new_key');
    // Final summary line reports counts.
    expect($output)->toContain('"status":"ok"');
    expect($output)->toContain('"evicted":2');
});

it('deletes old cache directories when not in dry-run', function () {
    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--force-as-user' => 1,
    ]);
    expect($exit)->toBe(0);

    // Old + ancient directories are gone.
    expect(is_dir($this->cacheRoot.'/pancreas/old_key'))->toBeFalse();
    expect(is_dir($this->cacheRoot.'/synpuf/ancient_key'))->toBeFalse();

    // Fresh directory untouched.
    expect(is_dir($this->cacheRoot.'/pancreas/new_key'))->toBeTrue();

    $output = Artisan::output();
    expect($output)->toContain('"action":"delete"');
    expect($output)->toContain('"evicted":2');
});

it('--source filter limits scope to that subtree', function () {
    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--source' => 'synpuf',
        '--dry-run' => true,
        '--force-as-user' => 1,
    ]);
    expect($exit)->toBe(0);

    $output = Artisan::output();
    // Synpuf ancient key IS in scope.
    expect($output)->toContain('synpuf/ancient_key');
    // Pancreas subtree must NOT appear (--source scoped us out).
    expect($output)->not->toContain('pancreas/old_key');
    expect($output)->toContain('"evicted":1');
});

it('rejects unsafe --source via preg_match allow-list (T-14-28)', function () {
    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--source' => '../../etc',
        '--dry-run' => true,
        '--force-as-user' => 1,
    ]);
    expect($exit)->not->toBe(0);
});

it('no-op on empty cache (exits 0 with evicted=0)', function () {
    // Clean the cache root so nothing matches.
    removeDirRecursive($this->cacheRoot);
    mkdir($this->cacheRoot, 0o755, true);

    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--dry-run' => true,
        '--force-as-user' => 1,
    ]);
    expect($exit)->toBe(0);

    $output = Artisan::output();
    expect($output)->toContain('"evicted":0');
    expect($output)->toContain('"status":"ok"');
});

it('refuses to run without super-admin gate when APP_ENV is production', function () {
    app()->detectEnvironment(fn () => 'production');

    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--dry-run' => true,
    ]);
    expect($exit)->not->toBe(0);

    // Nothing deleted.
    expect(is_dir($this->cacheRoot.'/pancreas/old_key'))->toBeTrue();
});

it('falls back to directory mtime when fit_pred.list is absent', function () {
    // Drop the marker from old_key; the dir itself keeps its default
    // mtime (now-ish), so prune should NOT evict it at --older-than=30d.
    @unlink($this->cacheRoot.'/pancreas/old_key/fit_pred.list');

    $exit = Artisan::call('finngen:gwas-cache-prune', [
        '--older-than' => '30d',
        '--dry-run' => true,
        '--force-as-user' => 1,
    ]);
    expect($exit)->toBe(0);

    $output = Artisan::output();
    // Old_key dir mtime is now-ish (scandir/mkdir from beforeEach), so it
    // should NOT be evicted when the marker is missing.
    expect($output)->not->toContain('pancreas/old_key');
    // Synpuf ancient_key's marker IS present → evicted as normal.
    expect($output)->toContain('synpuf/ancient_key');
});
