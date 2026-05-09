<?php

declare(strict_types=1);

use App\Models\App\ManagedShinyLaunch;
use App\Services\Shiny\ManagedShinyLaunchMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

afterEach(function (): void {
    Carbon::setTestNow();
});

it('summarizes managed Shiny launch and resolver metrics', function () {
    Carbon::setTestNow(Carbon::parse('2026-05-09 18:00:00'));

    config()->set('services.shiny_proxy.base_url', '/shiny');
    config()->set('services.shiny_proxy.launch_ttl_minutes', 15);
    config()->set('services.shiny_proxy.launch_context_rate_limit_per_minute', 37);

    managedShinyMetricsLaunch([
        'status' => 'issued',
        'expires_at' => now()->addMinutes(10),
        'created_at' => now()->subMinutes(10),
    ]);

    managedShinyMetricsLaunch([
        'status' => 'resolved',
        'expires_at' => now()->addMinutes(5),
        'created_at' => now()->subMinutes(20),
        'resolved_at' => now()->subMinutes(5),
    ]);

    managedShinyMetricsLaunch([
        'status' => 'failed',
        'expires_at' => now()->subMinutes(5),
        'created_at' => now()->subHours(2),
        'failed_at' => now()->subMinutes(30),
        'failure_reason' => 'expired',
    ]);

    $snapshot = app(ManagedShinyLaunchMetrics::class)->snapshot();

    expect($snapshot['base_url_configured'])->toBeTrue()
        ->and($snapshot['launch_ttl_minutes'])->toBe(15)
        ->and($snapshot['launch_context_rate_limit_per_minute'])->toBe(37)
        ->and($snapshot['total_launches'])->toBe(3)
        ->and($snapshot['by_status'])->toBe([
            'issued' => 1,
            'resolved' => 1,
            'failed' => 1,
        ])
        ->and($snapshot['issued_last_24h'])->toBe(3)
        ->and($snapshot['resolved_last_24h'])->toBe(1)
        ->and($snapshot['failed_last_24h'])->toBe(1)
        ->and($snapshot['active_sessions'])->toBe(1)
        ->and($snapshot['pending_launches'])->toBe(1)
        ->and($snapshot['expired_unresolved'])->toBe(1)
        ->and($snapshot['average_resolution_seconds'])->toBe(900.0)
        ->and($snapshot['failure_reasons'])->toBe(['expired' => 1]);
});

/**
 * @param  array<string, mixed>  $overrides
 */
function managedShinyMetricsLaunch(array $overrides = []): ManagedShinyLaunch
{
    $launch = ManagedShinyLaunch::create([
        'workspace_id' => (string) Str::uuid(),
        'app_key' => 'ohdsi-report',
        'runtime' => 'shinyproxy',
        'mode' => 'embedded',
        'status' => 'issued',
        'token_hash' => str_repeat('d', 64),
        'expires_at' => now()->addMinutes(15),
        ...$overrides,
    ]);

    if (array_key_exists('created_at', $overrides)) {
        $launch->forceFill(['created_at' => $overrides['created_at']])->save();
    }

    return $launch;
}
