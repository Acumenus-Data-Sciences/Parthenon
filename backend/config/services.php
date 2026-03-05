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
        'url' => env('R_SERVICE_URL', 'http://r-runtime:8787'),
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

];
