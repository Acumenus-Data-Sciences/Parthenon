<?php

use Knuckles\Scribe\Config\AuthIn;
use Knuckles\Scribe\Config\Defaults;
use Knuckles\Scribe\Extracting\Strategies;

use function Knuckles\Scribe\Config\configureStrategy;

return [
    'title' => 'Parthenon API Reference',

    'description' => '',

    'intro_text' => <<<'INTRO'
## Unified Outcomes Research Platform

Parthenon provides a comprehensive REST API for clinical data analysis built on the **OMOP Common Data Model v5.4**. It powers cohort building, population-level estimation, patient-level prediction, pathway analysis, genomics, medical imaging, and health economics research — all through a single, consistent interface.

### Getting Started

**Authentication** — All endpoints require [Laravel Sanctum](https://laravel.com/docs/sanctum) Bearer token authentication unless marked public.

```
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "your-password" }
```

The response includes a `token` field — pass it as `Authorization: Bearer {token}` on subsequent requests.

### API Groups

| Group | Description |
|-------|-------------|
| **Authentication** | Login, registration, password management |
| **Cohort Definitions** | Build and generate patient cohorts using Circe expressions |
| **Concept Sets** | Manage OMOP concept sets with vocabulary lookups |
| **Analyses** | Incidence rates, characterizations, estimations, predictions, pathways |
| **Data Sources** | Configure CDM/vocabulary/results database connections |
| **Vocabulary** | Search concepts, browse hierarchies, map codes |
| **Data Quality** | Achilles characterization and DQD heel checks |
| **Imaging** | DICOM study management, DICOMweb integration, radiology NLP |
| **Genomics** | Variant queries, ClinVar annotations, gene-level analysis |
| **HEOR** | Cost-effectiveness, budget impact, Markov modeling |
| **Administration** | Users, roles, permissions, system health, AI providers |

### Standards & Conventions

- **Response envelope**: All responses wrap data in `{ "data": ... }` with pagination metadata where applicable
- **Error format**: `{ "message": "...", "errors": { "field": ["..."] } }` with appropriate HTTP status codes
- **Pagination**: `?page=N&per_page=N` query parameters, responses include `total`, `current_page`, `last_page`
- **Rate limiting**: Auth endpoints throttled at 5 requests / 15 minutes per IP

---

*Built by [Acumenus Data Sciences](https://www.acumenus.io) — open source on [GitHub](https://github.com/sudoshi/Parthenon)*
INTRO,

    'base_url' => env('APP_URL', 'http://localhost:8082'),

    'routes' => [
        [
            'match' => [
                'prefixes' => ['api/*'],
                'domains' => ['*'],
            ],
            'include' => [],
            'exclude' => [],
        ],
    ],

    'type' => 'static',

    'theme' => 'default',

    'static' => [
        'output_path' => 'public/docs',
    ],

    'laravel' => [
        'add_routes' => false,
        'docs_url' => '/docs',
        'assets_directory' => null,
        'middleware' => [],
    ],

    'external' => [
        'html_attributes' => [],
    ],

    'try_it_out' => [
        'enabled' => true,
        'base_url' => null,
        'use_csrf' => false,
        'csrf_url' => '/sanctum/csrf-cookie',
    ],

    'auth' => [
        'enabled' => true,
        'default' => false,
        'in' => AuthIn::BEARER->value,
        'name' => 'Authorization',
        'use_value' => env('SCRIBE_AUTH_KEY', 'your-sanctum-token'),
        'placeholder' => '{SANCTUM_TOKEN}',
        'extra_info' => 'Authenticate via POST /api/v1/auth/login to get a Bearer token.',
    ],

    'example_languages' => [
        'bash',
        'javascript',
    ],

    'postman' => [
        'enabled' => false,
        'overrides' => [],
    ],

    'openapi' => [
        'enabled' => true,
        'version' => '3.0.3',
        'overrides' => [],
        'generators' => [],
    ],

    'groups' => [
        'default' => 'Endpoints',
        'order' => [
            'Search',
            'Authentication',
            'User Profile',
            'Dashboard',
            'Data Sources',
            'Cohort Definitions',
            'Concept Sets',
            'Concept Explorer',
            'Vocabulary',
            'Vocabulary Mapping',
            'Publication & Export',
            'Analyses',
            'Incidence Rates',
            'Characterization',
            'Population-Level Estimation',
            'Patient-Level Prediction',
            'SCCS',
            'Negative Controls',
            'Evidence Synthesis',
            'Cohort Diagnostics',
            'Treatment Pathways',
            'Care Bundles & Gaps',
            'Studies',
            'Data Explorer',
            'Population Analytics',
            'Data Ingestion',
            'Data Quality',
            'AI Assistant (Abby)',
            'Commons',
            'GIS Explorer',
            'Imaging',
            'Genomics',
            'HEOR',
            'Claims',
            'Administration',
            'FHIR to CDM',
            'Morpheus Dashboard',
            'Morpheus Datasets',
            'Morpheus Patient Journey',
            'Text-to-SQL',
            'Network Analysis',
            'Patient Profiles',
            'System',
            'Help & Changelog',
            'Query Library',
        ],
    ],

    'logo' => '../parthenon_icon.png',

    'last_updated' => 'Last updated: {date:F j, Y}',

    'examples' => [
        'faker_seed' => 1234,
        'models_source' => ['factoryCreate', 'factoryMake', 'databaseFirst'],
    ],

    'strategies' => [
        'metadata' => [
            ...Defaults::METADATA_STRATEGIES,
        ],
        'headers' => [
            ...Defaults::HEADERS_STRATEGIES,
            Strategies\StaticData::withSettings(data: [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ]),
        ],
        'urlParameters' => [
            ...Defaults::URL_PARAMETERS_STRATEGIES,
        ],
        'queryParameters' => [
            ...Defaults::QUERY_PARAMETERS_STRATEGIES,
        ],
        'bodyParameters' => [
            ...Defaults::BODY_PARAMETERS_STRATEGIES,
        ],
        'responses' => configureStrategy(
            Defaults::RESPONSES_STRATEGIES,
            Strategies\Responses\ResponseCalls::withSettings(
                only: [],
                config: [
                    'app.debug' => false,
                ]
            )
        ),
        'responseFields' => [
            ...Defaults::RESPONSE_FIELDS_STRATEGIES,
        ],
    ],

    'database_connections_to_transact' => [config('database.default')],

    'fractal' => [
        'serializer' => null,
    ],
];
