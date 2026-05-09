<?php

declare(strict_types=1);

use App\Models\App\ManagedShinyLaunch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow(Carbon::parse('2026-05-09 18:00:00'));

    $this->workspaceRoot = sys_get_temp_dir().'/managed-shiny-cleanup-'.Str::uuid();

    config()->set('services.shiny_proxy.workspace_root', $this->workspaceRoot);
    config()->set('services.shiny_proxy.workspace_cleanup_grace_minutes', 60);
    config()->set('services.shiny_proxy.workspace_orphan_cleanup_grace_minutes', 1440);

    File::ensureDirectoryExists($this->workspaceRoot.'/launches');
});

afterEach(function (): void {
    Carbon::setTestNow();

    if (isset($this->workspaceRoot) && File::isDirectory($this->workspaceRoot)) {
        File::deleteDirectory($this->workspaceRoot);
    }
});

it('dry-runs expired workspace cleanup without deleting audited directories', function () {
    $workspaceId = (string) Str::uuid();
    $workspacePath = managedShinyCleanupWorkspace($this->workspaceRoot, $workspaceId);

    ManagedShinyLaunch::create([
        'workspace_id' => $workspaceId,
        'app_key' => 'ohdsi-report',
        'status' => 'resolved',
        'token_hash' => str_repeat('a', 64),
        'expires_at' => now()->subMinutes(90),
        'metadata' => ['existing' => true],
    ]);

    $exit = Artisan::call('shiny:cleanup-workspaces', [
        '--dry-run' => true,
    ]);

    expect($exit)->toBe(0)
        ->and(File::isDirectory($workspacePath))->toBeTrue();

    $output = Artisan::output();
    expect($output)->toContain('"action":"would_delete"')
        ->and($output)->toContain($workspaceId)
        ->and($output)->toContain('"deleted":1')
        ->and($output)->toContain('"dry_run":true');

    $launch = ManagedShinyLaunch::where('workspace_id', $workspaceId)->firstOrFail();
    expect(array_key_exists('workspace_cleaned_at', $launch->metadata ?? []))->toBeFalse();
});

it('deletes expired audited workspaces after the configured grace period', function () {
    $workspaceId = (string) Str::uuid();
    $workspacePath = managedShinyCleanupWorkspace($this->workspaceRoot, $workspaceId);

    ManagedShinyLaunch::create([
        'workspace_id' => $workspaceId,
        'app_key' => 'ohdsi-report',
        'status' => 'resolved',
        'token_hash' => str_repeat('b', 64),
        'expires_at' => now()->subMinutes(121),
        'metadata' => ['existing' => true],
    ]);

    $exit = Artisan::call('shiny:cleanup-workspaces');

    expect($exit)->toBe(0)
        ->and(File::isDirectory($workspacePath))->toBeFalse();

    $launch = ManagedShinyLaunch::where('workspace_id', $workspaceId)->firstOrFail();
    expect($launch->metadata)->toHaveKey('workspace_cleaned_at');

    $output = Artisan::output();
    expect($output)->toContain('"action":"delete"')
        ->and($output)->toContain('"deleted":1')
        ->and($output)->toContain('"status":"ok"');
});

it('skips active audited workspaces and malformed workspace names', function () {
    $activeWorkspaceId = (string) Str::uuid();
    $activePath = managedShinyCleanupWorkspace($this->workspaceRoot, $activeWorkspaceId);
    $malformedPath = managedShinyCleanupWorkspace($this->workspaceRoot, 'not-a-uuid');

    ManagedShinyLaunch::create([
        'workspace_id' => $activeWorkspaceId,
        'app_key' => 'ohdsi-report',
        'status' => 'resolved',
        'token_hash' => str_repeat('c', 64),
        'expires_at' => now()->subMinutes(30),
    ]);

    $exit = Artisan::call('shiny:cleanup-workspaces');

    expect($exit)->toBe(0)
        ->and(File::isDirectory($activePath))->toBeTrue()
        ->and(File::isDirectory($malformedPath))->toBeTrue();

    $output = Artisan::output();
    expect($output)->toContain('"action":"skip_active"')
        ->and($output)->toContain('"action":"skip_malformed"')
        ->and($output)->toContain('"deleted":0')
        ->and($output)->toContain('"skipped":2');
});

it('deletes stale untracked uuid workspaces after the orphan grace period', function () {
    $staleWorkspaceId = (string) Str::uuid();
    $freshWorkspaceId = (string) Str::uuid();
    $stalePath = managedShinyCleanupWorkspace($this->workspaceRoot, $staleWorkspaceId);
    $freshPath = managedShinyCleanupWorkspace($this->workspaceRoot, $freshWorkspaceId);

    touch($stalePath, now()->subMinutes(1500)->timestamp);
    touch($freshPath, now()->subMinutes(30)->timestamp);

    $exit = Artisan::call('shiny:cleanup-workspaces');

    expect($exit)->toBe(0)
        ->and(File::isDirectory($stalePath))->toBeFalse()
        ->and(File::isDirectory($freshPath))->toBeTrue();

    $output = Artisan::output();
    expect($output)->toContain('"action":"delete_untracked"')
        ->and($output)->toContain('"action":"skip_untracked"')
        ->and($output)->toContain('"deleted":1')
        ->and($output)->toContain('"skipped":1');
});

it('rejects unsafe empty workspace roots', function () {
    config()->set('services.shiny_proxy.workspace_root', '/');

    $exit = Artisan::call('shiny:cleanup-workspaces');

    expect($exit)->toBe(1)
        ->and(Artisan::output())->toContain('unsafe root');
});

function managedShinyCleanupWorkspace(string $workspaceRoot, string $workspaceId): string
{
    $path = "{$workspaceRoot}/launches/{$workspaceId}";
    File::ensureDirectoryExists($path);
    File::put("{$path}/context.json", '{}');

    return $path;
}
