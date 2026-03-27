# AI Data Interrogation & Provider Routing — Design Spec

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Wire up AI config panel, add data interrogation via multi-step agent loop

## Problem

1. The AI Configuration Panel (System Health > AI Providers) stores provider
   settings but nothing reads them — all AI calls are hardcoded to Ollama/MedGemma.
2. Abby can do basic chat and cohort parsing but cannot interrogate the CDM
   database to answer data questions.

## Architecture: Dual-LLM Design

- **Ollama/MedGemma (Abby)** — conversational layer with institutional memory,
  RAG, cohort parsing. Handled by the Python AI service. **Unchanged.**
- **Active Analytics Provider (Claude, GPT, Gemini, etc.)** — the analytical
  engine for data interrogation, result interpretation, and deep reasoning.
  Handled by a new PHP service that reads the active provider from the config panel.

The two systems are independent. Abby stays as-is for conversation. The analytics
provider handles computation. Users switch the analytics provider in the existing
AI Providers panel under System Health.

## Section 1: Provider Routing — AnalyticsLlmService

### Purpose
A PHP service that reads the active AI provider from `ai_provider_settings` and
exposes a single `chat()` method. Any feature needing heavy-lift LLM capabilities
(data interrogation, Publish page, etc.) calls this service.

### Interface

```php
class AnalyticsLlmService
{
    /**
     * Send a chat completion request to the active AI provider.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array{system?: string, max_tokens?: int, temperature?: float}  $options
     * @return string  The assistant's response text
     *
     * @throws AiProviderNotConfiguredException
     * @throws AiProviderRequestException
     */
    public function chat(array $messages, array $options = []): string;
}
```

### Provider Mapping

| Provider | API Format | Auth | Endpoint |
|----------|-----------|------|----------|
| `anthropic` | Messages API | `x-api-key` header | `https://api.anthropic.com/v1/messages` |
| `openai` | Chat Completions | Bearer token | `https://api.openai.com/v1/chat/completions` |
| `deepseek` | OpenAI-compatible | Bearer token | `https://api.deepseek.com/v1/chat/completions` |
| `moonshot` | OpenAI-compatible | Bearer token | `https://api.moonshot.cn/v1/chat/completions` |
| `mistral` | OpenAI-compatible | Bearer token | `https://api.mistral.ai/v1/chat/completions` |
| `gemini` | GenerateContent | API key param | Google AI Studio endpoint |
| `qwen` | DashScope-compatible | Bearer token | DashScope endpoint |
| `ollama` | Ollama chat | None | Configurable base_url |

### Behavior

- Reads `AiProviderSetting::where('is_active', true)->first()` on every call
  (no caching — provider changes take effect immediately)
- Extracts `provider_type`, `model`, and `settings` (api_key, base_url)
- Throws `AiProviderNotConfiguredException` if no provider is active or API key
  is missing
- Throws `AiProviderRequestException` on HTTP errors or malformed responses
- No streaming, no tool use, no conversation memory — request-in, text-out

### Switching Providers

Users switch the analytics provider in System Health > AI Providers:
1. Enter API key for the desired provider
2. Select the model
3. Click "Test Connection" to verify
4. Click "Set as Active"

No code changes needed to switch between providers.

## Section 2: Data Interrogation Service

### Purpose
Takes a natural language question, uses the active analytics LLM to generate SQL,
executes it against the CDM, and returns a natural language answer grounded in
real patient data.

### Interface

```php
class DataInterrogationService
{
    /**
     * @return DataInterrogationResult{
     *   answer: string,
     *   tables: array<int, array<string, mixed>>,
     *   queries: array<int, string>,
     *   iterations: int
     * }
     */
    public function ask(
        string $question,
        Source $source,
        ?User $user = null,
    ): DataInterrogationResult;
}
```

### Agent Loop (up to 5 iterations)

1. User question + CDM schema context → LLM generates SQL
2. PHP validates SQL (safety checks) and executes it
3. Results (or error message) sent back to LLM
4. LLM either: (a) generates follow-up SQL, or (b) returns final answer
5. After 5 iterations, force a final answer with whatever data is available

### SQL Safety Guardrails

- Executed via dedicated `interrogation` DB connection with `abby_analyst` role
- SQL scanned before execution:
  - Reject `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE` on non-temp schemas
  - Reject `pg_` catalog access
  - Reject `;` multi-statement (single query per execution)
- Statement timeout: 30 seconds per query
- Results capped at 10,000 rows per query
- Scratch schema `temp_abby` available for intermediate tables

### Error Handling

- SQL syntax errors → sent back to LLM as error context for self-correction
- Timeout → LLM informed, can try a simpler query
- Safety violation → query rejected, LLM told which rule was violated
- Provider API error → returned to user as a clear error message

## Section 3: Schema Context & Prompt Engineering

### Static Schema Config

File: `backend/config/cdm-interrogation-schema.php`

Contains OMOP v5.4 tables relevant for analysis:
- `person`, `observation_period`, `condition_occurrence`, `drug_exposure`,
  `procedure_occurrence`, `measurement`, `observation`, `visit_occurrence`,
  `death`
- Vocabulary tables: `concept`, `concept_relationship`, `concept_ancestor`
- Results: `results.cohort`
- Scratch: `temp_abby.*`

For each table: column names, types, one-line clinical description.
Key relationships called out explicitly (e.g., join patterns to resolve concept names).

Approximate token cost: ~2K tokens per request.

### System Prompt Structure

```
You are a clinical data analyst querying an OMOP CDM v5.4 PostgreSQL database.

[Schema reference]

Rules:
- Write PostgreSQL-compatible SQL
- Always join to concept table to resolve concept names for display
- concept_id = 0 means unmapped/unknown
- The cohort table is in the results schema
- You can use temp_abby schema for intermediate tables
- Return SQL in a ```sql``` fenced block
- After receiving query results, provide a clear natural language answer
- Format tabular results as markdown tables
- If a question is ambiguous, state your assumptions
```

### Why Static Config

The CDM schema is standardized (OMOP v5.4). Querying `information_schema` on
every call adds latency and tokens for no benefit. The static config is
version-controlled and curated.

## Section 4: API Endpoint & Frontend Integration

### API Endpoint

```
POST /api/v1/data-interrogation/ask
```

- Auth: `auth:sanctum`
- Permission: `analyses.view` (researchers and above)
- Request: `{ "question": string, "source_id": number }`
- Response: `{ "answer": string, "tables": [...], "queries": [...], "iterations": number }`
- Timeout: 120 seconds

### Frontend Integration

Plugs into the existing Abby chat panel:
- When user prefixes message with `/data` or the frontend detects a data question,
  route to `/data-interrogation/ask` instead of the Python Abby service
- New chat message type: `data-interrogation-result`
- Renders `answer` as markdown (supports inline tables)
- Collapsible "View SQL" section showing the queries used
- Loading state: "Analyzing data..." with pulse animation (5-30 second calls)

No changes to existing Abby chat/cohort flow. Regular conversation continues
routing to Python.

## Section 5: Database Setup & Security

### New Postgres Role: `abby_analyst`

```sql
CREATE ROLE abby_analyst LOGIN PASSWORD '<from ABBY_ANALYST_PASSWORD env>';
GRANT USAGE ON SCHEMA omop, results TO abby_analyst;
GRANT SELECT ON ALL TABLES IN SCHEMA omop, results TO abby_analyst;
ALTER DEFAULT PRIVILEGES IN SCHEMA omop, results
    GRANT SELECT ON TABLES TO abby_analyst;
CREATE SCHEMA IF NOT EXISTS temp_abby AUTHORIZATION abby_analyst;
GRANT ALL ON SCHEMA temp_abby TO abby_analyst;
ALTER ROLE abby_analyst SET statement_timeout = '30s';
```

### New Laravel Connection: `interrogation`

In `config/database.php`:
- Same host/port/database as `omop`
- Username: `abby_analyst`
- Password: `ABBY_ANALYST_PASSWORD` env var
- `search_path`: `omop,results,temp_abby`

### Artisan Setup Command

`php artisan abby:setup-analyst` — creates the role and schema if they don't
exist. Idempotent. Added to `deploy.sh` and `install.py`.

### What This Prevents

- Abby cannot read `app.users`, passwords, tokens, or application data
- Abby cannot modify CDM source data
- Abby cannot execute DDL on production schemas
- Runaway queries killed at 30 seconds
- Scratch schema isolated — only `abby_analyst` can read/write it

## Section 6: File Changes

### New Files

| File | Purpose |
|------|---------|
| `backend/app/Services/AI/AnalyticsLlmService.php` | Multi-provider LLM client, reads active provider from DB |
| `backend/app/Services/AI/DataInterrogationService.php` | Agent loop: NL → SQL → execute → interpret |
| `backend/app/Http/Controllers/Api/V1/DataInterrogationController.php` | `ask()` endpoint |
| `backend/app/Http/Requests/DataInterrogationRequest.php` | Form Request validation |
| `backend/app/DTOs/DataInterrogationResult.php` | Result DTO |
| `backend/app/Exceptions/AiProviderNotConfiguredException.php` | Exception |
| `backend/app/Exceptions/AiProviderRequestException.php` | Exception |
| `backend/config/cdm-interrogation-schema.php` | Static OMOP v5.4 schema for prompts |
| `backend/app/Console/Commands/AbbySetupAnalyst.php` | Artisan role/schema setup |
| `frontend/src/features/abby/components/DataInterrogationResult.tsx` | Chat message renderer |

### Modified Files

| File | Change |
|------|--------|
| `backend/config/database.php` | Add `interrogation` connection |
| `backend/routes/api.php` | Add `/data-interrogation/ask` route with permissions |
| `frontend/src/features/abby/` (chat components) | Route `/data` prefix to new endpoint, render result type |

### Not Modified

- Python AI service (`ai/`) — untouched
- Existing Abby chat/cohort flow — untouched
- `AiProviderController` — already works
- Docker configuration — role created via Artisan command
