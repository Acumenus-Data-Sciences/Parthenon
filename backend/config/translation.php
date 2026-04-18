<?php

declare(strict_types=1);

use App\Enums\TranslationDataClass;
use App\Services\Translation\Providers\LocalFileTranslationProvider;

return [
    'primary' => env('TRANSLATION_PROVIDER_PRIMARY', 'local'),
    'machine_translation' => env('TRANSLATION_PROVIDER_MT', 'local'),
    'review' => env('TRANSLATION_PROVIDER_REVIEW', 'local'),
    'regulated' => env('TRANSLATION_PROVIDER_REGULATED', 'none'),
    'allow_phi' => filter_var(env('TRANSLATION_ALLOW_PHI', false), FILTER_VALIDATE_BOOL),

    'allowed_data_classes' => [
        TranslationDataClass::ProductCopy->value,
        TranslationDataClass::Documentation->value,
        TranslationDataClass::ExportTemplate->value,
    ],

    'providers' => [
        'local' => [
            'class' => LocalFileTranslationProvider::class,
        ],
    ],

    'placeholder_names' => [
        'attribute',
        'date',
        'input',
        'max',
        'min',
        'other',
        'seconds',
        'size',
        'status',
        'value',
        'values',
    ],

    'protected_terms' => [
        'Parthenon',
        'Acumenus',
        'Abby',
        'OMOP',
        'CDM',
        'OHDSI',
        'HADES',
        'FHIR',
        'DICOM',
        'PACS',
        'OpenAPI',
        'Docusaurus',
        'LiveKit',
        'MedGemma',
    ],
];
