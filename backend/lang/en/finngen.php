<?php

declare(strict_types=1);

return [
    'errors' => [
        /*
         * R-side categories (emitted by darkstar/api/finngen/common.R
         * run_with_classification). Keyed lowercase; mapped via
         * FinnGenErrorMapper::DARKSTAR_R_CATEGORIES.
         */
        'db_connection_failed' => "Couldn't connect to the data source. Check the source configuration.",
        'db_schema_mismatch' => 'The data source is missing expected tables or columns. This usually means the CDM needs to be re-ingested or the source config is wrong.',
        'out_of_memory' => 'The analysis ran out of memory. Try a smaller cohort or narrower covariates.',
        'package_not_loaded' => 'A required R package is not loaded in the runtime. Contact an administrator.',
        'analysis_exception' => 'The analysis failed. See details below.',
        'mirai_task_crashed' => 'The R worker process crashed. This is usually transient — retry.',
        'timeout' => 'The analysis exceeded its allowed runtime.',
        'disk_full' => 'The artifact volume is full. Contact an administrator.',
        'canceled' => 'The analysis was canceled.',
        'unknown' => 'The analysis failed for an unknown reason. See details below.',
    ],

    /*
     * Error code PREFIXES (for diagnostic surfacing — spec §5.1).
     * Not user-facing — these appear in audit logs and the API error envelope.
     */
    'wrapper_prefix' => [
        'validation' => 'FINNGEN_',
        'transport' => 'FINNGEN_DARKSTAR_',
        'r' => 'DARKSTAR_R_',
    ],
];
