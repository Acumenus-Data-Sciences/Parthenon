<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'r_runtime' => [
        'url' => env('R_SERVICE_URL', 'http://darkstar:8787'),
        'timeout' => env('R_SERVICE_TIMEOUT', 7200),
    ],

    // Phase 16: DICOMweb / Orthanc
    'dicomweb' => [
        'base_url' => env('DICOMWEB_BASE_URL', 'http://orthanc:8042'),
        'username' => env('DICOMWEB_USERNAME'),
        'password' => env('DICOMWEB_PASSWORD'),
    ],

    // Phase 16: AI service base URL (used by RadiologyNlpService)
    'ai' => [
        'base_url' => env('AI_SERVICE_URL', 'http://python-ai:8000'),
        'url' => env('AI_SERVICE_URL', 'http://python-ai:8000'),
        'timeout' => env('AI_SERVICE_TIMEOUT', 30),
    ],

    // Hecate: OHDSI semantic vocabulary search engine (Rust/actix-web + Qdrant)
    'hecate' => [
        'url' => env('HECATE_URL', 'http://hecate:8080'),
    ],

    // FhirToCdm: OHDSI FHIR R4 → OMOP CDM conversion sidecar (Python/dotnet wrapper)
    'fhir_to_cdm' => [
        'url' => env('FHIR_TO_CDM_URL', 'http://fhir-to-cdm:8091'),
        'timeout' => env('FHIR_TO_CDM_TIMEOUT', 300),
    ],

    // WhiteRabbit: OHDSI source database profiler (Java CLI wrapped in Python HTTP server)
    'whiterabbit' => [
        'url' => env('WHITERABBIT_URL', 'http://whiterabbit:8090'),
    ],

    // Grafana: Metrics and monitoring dashboard
    'grafana' => [
        'url' => env('GRAFANA_URL', 'http://grafana:3000'),
    ],

    'jupyter' => [
        'hub_url' => env('JUPYTER_URL', 'http://jupyterhub:8000'),
        'base_url' => env('JUPYTER_BASE_URL', '/jupyter'),
        'jwt_secret' => env('JUPYTER_JWT_SECRET', ''),
        'hub_api_key' => env('JUPYTER_HUB_API_KEY', ''),
        'db_researcher_password' => env('JUPYTER_DB_RESEARCHER_PASSWORD', ''),
        'db_admin_password' => env('JUPYTER_DB_ADMIN_PASSWORD', ''),
    ],

    // Phase 17: Genomic evidence proxies
    'open_targets' => [
        'url' => env('OPEN_TARGETS_URL', 'https://api.platform.opentargets.org/api/v4/graphql'),
        'timeout' => env('OPEN_TARGETS_TIMEOUT', 10),
        'cache_ttl' => env('OPEN_TARGETS_CACHE_TTL', 86400),
    ],

    'gwas_catalog' => [
        'url' => env('GWAS_CATALOG_URL', 'https://www.ebi.ac.uk/gwas/rest/api'),
        'timeout' => env('GWAS_CATALOG_TIMEOUT', 10),
        'cache_ttl' => env('GWAS_CATALOG_CACHE_TTL', 86400),
    ],

];
