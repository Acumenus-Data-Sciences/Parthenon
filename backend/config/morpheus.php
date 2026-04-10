<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Morpheus Database Connection
    |--------------------------------------------------------------------------
    |
    | The Laravel connection name used by MorpheusDashboardService,
    | MorpheusPatientService, SchemaIntrospector, and the Morpheus controllers
    | to read the dataset registry (inpatient_ext.morpheus_dataset) and the
    | per-dataset MIMIC-shaped clinical tables.
    |
    | Production: 'inpatient' — targets the real `parthenon` database.
    | Tests:      'inpatient_testing' — targets `parthenon_testing`, set via
    |             MORPHEUS_DB_CONNECTION in phpunit.xml. This isolation is
    |             required because the default 'inpatient' connection inherits
    |             DB_DATABASE from the Docker container env and would otherwise
    |             leak test writes into the production database.
    |
    */

    'connection' => env('MORPHEUS_DB_CONNECTION', 'inpatient'),

];
