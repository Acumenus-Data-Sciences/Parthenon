<?php

return [
    // Phase 13.2-06: Laravel connection name for FinnGen models. Defaults to
    // 'finngen' (live DEV parthenon) but is overridden to 'finngen_testing'
    // in phpunit.xml via FINNGEN_DB_CONNECTION so Pest tests transact writes
    // against parthenon_testing through TestCase::$connectionsToTransact.
    'connection' => env('FINNGEN_DB_CONNECTION', 'finngen'),

    // Phase 13.2-06: read-only connection for EndpointBrowserController and
    // any other finngen read path. Defaults to 'finngen_ro' (parthenon_finngen_ro
    // role on live DEV parthenon); overridden to 'finngen_ro_testing' via
    // FINNGEN_RO_DB_CONNECTION in phpunit.xml so read-path tests see rows
    // created in-transaction by factories on the finngen_testing connection.
    'ro_connection' => env('FINNGEN_RO_DB_CONNECTION', 'finngen_ro'),

    'pg_ro_password' => env('FINNGEN_PG_RO_PASSWORD'),
    'pg_rw_password' => env('FINNGEN_PG_RW_PASSWORD'),

    'darkstar_url' => env('FINNGEN_DARKSTAR_URL', env('DARKSTAR_URL', env('R_SERVICE_URL', 'http://darkstar:8787'))),
    'darkstar_timeout_sync_ms' => (int) env('FINNGEN_DARKSTAR_TIMEOUT_SYNC_MS', 30_000),
    'darkstar_timeout_dispatch_ms' => (int) env('FINNGEN_DARKSTAR_TIMEOUT_DISPATCH_MS', 10_000),
    'darkstar_timeout_poll_ms' => (int) env('FINNGEN_DARKSTAR_TIMEOUT_POLL_MS', 120_000),

    'artifacts_path' => env('FINNGEN_ARTIFACTS_PATH', '/opt/finngen-artifacts'),
    'artifacts_stream_threshold_bytes' => (int) env('FINNGEN_ARTIFACT_STREAM_THRESHOLD', 10 * 1024 * 1024),

    'gc_retention_days' => (int) env('FINNGEN_GC_RETENTION_DAYS', 90),

    'idempotency_ttl_seconds' => (int) env('FINNGEN_IDEMPOTENCY_TTL', 300),

    'sync_cache_ttl_seconds' => (int) env('FINNGEN_SYNC_CACHE_TTL', 3600),

    // Env-driven default. The Cache-backed runtime override is consulted at
    // request time by FinnGenRunService::create() via Cache::get('finngen.pause_dispatch').
    // The `finngen:pause-dispatch` artisan command toggles the cache key.
    // Spec §7.3.
    'pause_dispatch' => (bool) env('FINNGEN_PAUSE_DISPATCH', false),

    'cancel_force_recycle_after_seconds' => (int) env('FINNGEN_CANCEL_CEILING', 60),
];
