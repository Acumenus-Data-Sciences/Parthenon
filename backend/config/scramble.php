<?php

return [
    /*
     * Your API path. By default, all routes starting with this path will be added to the docs.
     * If you need to change this behavior, you can add your custom routes resolver using `Scramble::routes()`.
     */
    'api_path' => 'api',

    /*
     * Your API domain. By default, app domain is used. This is also a part of the default API routes
     * matcher, so when implementing your own, make sure you use this config if needed.
     */
    'api_domain' => null,

    /*
     * The path where your OpenAPI specification will be exported.
     */
    'export_path' => 'api.json',

    'info' => [
        /*
         * API version.
         */
        'version' => env('API_VERSION', '1.0.0'),

        /*
         * Description rendered on the home page of the API documentation (`/docs/api`).
         */
        'description' => <<<'MD'
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
MD,
    ],

    /*
     * Customize Stoplight Elements UI
     */
    'ui' => [
        /*
         * Define the title of the documentation's website. App name is used when this config is `null`.
         */
        'title' => 'Parthenon API Reference',

        /*
         * Define the theme of the documentation. Available options are `light`, `dark`, and `system`.
         */
        'theme' => 'dark',

        /*
         * Hide the `Try It` feature. Enabled by default.
         */
        'hide_try_it' => false,

        /*
         * Hide the schemas in the Table of Contents. Enabled by default.
         */
        'hide_schemas' => false,

        /*
         * URL to an image that displays as a small square logo next to the title, above the table of contents.
         */
        'logo' => '/parthenon_icon.png',

        /*
         * Use to fetch the credential policy for the Try It feature. Options are: omit, include (default), and same-origin
         */
        'try_it_credentials_policy' => 'include',

        /*
         * There are three layouts for Elements:
         * - sidebar - (Elements default) Three-column design with a sidebar that can be resized.
         * - responsive - Like sidebar, except at small screen sizes it collapses the sidebar into a drawer that can be toggled open.
         * - stacked - Everything in a single column, making integrations with existing websites that have their own sidebar or other columns already.
         */
        'layout' => 'responsive',
    ],

    /*
     * The list of servers of the API. By default, when `null`, server URL will be created from
     * `scramble.api_path` and `scramble.api_domain` config variables. When providing an array, you
     * will need to specify the local server URL manually (if needed).
     *
     * Example of non-default config (final URLs are generated using Laravel `url` helper):
     *
     * ```php
     * 'servers' => [
     *     'Live' => 'api',
     *     'Prod' => 'https://scramble.dedoc.co/api',
     * ],
     * ```
     */
    'servers' => null,

    /**
     * Determines how Scramble stores the descriptions of enum cases.
     * Available options:
     * - 'description' – Case descriptions are stored as the enum schema's description using table formatting.
     * - 'extension' – Case descriptions are stored in the `x-enumDescriptions` enum schema extension.
     *
     *    @see https://redocly.com/docs-legacy/api-reference-docs/specification-extensions/x-enum-descriptions
     * - false - Case descriptions are ignored.
     */
    'enum_cases_description_strategy' => 'description',

    /**
     * Determines how Scramble stores the names of enum cases.
     * Available options:
     * - 'names' – Case names are stored in the `x-enumNames` enum schema extension.
     * - 'varnames' - Case names are stored in the `x-enum-varnames` enum schema extension.
     * - false - Case names are not stored.
     */
    'enum_cases_names_strategy' => false,

    /**
     * When Scramble encounters deep objects in query parameters, it flattens the parameters so the generated
     * OpenAPI document correctly describes the API. Flattening deep query parameters is relevant until
     * OpenAPI 3.2 is released and query string structure can be described properly.
     *
     * For example, this nested validation rule describes the object with `bar` property:
     * `['foo.bar' => ['required', 'int']]`.
     *
     * When `flatten_deep_query_parameters` is `true`, Scramble will document the parameter like so:
     * `{"name":"foo[bar]", "schema":{"type":"int"}, "required":true}`.
     *
     * When `flatten_deep_query_parameters` is `false`, Scramble will document the parameter like so:
     *  `{"name":"foo", "schema": {"type":"object", "properties":{"bar":{"type": "int"}}, "required": ["bar"]}, "required":true}`.
     */
    'flatten_deep_query_parameters' => true,

    'middleware' => [
        'web',
    ],

    'extensions' => [],
];
