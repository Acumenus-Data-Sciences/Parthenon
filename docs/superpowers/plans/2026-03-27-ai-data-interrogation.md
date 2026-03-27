# AI Data Interrogation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the AI config panel to actual LLM calls and add a data interrogation agent that lets researchers ask natural language questions against the OMOP CDM.

**Architecture:** A new `AnalyticsLlmService` reads the active provider from `ai_provider_settings` and dispatches to the correct API (Anthropic Messages, OpenAI-compatible, Gemini, Ollama). A `DataInterrogationService` orchestrates a multi-step agent loop: NL → SQL → execute → interpret, using a read-only `abby_analyst` Postgres role with a `temp_abby` scratch schema. The Abby chat panel routes `/data` prefixed messages to this new endpoint.

**Tech Stack:** Laravel 11, PHP 8.4, PostgreSQL 16/17, React 19, TypeScript, TanStack Query, Tailwind 4

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/Services/AI/AnalyticsLlmService.php` | Multi-provider LLM client — reads active provider from DB, dispatches to correct API format |
| `backend/app/Services/AI/DataInterrogationService.php` | Agent loop orchestrator — NL→SQL→execute→interpret, up to 5 iterations |
| `backend/app/Http/Controllers/Api/V1/DataInterrogationController.php` | Single `ask()` endpoint |
| `backend/app/Http/Requests/Api/DataInterrogationRequest.php` | Form Request validation |
| `backend/app/Console/Commands/AbbySetupAnalyst.php` | Artisan command to create `abby_analyst` role + `temp_abby` schema |
| `backend/config/cdm-interrogation-schema.php` | Curated OMOP v5.4 schema reference for prompt context (~2K tokens) |
| `frontend/src/features/commons/components/abby/DataInterrogationResult.tsx` | Chat message renderer for data interrogation results |
| `frontend/src/features/commons/services/dataInterrogationService.ts` | API client for `/data-interrogation/ask` |

### Modified Files

| File | Change |
|------|--------|
| `backend/config/database.php` | Add `interrogation` connection |
| `backend/routes/api.php` | Add `/data-interrogation/ask` route |
| `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx` | Route `/data` messages to new endpoint, render `DataInterrogationResult` |
| `frontend/src/features/commons/types/abby.ts` | Add `DataInterrogationResponse` type |

---

## Task 1: Database — `abby_analyst` Role & `interrogation` Connection

**Files:**
- Create: `backend/app/Console/Commands/AbbySetupAnalyst.php`
- Modify: `backend/config/database.php`

- [ ] **Step 1: Create the Artisan command**

Create `backend/app/Console/Commands/AbbySetupAnalyst.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AbbySetupAnalyst extends Command
{
    protected $signature = 'abby:setup-analyst';

    protected $description = 'Create the abby_analyst Postgres role and temp_abby schema for data interrogation';

    public function handle(): int
    {
        $password = env('ABBY_ANALYST_PASSWORD');

        if (empty($password)) {
            $this->error('ABBY_ANALYST_PASSWORD environment variable is not set.');

            return self::FAILURE;
        }

        $this->info('Setting up abby_analyst role...');

        $conn = DB::connection('pgsql');

        // Create role if not exists
        $roleExists = $conn->selectOne(
            "SELECT 1 FROM pg_roles WHERE rolname = 'abby_analyst'"
        );

        if (! $roleExists) {
            $conn->statement(
                "CREATE ROLE abby_analyst LOGIN PASSWORD "
                . $conn->getPdo()->quote($password)
            );
            $this->info('Created role abby_analyst.');
        } else {
            // Update password
            $conn->statement(
                "ALTER ROLE abby_analyst PASSWORD "
                . $conn->getPdo()->quote($password)
            );
            $this->info('Role abby_analyst already exists, updated password.');
        }

        // Grant read-only on CDM schemas
        $conn->statement('GRANT USAGE ON SCHEMA omop TO abby_analyst');
        $conn->statement('GRANT SELECT ON ALL TABLES IN SCHEMA omop TO abby_analyst');
        $conn->statement(
            'ALTER DEFAULT PRIVILEGES IN SCHEMA omop GRANT SELECT ON TABLES TO abby_analyst'
        );

        $conn->statement('GRANT USAGE ON SCHEMA results TO abby_analyst');
        $conn->statement('GRANT SELECT ON ALL TABLES IN SCHEMA results TO abby_analyst');
        $conn->statement(
            'ALTER DEFAULT PRIVILEGES IN SCHEMA results GRANT SELECT ON TABLES TO abby_analyst'
        );

        // Create scratch schema
        $schemaExists = $conn->selectOne(
            "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'temp_abby'"
        );

        if (! $schemaExists) {
            $conn->statement('CREATE SCHEMA temp_abby AUTHORIZATION abby_analyst');
            $this->info('Created schema temp_abby.');
        } else {
            $this->info('Schema temp_abby already exists.');
        }

        $conn->statement('GRANT ALL ON SCHEMA temp_abby TO abby_analyst');

        // Set statement timeout
        $conn->statement("ALTER ROLE abby_analyst SET statement_timeout = '30s'");

        $this->info('abby_analyst setup complete.');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Add the `interrogation` connection to `config/database.php`**

Add after the `inpatient` connection block (after approximately line 190):

```php
        // Data interrogation — read-only CDM access for Abby AI analytics.
        // Uses dedicated abby_analyst role with SELECT-only on omop/results
        // and full access to temp_abby scratch schema.
        'interrogation' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'parthenon'),
            'username' => env('ABBY_ANALYST_USERNAME', 'abby_analyst'),
            'password' => env('ABBY_ANALYST_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'omop,results,temp_abby',
            'sslmode' => 'prefer',
        ],
```

- [ ] **Step 3: Add env vars to `backend/.env`**

Append:

```
ABBY_ANALYST_USERNAME=abby_analyst
ABBY_ANALYST_PASSWORD=abby_analyst_parthenon
```

- [ ] **Step 4: Run the setup command and verify**

```bash
docker compose exec -T php php artisan abby:setup-analyst
```

Expected output:
```
Setting up abby_analyst role...
Created role abby_analyst.
Created schema temp_abby.
abby_analyst setup complete.
```

Verify read-only access:

```bash
docker compose exec -T php php artisan tinker --execute="
\$db = \Illuminate\Support\Facades\DB::connection('interrogation');
echo 'SELECT works: ' . \$db->selectOne('SELECT count(*) as n FROM person')->n . PHP_EOL;
try { \$db->statement('DELETE FROM person WHERE 1=0'); echo 'DELETE allowed (BAD)'; } catch (\Throwable \$e) { echo 'DELETE blocked (GOOD): ' . substr(\$e->getMessage(), 0, 80) . PHP_EOL; }
"
```

Expected: SELECT returns a count, DELETE throws permission denied.

- [ ] **Step 5: Commit**

```bash
cd backend && vendor/bin/pint
git add backend/app/Console/Commands/AbbySetupAnalyst.php backend/config/database.php
git commit -m "feat(abby): add abby_analyst Postgres role and interrogation DB connection"
```

---

## Task 2: CDM Schema Context Config

**Files:**
- Create: `backend/config/cdm-interrogation-schema.php`

- [ ] **Step 1: Create the curated schema reference**

Create `backend/config/cdm-interrogation-schema.php`:

```php
<?php

/**
 * Curated OMOP CDM v5.4 schema reference for data interrogation prompts.
 *
 * This is a subset of the full CDM schema, optimized for token efficiency.
 * Only includes tables and columns commonly used in analytical queries.
 * The full schema is in config/cdm-schema-v54.php.
 */

return [
    'prompt_header' => <<<'SCHEMA'
You are a clinical data analyst querying an OMOP CDM v5.4 PostgreSQL database.
All clinical tables are in the "omop" schema (default search_path).
The cohort table is in the "results" schema: results.cohort.
A scratch schema "temp_abby" is available for intermediate tables.

KEY CONVENTIONS:
- Every clinical table has a *_concept_id column that references omop.concept
- Always JOIN to omop.concept to get human-readable names
- concept_id = 0 means unmapped/unknown — exclude or label appropriately
- person_id is the universal patient identifier across all tables
- Dates are stored as DATE type (not timestamp)
- Use results.cohort for cohort membership (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
SCHEMA,

    'tables' => [
        'person' => [
            'description' => 'One row per patient. Demographics.',
            'columns' => 'person_id (PK), gender_concept_id (FK concept), year_of_birth, month_of_birth, day_of_birth, birth_datetime, race_concept_id (FK concept), ethnicity_concept_id (FK concept), location_id, care_site_id, person_source_value',
        ],
        'observation_period' => [
            'description' => 'Contiguous time ranges when a person has data. Use to define "at risk" windows.',
            'columns' => 'observation_period_id (PK), person_id (FK person), observation_period_start_date, observation_period_end_date, period_type_concept_id',
        ],
        'visit_occurrence' => [
            'description' => 'Healthcare encounters (inpatient, outpatient, ER, etc.).',
            'columns' => 'visit_occurrence_id (PK), person_id (FK person), visit_concept_id (FK concept), visit_start_date, visit_end_date, visit_type_concept_id, visit_source_value',
        ],
        'condition_occurrence' => [
            'description' => 'Diagnoses and conditions recorded for a patient.',
            'columns' => 'condition_occurrence_id (PK), person_id (FK person), condition_concept_id (FK concept), condition_start_date, condition_end_date, condition_type_concept_id, condition_source_value, condition_source_concept_id',
        ],
        'drug_exposure' => [
            'description' => 'Medication prescriptions and administrations.',
            'columns' => 'drug_exposure_id (PK), person_id (FK person), drug_concept_id (FK concept), drug_exposure_start_date, drug_exposure_end_date, drug_type_concept_id, quantity, days_supply, sig, drug_source_value, drug_source_concept_id',
        ],
        'procedure_occurrence' => [
            'description' => 'Clinical procedures performed on patients.',
            'columns' => 'procedure_occurrence_id (PK), person_id (FK person), procedure_concept_id (FK concept), procedure_date, procedure_type_concept_id, procedure_source_value, procedure_source_concept_id',
        ],
        'measurement' => [
            'description' => 'Lab results, vital signs, and other quantitative clinical data.',
            'columns' => 'measurement_id (PK), person_id (FK person), measurement_concept_id (FK concept), measurement_date, measurement_type_concept_id, value_as_number, value_as_concept_id, unit_concept_id (FK concept), range_low, range_high, measurement_source_value, measurement_source_concept_id, unit_source_value',
        ],
        'observation' => [
            'description' => 'Clinical observations that don\'t fit other domains (social history, family history, etc.).',
            'columns' => 'observation_id (PK), person_id (FK person), observation_concept_id (FK concept), observation_date, observation_type_concept_id, value_as_number, value_as_string, value_as_concept_id, qualifier_concept_id, unit_concept_id, observation_source_value, observation_source_concept_id',
        ],
        'death' => [
            'description' => 'Patient death records.',
            'columns' => 'person_id (PK, FK person), death_date, death_type_concept_id, cause_concept_id (FK concept), cause_source_value',
        ],
        'concept' => [
            'description' => 'Vocabulary lookup table. JOIN here to get concept_name for any *_concept_id.',
            'columns' => 'concept_id (PK), concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code',
        ],
        'concept_ancestor' => [
            'description' => 'Hierarchical relationships. Use to find descendants of a concept (e.g., all subtypes of diabetes).',
            'columns' => 'ancestor_concept_id (FK concept), descendant_concept_id (FK concept), min_levels_of_separation, max_levels_of_separation',
        ],
        'concept_relationship' => [
            'description' => 'Pairwise concept relationships (Maps to, Is a, etc.).',
            'columns' => 'concept_id_1, concept_id_2, relationship_id',
        ],
        'results.cohort' => [
            'description' => 'Cohort membership table. One row per person-period in a cohort.',
            'columns' => 'cohort_definition_id, subject_id (= person_id), cohort_start_date, cohort_end_date',
        ],
    ],

    'common_joins' => <<<'JOINS'
COMMON JOIN PATTERNS:
- Get condition name: JOIN omop.concept c ON c.concept_id = co.condition_concept_id
- Get drug name: JOIN omop.concept c ON c.concept_id = de.drug_concept_id
- Get measurement name + unit: JOIN omop.concept mc ON mc.concept_id = m.measurement_concept_id LEFT JOIN omop.concept uc ON uc.concept_id = m.unit_concept_id
- Get gender label: JOIN omop.concept gc ON gc.concept_id = p.gender_concept_id
- Get race label: JOIN omop.concept rc ON rc.concept_id = p.race_concept_id
- Find all descendants: JOIN omop.concept_ancestor ca ON ca.ancestor_concept_id = <parent_id> AND ca.descendant_concept_id = <table>.concept_id
- Age calculation: EXTRACT(YEAR FROM <reference_date>) - p.year_of_birth
JOINS,
];
```

- [ ] **Step 2: Commit**

```bash
cd backend && vendor/bin/pint
git add backend/config/cdm-interrogation-schema.php
git commit -m "feat(abby): add curated OMOP CDM schema context for data interrogation prompts"
```

---

## Task 3: AnalyticsLlmService — Multi-Provider LLM Client

**Files:**
- Create: `backend/app/Services/AI/AnalyticsLlmService.php`
- Create: `backend/app/Exceptions/AiProviderNotConfiguredException.php`
- Create: `backend/app/Exceptions/AiProviderRequestException.php`

- [ ] **Step 1: Create the exception classes**

Create `backend/app/Exceptions/AiProviderNotConfiguredException.php`:

```php
<?php

namespace App\Exceptions;

use RuntimeException;

class AiProviderNotConfiguredException extends RuntimeException
{
    public function __construct(string $message = 'No AI provider is active or configured. Set an API key and activate a provider in System Health > AI Providers.')
    {
        parent::__construct($message);
    }
}
```

Create `backend/app/Exceptions/AiProviderRequestException.php`:

```php
<?php

namespace App\Exceptions;

use RuntimeException;

class AiProviderRequestException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $provider = '',
        public readonly int $httpStatus = 0,
    ) {
        parent::__construct($message);
    }
}
```

- [ ] **Step 2: Create the AnalyticsLlmService**

Create `backend/app/Services/AI/AnalyticsLlmService.php`:

```php
<?php

namespace App\Services\AI;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Exceptions\AiProviderRequestException;
use App\Models\App\AiProviderSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyticsLlmService
{
    /**
     * Send a chat completion request to the active AI provider.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     *
     * @throws AiProviderNotConfiguredException
     * @throws AiProviderRequestException
     */
    public function chat(array $messages, array $options = []): string
    {
        $provider = AiProviderSetting::where('is_active', true)->first();

        if (! $provider || ! $provider->is_enabled) {
            throw new AiProviderNotConfiguredException;
        }

        $settings = $provider->settings ?? [];
        $apiKey = $settings['api_key'] ?? '';
        $baseUrl = $settings['base_url'] ?? '';
        $model = $provider->model;

        if ($provider->provider_type !== 'ollama' && empty($apiKey)) {
            throw new AiProviderNotConfiguredException(
                "API key not configured for {$provider->display_name}. Add it in System Health > AI Providers."
            );
        }

        return match ($provider->provider_type) {
            'anthropic' => $this->callAnthropic($apiKey, $model, $messages, $options),
            'openai', 'deepseek', 'moonshot', 'mistral' => $this->callOpenAiCompatible(
                $provider->provider_type, $apiKey, $model, $messages, $options, $baseUrl,
            ),
            'gemini' => $this->callGemini($apiKey, $model, $messages, $options),
            'qwen' => $this->callOpenAiCompatible(
                'qwen', $apiKey, $model, $messages, $options, 'https://dashscope.aliyuncs.com/compatible-mode',
            ),
            'ollama' => $this->callOllama($baseUrl ?: 'http://host.docker.internal:11434', $model, $messages, $options),
            default => throw new AiProviderRequestException("Unsupported provider: {$provider->provider_type}", $provider->provider_type),
        };
    }

    private function callAnthropic(string $apiKey, string $model, array $messages, array $options): string
    {
        $system = $options['system'] ?? null;

        $body = [
            'model' => $model,
            'max_tokens' => $options['max_tokens'] ?? 4096,
            'messages' => $messages,
        ];

        if ($system) {
            $body['system'] = $system;
        }

        if (isset($options['temperature'])) {
            $body['temperature'] = $options['temperature'];
        }

        $response = Http::timeout(120)
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', $body);

        if (! $response->successful()) {
            Log::warning('Anthropic API error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new AiProviderRequestException(
                "Anthropic API returned HTTP {$response->status()}: " . ($response->json('error.message') ?? $response->body()),
                'anthropic',
                $response->status(),
            );
        }

        $content = $response->json('content', []);

        return collect($content)
            ->where('type', 'text')
            ->pluck('text')
            ->implode('');
    }

    private function callOpenAiCompatible(string $providerType, string $apiKey, string $model, array $messages, array $options, string $baseUrl = ''): string
    {
        $url = match ($providerType) {
            'openai' => 'https://api.openai.com/v1/chat/completions',
            'deepseek' => 'https://api.deepseek.com/v1/chat/completions',
            'moonshot' => 'https://api.moonshot.cn/v1/chat/completions',
            'mistral' => 'https://api.mistral.ai/v1/chat/completions',
            default => rtrim($baseUrl, '/') . '/v1/chat/completions',
        };

        $allMessages = $messages;
        if (! empty($options['system'])) {
            array_unshift($allMessages, ['role' => 'system', 'content' => $options['system']]);
        }

        $body = [
            'model' => $model,
            'messages' => $allMessages,
            'max_tokens' => $options['max_tokens'] ?? 4096,
        ];

        if (isset($options['temperature'])) {
            $body['temperature'] = $options['temperature'];
        }

        $response = Http::timeout(120)
            ->withToken($apiKey)
            ->post($url, $body);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "{$providerType} API returned HTTP {$response->status()}: " . ($response->json('error.message') ?? $response->body()),
                $providerType,
                $response->status(),
            );
        }

        return $response->json('choices.0.message.content', '');
    }

    private function callGemini(string $apiKey, string $model, array $messages, array $options): string
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

        $contents = [];
        foreach ($messages as $msg) {
            $contents[] = [
                'role' => $msg['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $body = ['contents' => $contents];

        if (! empty($options['system'])) {
            $body['systemInstruction'] = [
                'parts' => [['text' => $options['system']]],
            ];
        }

        if (isset($options['temperature'])) {
            $body['generationConfig']['temperature'] = $options['temperature'];
        }

        if (isset($options['max_tokens'])) {
            $body['generationConfig']['maxOutputTokens'] = $options['max_tokens'];
        }

        $response = Http::timeout(120)
            ->post($url, $body);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "Gemini API returned HTTP {$response->status()}: " . $response->body(),
                'gemini',
                $response->status(),
            );
        }

        return $response->json('candidates.0.content.parts.0.text', '');
    }

    private function callOllama(string $baseUrl, string $model, array $messages, array $options): string
    {
        $allMessages = $messages;
        if (! empty($options['system'])) {
            array_unshift($allMessages, ['role' => 'system', 'content' => $options['system']]);
        }

        $response = Http::timeout(120)
            ->post(rtrim($baseUrl, '/') . '/api/chat', [
                'model' => $model,
                'messages' => $allMessages,
                'stream' => false,
            ]);

        if (! $response->successful()) {
            throw new AiProviderRequestException(
                "Ollama returned HTTP {$response->status()}: " . $response->body(),
                'ollama',
                $response->status(),
            );
        }

        return $response->json('message.content', '');
    }
}
```

- [ ] **Step 3: Run Pint and PHPStan**

```bash
cd backend && vendor/bin/pint && vendor/bin/phpstan analyse app/Services/AI/AnalyticsLlmService.php app/Exceptions/AiProviderNotConfiguredException.php app/Exceptions/AiProviderRequestException.php
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd backend && vendor/bin/pint
git add backend/app/Services/AI/AnalyticsLlmService.php backend/app/Exceptions/AiProviderNotConfiguredException.php backend/app/Exceptions/AiProviderRequestException.php
git commit -m "feat(abby): add AnalyticsLlmService multi-provider LLM client"
```

---

## Task 4: DataInterrogationService — Agent Loop

**Files:**
- Create: `backend/app/Services/AI/DataInterrogationService.php`

- [ ] **Step 1: Create the DataInterrogationService**

Create `backend/app/Services/AI/DataInterrogationService.php`:

```php
<?php

namespace App\Services\AI;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Exceptions\AiProviderRequestException;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DataInterrogationService
{
    private const MAX_ITERATIONS = 5;

    private const MAX_ROWS = 10_000;

    /** Patterns that are NOT allowed on non-temp schemas. */
    private const FORBIDDEN_PATTERNS = [
        '/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|ALTER|TRUNCATE|CREATE\s+TABLE|CREATE\s+INDEX)\b(?!.*temp_abby)/i',
        '/\bpg_/i',
    ];

    public function __construct(
        private readonly AnalyticsLlmService $llm,
    ) {}

    /**
     * @return array{answer: string, tables: array<int, array<string, mixed>>, queries: array<int, string>, iterations: int}
     */
    public function ask(string $question, Source $source, ?User $user = null): array
    {
        $schemaConfig = config('cdm-interrogation-schema');
        $systemPrompt = $this->buildSystemPrompt($schemaConfig);

        $messages = [
            ['role' => 'user', 'content' => $question],
        ];

        $executedQueries = [];
        $lastResults = [];
        $iterations = 0;

        while ($iterations < self::MAX_ITERATIONS) {
            $iterations++;

            $response = $this->llm->chat($messages, [
                'system' => $systemPrompt,
                'max_tokens' => 4096,
                'temperature' => 0.1,
            ]);

            $messages[] = ['role' => 'assistant', 'content' => $response];

            // Extract SQL from response
            $sql = $this->extractSql($response);

            if ($sql === null) {
                // No SQL found — this is the final answer
                return [
                    'answer' => $response,
                    'tables' => $lastResults,
                    'queries' => $executedQueries,
                    'iterations' => $iterations,
                ];
            }

            // Validate SQL safety
            $violation = $this->checkSqlSafety($sql);
            if ($violation !== null) {
                Log::warning('Data interrogation SQL safety violation', [
                    'sql' => $sql,
                    'violation' => $violation,
                    'user_id' => $user?->id,
                ]);

                $messages[] = [
                    'role' => 'user',
                    'content' => "SQL REJECTED: {$violation}. Rewrite the query using only SELECT statements on the omop and results schemas. You may use temp_abby schema for intermediate tables.",
                ];

                continue;
            }

            // Execute SQL
            $executedQueries[] = $sql;
            $queryResult = $this->executeSql($sql);

            if ($queryResult['error'] !== null) {
                $messages[] = [
                    'role' => 'user',
                    'content' => "SQL ERROR: {$queryResult['error']}\n\nPlease fix the query and try again.",
                ];

                continue;
            }

            $lastResults = $queryResult['rows'];
            $rowCount = count($queryResult['rows']);

            // Format results for the LLM
            $resultText = $this->formatResultsForLlm($queryResult['rows'], $queryResult['columns']);

            $messages[] = [
                'role' => 'user',
                'content' => "Query returned {$rowCount} rows:\n\n{$resultText}\n\nIf you need more data, write another SQL query. Otherwise, provide a clear natural language answer to the original question, using markdown tables for tabular data.",
            ];
        }

        // Max iterations reached — force final answer
        $response = $this->llm->chat(
            array_merge($messages, [
                ['role' => 'user', 'content' => 'You have reached the maximum number of queries. Provide your best answer using the data collected so far.'],
            ]),
            [
                'system' => $systemPrompt,
                'max_tokens' => 4096,
                'temperature' => 0.1,
            ],
        );

        return [
            'answer' => $response,
            'tables' => $lastResults,
            'queries' => $executedQueries,
            'iterations' => $iterations,
        ];
    }

    /**
     * @param  array<string, mixed>  $schemaConfig
     */
    private function buildSystemPrompt(array $schemaConfig): string
    {
        $header = $schemaConfig['prompt_header'];
        $joins = $schemaConfig['common_joins'];

        $tableLines = [];
        foreach ($schemaConfig['tables'] as $name => $info) {
            $tableLines[] = "TABLE {$name}: {$info['description']}\n  Columns: {$info['columns']}";
        }
        $tableBlock = implode("\n\n", $tableLines);

        return <<<PROMPT
{$header}

SCHEMA REFERENCE:

{$tableBlock}

{$joins}

RESPONSE FORMAT:
- When you need data, return a single SQL query in a ```sql fenced block
- After receiving results, either write another query or provide your final answer
- Final answers should be clear natural language with markdown tables for tabular data
- State any assumptions you make about the data
- Do NOT include multiple SQL statements separated by semicolons — one query per response
PROMPT;
    }

    private function extractSql(?string $response): ?string
    {
        if ($response === null) {
            return null;
        }

        // Match ```sql ... ``` blocks
        if (preg_match('/```sql\s*\n(.*?)\n```/s', $response, $matches)) {
            return trim($matches[1]);
        }

        // Match ``` ... ``` blocks that look like SQL
        if (preg_match('/```\s*\n((?:SELECT|WITH|CREATE\s+TEMP).*?)\n```/si', $response, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }

    private function checkSqlSafety(string $sql): ?string
    {
        // Check for multi-statement
        $stripped = preg_replace("/'[^']*'/", '', $sql) ?? $sql;
        if (substr_count($stripped, ';') > 1) {
            return 'Multiple statements are not allowed. Send one query at a time.';
        }

        // Check for forbidden patterns (excluding temp_abby operations)
        foreach (self::FORBIDDEN_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql)) {
                // Allow CREATE/INSERT/DROP on temp_abby schema
                if (preg_match('/temp_abby/i', $sql)) {
                    continue;
                }

                return 'Only SELECT queries are allowed on omop and results schemas. Use temp_abby for intermediate tables.';
            }
        }

        return null;
    }

    /**
     * @return array{rows: array<int, array<string, mixed>>, columns: list<string>, error: ?string}
     */
    private function executeSql(string $sql): array
    {
        try {
            $results = DB::connection('interrogation')
                ->select(DB::raw($sql));

            $rows = array_map(fn ($row) => (array) $row, $results);

            // Cap rows
            if (count($rows) > self::MAX_ROWS) {
                $rows = array_slice($rows, 0, self::MAX_ROWS);
            }

            $columns = ! empty($rows) ? array_keys($rows[0]) : [];

            return ['rows' => $rows, 'columns' => $columns, 'error' => null];
        } catch (\Throwable $e) {
            return ['rows' => [], 'columns' => [], 'error' => $e->getMessage()];
        }
    }

    /**
     * Format query results as a text table for the LLM context.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  list<string>  $columns
     */
    private function formatResultsForLlm(array $rows, array $columns): string
    {
        if (empty($rows)) {
            return '(no rows returned)';
        }

        // For large result sets, truncate for LLM context
        $displayRows = array_slice($rows, 0, 100);
        $truncated = count($rows) > 100;

        // Build markdown table
        $header = '| ' . implode(' | ', $columns) . ' |';
        $separator = '| ' . implode(' | ', array_fill(0, count($columns), '---')) . ' |';

        $dataLines = array_map(function ($row) use ($columns) {
            $values = array_map(function ($col) use ($row) {
                $val = $row[$col] ?? '';

                return mb_substr((string) $val, 0, 50);
            }, $columns);

            return '| ' . implode(' | ', $values) . ' |';
        }, $displayRows);

        $table = implode("\n", [$header, $separator, ...$dataLines]);

        if ($truncated) {
            $table .= "\n\n(Showing first 100 of " . count($rows) . ' rows)';
        }

        return $table;
    }
}
```

- [ ] **Step 2: Run Pint and PHPStan**

```bash
cd backend && vendor/bin/pint && vendor/bin/phpstan analyse app/Services/AI/DataInterrogationService.php
```

- [ ] **Step 3: Commit**

```bash
cd backend && vendor/bin/pint
git add backend/app/Services/AI/DataInterrogationService.php
git commit -m "feat(abby): add DataInterrogationService with multi-step agent loop"
```

---

## Task 5: API Endpoint — Controller & Route

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/DataInterrogationController.php`
- Create: `backend/app/Http/Requests/Api/DataInterrogationRequest.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create the Form Request**

Create `backend/app/Http/Requests/Api/DataInterrogationRequest.php`:

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class DataInterrogationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'question' => ['required', 'string', 'max:2000'],
            'source_id' => ['required', 'integer', 'exists:app.sources,id'],
        ];
    }
}
```

- [ ] **Step 2: Create the Controller**

Create `backend/app/Http/Controllers/Api/V1/DataInterrogationController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Exceptions\AiProviderRequestException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DataInterrogationRequest;
use App\Models\App\Source;
use App\Services\AI\DataInterrogationService;
use Illuminate\Http\JsonResponse;

class DataInterrogationController extends Controller
{
    public function __construct(
        private readonly DataInterrogationService $interrogationService,
    ) {}

    public function ask(DataInterrogationRequest $request): JsonResponse
    {
        $source = Source::findOrFail($request->validated('source_id'));

        try {
            $result = $this->interrogationService->ask(
                question: $request->validated('question'),
                source: $source,
                user: $request->user(),
            );

            return response()->json($result);
        } catch (AiProviderNotConfiguredException $e) {
            return response()->json([
                'answer' => '',
                'error' => $e->getMessage(),
                'tables' => [],
                'queries' => [],
                'iterations' => 0,
            ], 422);
        } catch (AiProviderRequestException $e) {
            return response()->json([
                'answer' => '',
                'error' => "AI provider error: {$e->getMessage()}",
                'tables' => [],
                'queries' => [],
                'iterations' => 0,
            ], 502);
        }
    }
}
```

- [ ] **Step 3: Add the route**

In `backend/routes/api.php`, find the Abby AI routes block (around line 690) and add after the closing `});` of the `Route::prefix('abby')` group:

```php
        // Data Interrogation (Abby Analytics)
        Route::post('data-interrogation/ask', [DataInterrogationController::class, 'ask'])
            ->middleware('permission:analyses.view');
```

Add the import at the top of the file:

```php
use App\Http\Controllers\Api\V1\DataInterrogationController;
```

- [ ] **Step 4: Run Pint and verify route registration**

```bash
cd backend && vendor/bin/pint
docker compose exec -T php php artisan route:list --path=data-interrogation
```

Expected output shows the `POST data-interrogation/ask` route with `auth:sanctum` and `permission:analyses.view` middleware.

- [ ] **Step 5: Commit**

```bash
cd backend && vendor/bin/pint
git add backend/app/Http/Controllers/Api/V1/DataInterrogationController.php backend/app/Http/Requests/Api/DataInterrogationRequest.php backend/routes/api.php
git commit -m "feat(abby): add /data-interrogation/ask API endpoint"
```

---

## Task 6: Frontend — Types & API Client

**Files:**
- Modify: `frontend/src/features/commons/types/abby.ts`
- Create: `frontend/src/features/commons/services/dataInterrogationService.ts`

- [ ] **Step 1: Add the DataInterrogationResponse type**

In `frontend/src/features/commons/types/abby.ts`, add at the end of the file:

```typescript
// Data Interrogation (Abby Analytics)
export interface DataInterrogationRequest {
  question: string;
  source_id: number;
}

export interface DataInterrogationResponse {
  answer: string;
  tables: Record<string, unknown>[];
  queries: string[];
  iterations: number;
  error?: string;
}
```

- [ ] **Step 2: Create the API client**

Create `frontend/src/features/commons/services/dataInterrogationService.ts`:

```typescript
import api from '@/lib/api';
import type {
  DataInterrogationRequest,
  DataInterrogationResponse,
} from '../types/abby';

export async function askDataQuestion(
  request: DataInterrogationRequest,
): Promise<DataInterrogationResponse> {
  const { data } = await api.post<DataInterrogationResponse>(
    '/data-interrogation/ask',
    request,
    { timeout: 120_000 },
  );
  return data;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/types/abby.ts frontend/src/features/commons/services/dataInterrogationService.ts
git commit -m "feat(abby): add data interrogation types and API client"
```

---

## Task 7: Frontend — DataInterrogationResult Component

**Files:**
- Create: `frontend/src/features/commons/components/abby/DataInterrogationResult.tsx`

- [ ] **Step 1: Create the result renderer**

Create `frontend/src/features/commons/components/abby/DataInterrogationResult.tsx`:

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DataInterrogationResponse } from '../../types/abby';

interface DataInterrogationResultProps {
  result: DataInterrogationResponse;
}

export function DataInterrogationResult({
  result,
}: DataInterrogationResultProps) {
  const [showSql, setShowSql] = useState(false);

  if (result.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-sm text-red-400">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Answer */}
      <div className="prose prose-invert prose-sm max-w-none [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_th]:border [&_th]:border-white/10 [&_td]:border [&_td]:border-white/10 [&_th]:bg-white/5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {result.answer}
        </ReactMarkdown>
      </div>

      {/* SQL queries (collapsible) */}
      {result.queries.length > 0 && (
        <div>
          <button
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <span
              className={`transition-transform ${showSql ? 'rotate-90' : ''}`}
            >
              ▶
            </span>
            {result.queries.length} {result.queries.length === 1 ? 'query' : 'queries'} executed
            {result.iterations > 1 && ` (${result.iterations} steps)`}
          </button>

          {showSql && (
            <div className="mt-2 space-y-2">
              {result.queries.map((sql, i) => (
                <pre
                  key={i}
                  className="rounded bg-black/40 p-3 text-xs text-teal-400/80 overflow-x-auto border border-white/5"
                >
                  <code>{sql}</code>
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/components/abby/DataInterrogationResult.tsx
git commit -m "feat(abby): add DataInterrogationResult chat message component"
```

---

## Task 8: Frontend — Wire Into Abby Chat Panel

**Files:**
- Modify: `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx`

- [ ] **Step 1: Read the current AskAbbyChannel to understand the structure**

```bash
cat frontend/src/features/commons/components/abby/AskAbbyChannel.tsx
```

Understand the existing `ConversationEntry` type, how messages are appended, and where the send handler lives.

- [ ] **Step 2: Add data interrogation integration**

In `AskAbbyChannel.tsx`, make these changes:

**Add imports** at the top:

```typescript
import { askDataQuestion } from '../../services/dataInterrogationService';
import { DataInterrogationResult } from './DataInterrogationResult';
import type { DataInterrogationResponse } from '../../types/abby';
```

**Extend the ConversationEntry type** to include data interrogation results:

```typescript
interface ConversationEntry {
  id: string;
  role: 'user' | 'abby';
  content: string;
  timestamp: string;
  userName?: string;
  response?: AbbyQueryResponse;
  dataResult?: DataInterrogationResponse;  // Add this field
}
```

**In the send handler** (find the function that processes user messages — typically called `handleSend` or similar), add detection for `/data` prefix before the existing Abby query call:

```typescript
// At the start of the send handler, after adding the user message to conversation:
const isDataQuery = trimmedMessage.startsWith('/data ');

if (isDataQuery) {
  const question = trimmedMessage.slice(6).trim(); // Remove "/data " prefix
  // TODO: get active source_id from user context or default
  const sourceId = 1; // Will be replaced with actual source selection
  try {
    const result = await askDataQuestion({ question, source_id: sourceId });
    // Add Abby response with dataResult
    setConversation(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'abby',
      content: result.answer,
      timestamp: new Date().toISOString(),
      dataResult: result,
    }]);
  } catch (err) {
    setConversation(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'abby',
      content: 'Sorry, I encountered an error analyzing your data question.',
      timestamp: new Date().toISOString(),
      dataResult: { answer: '', tables: [], queries: [], iterations: 0, error: String(err) },
    }]);
  }
  return; // Skip normal Abby flow
}
```

**In the message rendering** (find where Abby response bubbles are rendered), add DataInterrogationResult rendering:

```tsx
{/* Inside the Abby message bubble, after existing content rendering */}
{entry.dataResult && (
  <DataInterrogationResult result={entry.dataResult} />
)}
```

- [ ] **Step 3: Verify TypeScript compiles and build succeeds**

```bash
cd frontend && npx tsc --noEmit && npx vite build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/abby/AskAbbyChannel.tsx
git commit -m "feat(abby): wire data interrogation into Abby chat with /data prefix"
```

---

## Task 9: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Ensure Anthropic API key is configured**

```bash
docker compose exec -T php php artisan tinker --execute="
use App\Models\App\AiProviderSetting;
\$p = AiProviderSetting::where('provider_type', 'anthropic')->first();
echo 'Anthropic enabled: ' . (\$p->is_enabled ? 'yes' : 'no') . PHP_EOL;
echo 'Anthropic active: ' . (\$p->is_active ? 'yes' : 'no') . PHP_EOL;
echo 'Has API key: ' . (! empty(\$p->settings['api_key'] ?? '') ? 'yes' : 'no') . PHP_EOL;
echo 'Model: ' . \$p->model . PHP_EOL;
"
```

If not configured, set it via the AI Providers panel in System Health or via tinker:

```bash
docker compose exec -T php php artisan tinker --execute="
use App\Models\App\AiProviderSetting;
AiProviderSetting::query()->update(['is_active' => false]);
\$p = AiProviderSetting::where('provider_type', 'anthropic')->first();
\$p->update([
    'is_enabled' => true,
    'is_active' => true,
    'model' => 'claude-sonnet-4-20250514',
    'settings' => array_merge(\$p->settings ?? [], ['api_key' => env('ANTHROPIC_API_KEY', '')]),
]);
echo 'Anthropic activated with model: ' . \$p->fresh()->model . PHP_EOL;
"
```

- [ ] **Step 2: Test the AnalyticsLlmService directly**

```bash
docker compose exec -T php php artisan tinker --execute="
\$llm = app(\App\Services\AI\AnalyticsLlmService::class);
\$result = \$llm->chat(
    [['role' => 'user', 'content' => 'What is 2 + 2? Reply with just the number.']],
    ['max_tokens' => 10]
);
echo 'LLM response: ' . \$result . PHP_EOL;
"
```

Expected: `4` (or similar short response).

- [ ] **Step 3: Test the full data interrogation pipeline**

```bash
docker compose exec -T php php artisan tinker --execute="
use App\Models\App\Source;
use App\Services\AI\DataInterrogationService;

\$service = app(DataInterrogationService::class);
\$source = Source::first();
\$result = \$service->ask('How many patients are in the database and what is the gender distribution?', \$source);

echo 'Answer: ' . substr(\$result['answer'], 0, 500) . PHP_EOL;
echo 'Queries: ' . count(\$result['queries']) . PHP_EOL;
echo 'Iterations: ' . \$result['iterations'] . PHP_EOL;
foreach (\$result['queries'] as \$i => \$sql) {
    echo 'SQL ' . (\$i+1) . ': ' . substr(\$sql, 0, 120) . PHP_EOL;
}
"
```

Expected: A natural language answer with patient count and gender breakdown, backed by 1-2 SQL queries.

- [ ] **Step 4: Test the API endpoint via curl**

```bash
# Get a valid auth token first
TOKEN=$(docker compose exec -T php php artisan tinker --execute="
\$user = \App\Models\User::where('email', 'admin@acumenus.net')->first();
echo \$user->createToken('test')->plainTextToken;
")

curl -s -X POST http://localhost:8082/api/v1/data-interrogation/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "How many distinct conditions are recorded?", "source_id": 1}' | python3 -m json.tool
```

Expected: JSON with `answer`, `queries`, `tables`, `iterations` fields.

- [ ] **Step 5: Run all checks**

```bash
cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse
cd frontend && npx tsc --noEmit && npx vite build
```

- [ ] **Step 6: Final commit and deploy**

```bash
./deploy.sh --frontend --php
```
