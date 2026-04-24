<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Measure Evaluator
    |--------------------------------------------------------------------------
    |
    | Which CareBundleMeasureEvaluator implementation to bind. The evaluator
    | computes numerator/denominator counts per measure during materialization.
    |
    |   cohort_based — direct analytical SQL over CDM domain tables (MVP).
    |   cql          — CQL runtime bridge (Phase 3b; requires cqf-ruler or
    |                  an equivalent CQL engine to be running).
    |
    */
    'evaluator' => env('CARE_BUNDLES_EVALUATOR', 'cohort_based'),

    /*
    |--------------------------------------------------------------------------
    | CQL Engine (Phase 3b — not yet wired)
    |--------------------------------------------------------------------------
    */
    'cql' => [
        'engine_url' => env('CARE_BUNDLES_CQL_ENGINE_URL'),
        'engine_timeout_ms' => (int) env('CARE_BUNDLES_CQL_TIMEOUT_MS', 60_000),
    ],

    /*
    |--------------------------------------------------------------------------
    | FHIR Export
    |--------------------------------------------------------------------------
    |
    | Publisher / base URL stamped into exported FHIR Measure resources.
    | Canonical URLs follow ${base_url}/Measure/{measure_code}.
    |
    */
    'fhir' => [
        'publisher' => env('CARE_BUNDLES_FHIR_PUBLISHER', 'Parthenon'),
        'base_url' => env('CARE_BUNDLES_FHIR_BASE_URL', 'https://parthenon.local/fhir'),
    ],
];
