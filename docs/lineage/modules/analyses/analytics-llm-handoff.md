# Handoff: AnalyticsLlmService & Data Interrogation

**Date:** 2026-03-27
**Status:** Implemented, deployed, awaiting API key activation

## What Was Built

A dual-LLM architecture where Ollama/MedGemma handles conversational Abby (unchanged) and a switchable commercial LLM provider handles heavy-lift analytics.

### AnalyticsLlmService — The Heavy-Lift LLM Client

**File:** `backend/app/Services/AI/AnalyticsLlmService.php`

**What it does:** Reads the active AI provider from the `ai_provider_settings` database table and dispatches chat completion requests to the correct API format. Any feature needing deep reasoning — data interrogation, manuscript generation, result interpretation — calls this service.

**Interface:**

```php
use App\Services\AI\AnalyticsLlmService;

$llm = app(AnalyticsLlmService::class);

$response = $llm->chat(
    messages: [
        ['role' => 'user', 'content' => 'Summarize these study results...'],
    ],
    options: [
        'system' => 'You are a clinical research analyst.',  // optional
        'max_tokens' => 4096,                                 // optional, default 4096
        'temperature' => 0.3,                                 // optional
    ],
);
// $response is a string — the assistant's reply text
```

**Supported providers** (switchable in System Health > AI Providers):

| Provider | API Format | Notes |
|----------|-----------|-------|
| `anthropic` | Messages API | Recommended for analytics |
| `openai` | Chat Completions | GPT-4o, o1, etc. |
| `deepseek` | OpenAI-compatible | DeepSeek R1/V3 |
| `gemini` | GenerateContent | Gemini 2.5 Pro |
| `mistral` | OpenAI-compatible | Mistral Large |
| `moonshot` | OpenAI-compatible | Kimi |
| `qwen` | DashScope-compatible | Qwen Max |
| `ollama` | Ollama chat | Local, weaker |

**How to switch providers:** Go to System Health > AI Providers in the Parthenon UI. Enter the API key, select a model, click "Test Connection," then "Set as Active." The change takes effect immediately — no restart needed.

**Exceptions:**
- `AiProviderNotConfiguredException` — no provider active or API key missing
- `AiProviderRequestException` — HTTP error from the provider API (includes `$provider` and `$httpStatus` properties)

Both are in `App\Exceptions\`.

### DataInterrogationService — NL-to-SQL Agent Loop

**File:** `backend/app/Services/AI/DataInterrogationService.php`

**What it does:** Takes a natural language question, uses the active LLM to generate SQL, executes it against the OMOP CDM via a read-only database connection, and returns a natural language answer grounded in real data.

**Interface:**

```php
use App\Services\AI\DataInterrogationService;
use App\Models\App\Source;

$service = app(DataInterrogationService::class);
$source = Source::findOrFail(57);

$result = $service->ask(
    question: 'What is the median age of patients on 3+ AEDs?',
    source: $source,
    user: $currentUser,  // optional, for audit logging
);

// $result is an array:
// [
//     'answer' => 'The median age of patients on 3+ AEDs is 12.4 years...',
//     'tables' => [['age' => 12.4, 'count' => 738, ...], ...],
//     'queries' => ['SELECT ... FROM ...', 'SELECT ... FROM ...'],
//     'iterations' => 2,
// ]
```

**Agent loop:** Up to 5 iterations. The LLM generates SQL, PHP executes it, results are sent back. The LLM can self-correct SQL errors or request follow-up queries. After getting enough data, it provides a final natural language answer.

**SQL safety:** Queries run via the `interrogation` database connection using the `abby_analyst` Postgres role, which has:
- SELECT-only on `omop.*` and `results.*`
- Full access to `temp_abby.*` scratch schema
- 30-second statement timeout
- No access to `app.*`, `php.*`, or any application tables

**CDM schema context:** The system prompt includes a curated schema reference from `config/cdm-interrogation-schema.php` (~2K tokens) with table descriptions, column lists, and common join patterns.

### API Endpoint

```
POST /api/v1/data-interrogation/ask
Auth: auth:sanctum
Permission: analyses.view (researchers and above)
Body: { "question": string, "source_id": number }
Response: { "answer": string, "tables": [...], "queries": [...], "iterations": number }
Timeout: 120 seconds
```

Error responses include an `error` field instead of `answer`.

### Frontend Integration

In the Abby chat panel, prefix messages with `/data ` to route them to the data interrogation endpoint:

```
/data What is the seizure rate by mutation type?
```

Results render inline with markdown tables and a collapsible "View SQL" section.

## How to Use AnalyticsLlmService in the Publish Page

The Publish page needs deep reasoning for manuscript generation. Here's the pattern:

```php
// In your PublishService or controller:

use App\Services\AI\AnalyticsLlmService;

class PublishService
{
    public function __construct(
        private readonly AnalyticsLlmService $llm,
    ) {}

    public function generateNarrative(Study $study, array $results): string
    {
        $systemPrompt = <<<PROMPT
You are a clinical research writer generating a manuscript section
for an OHDSI observational study. Write in formal academic style.
PROMPT;

        return $this->llm->chat(
            messages: [
                ['role' => 'user', 'content' => $this->buildNarrativePrompt($study, $results)],
            ],
            options: [
                'system' => $systemPrompt,
                'max_tokens' => 8192,
                'temperature' => 0.3,
            ],
        );
    }
}
```

The service is registered in Laravel's container via auto-discovery — just type-hint it in your constructor.

**Key points for the Publish page agent:**
1. `AnalyticsLlmService::chat()` is synchronous and can take up to 120 seconds
2. For long-form generation (full manuscript sections), set `max_tokens` to 8192
3. The `system` prompt is passed separately from messages — use it for role/style instructions
4. The service throws on errors — wrap in try/catch for graceful degradation
5. The service reads the active provider on every call — if the user switches providers mid-session, the next call uses the new one
6. For multi-turn generation (e.g., outline → sections → review), accumulate messages in the array:

```php
$messages = [
    ['role' => 'user', 'content' => 'Generate an outline for the Results section.'],
    ['role' => 'assistant', 'content' => $outlineResponse],
    ['role' => 'user', 'content' => 'Now write section 3.1 based on these results: ...'],
];
$section = $this->llm->chat($messages, ['system' => $systemPrompt]);
```

## Database Setup

The `abby_analyst` role and `temp_abby` schema are created via:

```bash
php artisan abby:setup-analyst
```

This is idempotent. The role's password comes from `ABBY_ANALYST_PASSWORD` in `.env`.

## Activation Checklist

1. Paste Anthropic API key in System Health > AI Providers > Anthropic
2. Select model (e.g., `claude-sonnet-4-20250514`)
3. Click "Test Connection" — should show "Anthropic API key is valid"
4. Click "Set as Active"
5. Test: type `/data How many patients are in the database?` in Abby chat

## Files Reference

| File | Purpose |
|------|---------|
| `backend/app/Services/AI/AnalyticsLlmService.php` | Multi-provider LLM client |
| `backend/app/Services/AI/DataInterrogationService.php` | NL→SQL agent loop |
| `backend/app/Http/Controllers/Api/V1/DataInterrogationController.php` | API endpoint |
| `backend/app/Http/Requests/Api/DataInterrogationRequest.php` | Request validation |
| `backend/app/Exceptions/AiProviderNotConfiguredException.php` | No provider active |
| `backend/app/Exceptions/AiProviderRequestException.php` | Provider API error |
| `backend/app/Console/Commands/AbbySetupAnalyst.php` | DB role setup |
| `backend/config/cdm-interrogation-schema.php` | CDM schema for prompts |
| `backend/config/database.php` | `interrogation` connection |
| `frontend/src/features/commons/components/abby/DataInterrogationResult.tsx` | Result renderer |
| `frontend/src/features/commons/services/dataInterrogationService.ts` | Frontend API client |
| `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx` | Chat integration |
