<?php

return [
    'enabled' => env('SOLR_ENABLED', false),

    'endpoint' => [
        'default' => [
            'host' => env('SOLR_HOST', 'solr'),
            'port' => (int) env('SOLR_PORT', 8983),
            'path' => '/',
            'timeout' => (int) env('SOLR_TIMEOUT', 5),
        ],
    ],

    'cores' => [
        'vocabulary' => env('SOLR_CORE_VOCABULARY', 'vocabulary'),
        'cohorts' => env('SOLR_CORE_COHORTS', 'cohorts'),
        'analyses' => env('SOLR_CORE_ANALYSES', 'analyses'),
        'mappings' => env('SOLR_CORE_MAPPINGS', 'mappings'),
        'clinical' => env('SOLR_CORE_CLINICAL', 'clinical'),
        'imaging' => env('SOLR_CORE_IMAGING', 'imaging'),
        'claims' => env('SOLR_CORE_CLAIMS', 'claims'),
    ],

    'circuit_breaker' => [
        'failure_threshold' => (int) env('SOLR_CB_FAILURE_THRESHOLD', 5),
        'recovery_timeout' => (int) env('SOLR_CB_RECOVERY_TIMEOUT', 30),
    ],
];
