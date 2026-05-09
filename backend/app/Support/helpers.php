<?php

declare(strict_types=1);

use App\Contracts\ObservabilityShipperInterface;
use App\Observability\Observer;

if (! function_exists('obs')) {
    /**
     * Resolve the singleton {@see Observer} for emitting
     * structured logs, metrics, and trace spans through the registered
     * {@see ObservabilityShipperInterface} shippers.
     *
     *   obs()->log('info', 'cohort generated', ['cohort_id' => $id]);
     *   obs()->metric('parthenon.cohorts.generated.count', 1.0);
     *   $h = obs()->span('cohort.materialize', ['cohort_id' => $id]);
     */
    function obs(): Observer
    {
        return app(Observer::class);
    }
}
