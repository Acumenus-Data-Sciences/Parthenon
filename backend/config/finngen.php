<?php

return [
    'pg_ro_password' => env('FINNGEN_PG_RO_PASSWORD'),
    'pg_rw_password' => env('FINNGEN_PG_RW_PASSWORD'),

    'darkstar_url' => env('FINNGEN_DARKSTAR_URL', env('R_SERVICE_URL', 'http://darkstar:8787')),
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
