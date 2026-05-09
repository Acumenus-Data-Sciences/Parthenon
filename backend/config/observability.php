<?php

declare(strict_types=1);

use App\Observability\Shippers\LokiPrometheusShipper;

return [
    /*
    |--------------------------------------------------------------------------
    | Active observability shippers
    |--------------------------------------------------------------------------
    |
    | Ordered list of class names implementing
    | App\Contracts\ObservabilityShipperInterface. Each is resolved through
    | the container at boot. EE bundles append DatadogShipper, SplunkShipper,
    | OtelShipper here without modifying CE code.
    */
    'shippers' => [
        LokiPrometheusShipper::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Sampling rates
    |--------------------------------------------------------------------------
    |
    | 1.0 = 100% sampled, 0.0 = nothing sampled. Applied per-event-type by the
    | EE shippers; the CE LokiPrometheusShipper currently honors these only
    | for traces (logs/metrics flow unfiltered through the Laravel logger).
    */
    'sampling' => [
        'logs' => env('OBS_LOG_SAMPLING', 1.0),
        'metrics' => env('OBS_METRIC_SAMPLING', 1.0),
        'traces' => env('OBS_TRACE_SAMPLING', 0.1),
    ],
];
