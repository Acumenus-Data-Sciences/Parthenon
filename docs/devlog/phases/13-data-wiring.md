# Phase 13 — End-to-End Data Wiring: Bug Fixes & Verification

**Date:** 2026-03-03
**Branch:** master

---

## Summary

Systematic audit of all frontend-to-backend API connectivity revealed **11 bugs** across the Parthenon stack — URL mismatches, HTTP method errors, response format issues, wrong database connections, and missing auth headers. Fixed all critical and high-severity bugs across **9 files** with zero new dependencies. The Abby AI assistant, vocabulary search, care gaps, cohort builder, data explorer, and dashboard are now fully wired against real OMOP data (1M patients, 7.2M concepts).

---

## Bug Inventory

### Wave 1: API Connectivity Audit (8 bugs)

| # | Severity | Feature | Issue |
|---|----------|---------|-------|
| 1 | **CRITICAL** | Care Gaps | Frontend `/care-gaps/bundles` vs backend `care-bundles` — ALL calls 404 |
| 2 | HIGH | Vocabulary | Frontend `/vocabulary/vocabularies` vs backend `/vocabulary/vocabularies-list` — dropdown 404 |
| 3 | HIGH | Cohorts | Frontend POSTs to `/cohort-definitions/{id}/sql`, backend only accepts GET — 405 |
| 4 | MEDIUM | Dashboard | `dqdFailures` hardcoded to 0 — missing real data |
| 5 | HIGH | Data Explorer | "Run Achilles" calls `POST /sources/{id}/achilles/run` — route didn't exist |
| 6 | **CRITICAL** | Vocabulary | `searchConcepts()` response format mismatch — backend `{data, count}` vs frontend `{items, total, page, limit}` |
| 7 | HIGH | Vocabulary | `getDomains()`/`getVocabularies()` return `{data, count}` object, frontend expects raw array |
| 8 | LOW | Jobs | `/jobs` endpoint doesn't exist — deferred (P2) |

### Wave 2: Abby AI Deep Debug (3 bugs)

| # | Severity | Feature | Issue |
|---|----------|---------|-------|
| 9 | **CRITICAL** | Abby AI | `AbbyAiService::searchConcepts()` queries wrong DB — `public.concept` (0 rows) instead of `omop.concept` (7.2M rows) |
| 10 | **CRITICAL** | Abby AI Chat | `AiDrawer.tsx` calls wrong URL (`/api/v1/ai/chat` vs `/api/v1/abby/chat`), reads wrong response fields (`response` vs `reply`), and missing auth headers |
| 11 | HIGH | Abby AI Chat | `AiService::abbyChat()` sends `page_data: []` (JSON array) but Python Pydantic expects dict (JSON object `{}`) — causes 422 |

---

## Fixes Applied

### Bug 1: Care Gaps URL prefix mismatch
**File:** `frontend/src/features/care-gaps/api/careGapApi.ts`
- `"/care-gaps/bundles"` → `"/care-bundles"`
- `"/care-gaps/overlap-rules"` → `"/care-bundles/overlap-rules"`
- `"/care-gaps/population-summary"` → `"/care-bundles/population-summary"`

### Bug 2: Vocabulary vocabularies endpoint
**File:** `frontend/src/features/vocabulary/api/vocabularyApi.ts`
- `getVocabularies()` URL changed from `/vocabularies` to `/vocabularies-list`

### Bug 3: Cohort SQL preview HTTP method
**File:** `frontend/src/features/cohort-definitions/api/cohortApi.ts`
- `previewCohortSql()` changed from `apiClient.post(url, payload)` to `apiClient.get(url, { params: payload })`

### Bug 4: Dashboard DQD failures
**File:** `frontend/src/features/dashboard/api/dashboardApi.ts`
- Added `Promise.allSettled()` calls to `GET /sources/{id}/dqd/latest` for each source
- Aggregates `failed` counts, handles 404 gracefully
- `activeJobCount` remains 0 with `// TODO` comment (no backend endpoint)

### Bug 5: "Run Achilles" route missing
**Files:** `backend/routes/api.php`, `backend/app/Http/Controllers/Api/V1/AchillesController.php`
- Added `Route::post('/run', [AchillesController::class, 'run'])` in the achilles prefix group
- Added `run()` method dispatching `RunAchillesJob` (returns 202 Accepted)

### Bug 6: Vocabulary search response format
**File:** `frontend/src/features/vocabulary/api/vocabularyApi.ts`
- `searchConcepts()` now transforms `{data: [...], count}` → `{items: [...], total, page, limit}`

### Bug 7: Vocabulary domains/vocabularies response wrapping
**File:** `frontend/src/features/vocabulary/api/vocabularyApi.ts`
- Added `data.data ?? data` unwrapping in `getDomains()` and `getVocabularies()`

### Bug 9 (CRITICAL): AbbyAiService wrong DB connection
**File:** `backend/app/Services/AI/AbbyAiService.php` (line 315)

**Before:**
```php
$builder = DB::connection(config('database.vocab_connection', 'pgsql'))
    ->table(config('database.vocab_schema', 'public') . '.concept')
```

**Problem:** Neither `database.vocab_connection` nor `database.vocab_schema` config keys exist in `config/database.php`. Defaults fall back to:
- Connection: `pgsql` → Docker `parthenon` DB with `search_path = 'app,public'`
- Table: `public.concept` → **empty table** (0 rows)

The real concept data (7.2M rows) lives in `omop.concept` on the local PG 17 `ohdsi` DB, accessible via the `vocab` connection (`search_path = 'omop,public'`).

**After:**
```php
$builder = DB::connection('vocab')
    ->table('concept')
```

Uses the `vocab` connection whose `search_path = 'omop,public'` resolves `concept` to `omop.concept` (7.2M standard concepts).

### Bug 10 (CRITICAL): AiDrawer wrong URL, response fields, and missing auth
**File:** `frontend/src/components/layout/AiDrawer.tsx` (line 67)

**Before:**
```js
const res = await fetch("/api/v1/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: text }),
});
// read: data.response ?? data.message
```

**Problems (3 in 1):**
1. URL `/api/v1/ai/chat` doesn't exist — backend route is `/api/v1/abby/chat`
2. Response reads `data.response ?? data.message` — backend returns `{reply, suggestions}`
3. No CSRF token or `credentials: "include"` — Sanctum auth rejects the request

**After:**
```js
const res = await fetch("/api/v1/abby/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-XSRF-TOKEN": decodeURIComponent(
      document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? "",
    ),
  },
  credentials: "include",
  body: JSON.stringify({
    message: text,
    page_context: "general",
    history: messages.filter(m => m.id !== "welcome").slice(-10)
      .map(m => ({ role: m.role, content: m.content })),
  }),
});
// read: data.reply
```

Also sends conversation history (last 10 turns) for multi-turn context.

### Bug 11: AiService page_data JSON serialization
**File:** `backend/app/Services/AiService.php` (line 176)

**Before:** `'page_data' => $pageData,`
**Problem:** PHP empty array `[]` serializes to JSON `[]` (array), but Python Pydantic expects `dict[str, Any]` (JSON `{}`). Causes 422 Unprocessable Entity.
**After:** `'page_data' => $pageData ?: (object) [],`

When `$pageData` is empty, `(object) []` serializes to JSON `{}`.

---

## Files Modified (9 total)

| File | Bugs Fixed |
|------|-----------|
| `backend/routes/api.php` | 5 |
| `backend/app/Http/Controllers/Api/V1/AchillesController.php` | 5 |
| `backend/app/Services/AI/AbbyAiService.php` | 9 |
| `backend/app/Services/AiService.php` | 11 |
| `frontend/src/features/care-gaps/api/careGapApi.ts` | 1 |
| `frontend/src/features/vocabulary/api/vocabularyApi.ts` | 2, 6, 7 |
| `frontend/src/features/cohort-definitions/api/cohortApi.ts` | 3 |
| `frontend/src/features/dashboard/api/dashboardApi.ts` | 4 |
| `frontend/src/components/layout/AiDrawer.tsx` | 10 |

---

## Infrastructure Fixes

### Docker env_file stale values
- Docker Compose `env_file:` loads environment variables at container **creation** time
- Editing `backend/.env` on the host (volume-mounted) updates the file on disk but NOT the process environment
- Laravel's `env()` reads process env first (set by Docker), which takes precedence over the `.env` file
- **Fix:** `docker compose up -d php` (not `restart`) recreates the container with fresh env
- **Lesson:** Always `up -d` after changing `.env` values that Docker loaded via `env_file`

### AI service URL migration
- Changed `AI_SERVICE_URL` from `http://python-ai:8000` (Docker internal) to `http://host.docker.internal:8002` (local service)
- The `extra_hosts: host.docker.internal:host-gateway` in docker-compose.yml enables this
- Local Python AI service runs on port 8002 with Ollama/MedGemma accessible at localhost

---

## Verification Results

### Backend Tests
```
Tests: 109 passed (905 assertions), 11 deprecated
Duration: 8.52s
```

### Frontend Tests
```
Test Files: 11 passed (11)
Tests: 64 passed (64)
Duration: 782ms
```

### TypeScript
```
npx tsc --noEmit → 0 errors
```

### Abby AI End-to-End
```
# Cohort builder
buildCohortFromPrompt("New users of metformin aged 40-65 with Type 2 diabetes")
→ LLM confidence: 0.92
→ Concept sets: metformin (10 concepts), Type 2 diabetes (10 concepts)
→ Demographics: aged 40–65, new_users design with 365-day washout
→ Warnings: 0

# Chat
chat("What is OMOP CDM?")
→ Reply: "OMOP CDM stands for Observational Medical Outcomes Partnership..."
→ Suggestions: ["What are the main components?", "How does OMOP CDM help with data quality?", ...]
```

---

## Key Learnings

### 1. Non-existent config keys silently degrade
`config('database.vocab_connection', 'pgsql')` looks correct — it even has a sensible default. But the key doesn't exist in `config/database.php`, so it ALWAYS uses the fallback. The code appeared to work (no exceptions) but silently queried an empty table. **Lesson:** When using `config()` with defaults, verify the key actually exists in the config file, or hardcode the known-correct value.

### 2. PHP empty arrays are JSON arrays, not objects
`json_encode([])` → `[]` (array), not `{}` (object). Python Pydantic's `dict[str, Any]` rejects arrays. Use `(object) []` or `new \stdClass()` for empty objects. This is a classic PHP-Python interop gotcha.

### 3. fetch() vs apiClient in React
The `AiDrawer.tsx` used raw `fetch()` instead of the project's `apiClient` (Axios). This meant:
- No automatic CSRF token injection
- No `credentials: "include"` for Sanctum session auth
- No base URL or interceptors
When using `fetch()` directly in a Sanctum-protected app, you must manually add the `X-XSRF-TOKEN` header and `credentials: "include"`.

### 4. Docker env_file is a snapshot, not a live binding
`env_file: ./backend/.env` in docker-compose.yml copies env vars into the container's process at creation. Editing the file on the host (even with a bind mount) does NOT update process-level environment variables. `docker compose restart` doesn't help — only `docker compose up -d` (recreate) does.

### 5. Frontend-backend URL mismatches are silent failures
`/api/v1/ai/chat` vs `/api/v1/abby/chat` — a one-word difference causes a 404 that the UI catches and displays as a generic "service unavailable" error. Systematic route-matching audits (comparing `routes/api.php` with frontend API files) are essential after initial wiring.

---

### 6. Container reloads wipe seeded data — automate seeding
The admin user and OHDSI Acumenus source lived only in the Docker PG `parthenon` database. Every `docker compose up -d` that recreated the postgres container (or a `migrate:fresh`) wiped them. **Fix:** Consolidated all seeding into `DatabaseSeeder` (admin user + source + daimons) and added `php artisan db:seed --force` to `deploy.sh` so it runs automatically after every migration. All seeders use `firstOrCreate`/`updateOrCreate` — fully idempotent, safe to re-run.

---

### 7. Data persistence and automated seeding
**Problem:** Admin user and OHDSI Acumenus source disappeared after every container reload. The user reported the login stopped working after each `docker compose up -d`.

**Root cause:** `DatabaseSeeder` was never called automatically. It only ran if someone manually invoked `php artisan db:seed`. Container recreation itself did NOT wipe data — the Docker PG uses a named volume (`postgres-data`) that persists, and the local PG 17 is on disk permanently. The real issue was that `migrate:fresh` or schema resets during development would drop seeded data, and there was no mechanism to restore it.

**Investigation findings:**
- `docker-compose.yml` line 69: `postgres-data:/var/lib/postgresql/data` — named volume, persists across `up -d`, `restart`, even `down` (only `down -v` deletes volumes)
- `redis-data:/data` — same persistence guarantee
- App tables (users, sources, etc.) live in local PG 17 `ohdsi` DB, `app` schema — on-disk, never affected by Docker container lifecycle
- The issue was exclusively a seeding gap, not a storage gap

**Fixes applied:**
1. **`DatabaseSeeder.php`** — Consolidated: now creates admin user (with `must_change_password: false`), OHDSI Acumenus source + 3 daimons, plus calls all sub-seeders. Everything uses `firstOrCreate`/`updateOrCreate` — fully idempotent.
2. **`deploy.sh`** — Added `php artisan db:seed --force` after migrations. Every `./deploy.sh` or `./deploy.sh --db` now guarantees admin user and source exist.
3. **Removed separate `eunomia:seed-source` command dependency** — source seeding is now part of the standard `DatabaseSeeder`, not a separate Artisan command.

**Files modified:**
| File | Change |
|------|--------|
| `backend/database/seeders/DatabaseSeeder.php` | Added source+daimon seeding, `must_change_password: false` on admin |
| `deploy.sh` | Added `db:seed --force` after `migrate --force` |

**Verification:**
```bash
# Simulate container reload
docker compose up -d php
# → Data survives: 1 user, 1 source, admin login works

# Verify password
php artisan tinker → Hash::check('superuser', $user->password) → true

# Direct PG check
psql ohdsi -c "SELECT email, must_change_password FROM app.users"
# → admin@parthenon.local | f
```

---

### Wave 3: URL Prefix & Auth Fixes (3 bugs)

| # | Severity | Feature | Issue |
|---|----------|---------|-------|
| 12 | **CRITICAL** | Admin API | All 20+ admin endpoints have double `/v1/` prefix — `apiClient` baseURL is `/api/v1` but paths start with `/v1/admin/...` → `/api/v1/v1/admin/...` → 404 |
| 13 | HIGH | Abby AI Chat | Raw `fetch()` doesn't carry Sanctum auth through Apache proxy — 401 in production |
| 14 | MEDIUM | DQD Dashboard | `GET /sources/{id}/dqd/latest` returns 404 when no DQD run exists — console noise on dashboard |

### Bug 12: Double `/v1/` prefix on admin, auth, and onboarding endpoints
**Files:** `frontend/src/features/administration/api/adminApi.ts`, `frontend/src/features/auth/components/SetupWizard.tsx`, `frontend/src/features/auth/components/OnboardingModal.tsx`
- `apiClient` already has `baseURL: "/api/v1"`, so paths like `"/v1/admin/users"` produced `/api/v1/v1/admin/users` → 404
- Global fix: removed leading `/v1` from all 20+ endpoint paths in `adminApi.ts`, plus onboarding/auth paths in `SetupWizard.tsx` and `OnboardingModal.tsx`

### Bug 13: AiDrawer migrated from raw fetch() to apiClient
**File:** `frontend/src/components/layout/AiDrawer.tsx`
- Replaced entire raw `fetch()` block with `apiClient.post("/abby/chat", ...)` — gets automatic CSRF, auth headers, base URL
- This resolved the 401 errors in production (Apache proxy + Sanctum)

### Bug 14: DQD latest returns 200 empty summary instead of 404
**File:** `backend/app/Http/Controllers/Api/V1/DataQualityController.php`
- When no DQD runs exist, returns `{data: {total: 0, passed: 0, failed: 0, not_applicable: 0, categories: []}}` (200) instead of 404
- Eliminates console error noise on dashboard; `dashboardApi.ts` reads `failed: 0` correctly

---

## Remaining Work

- **Bug 8 (Jobs page):** Requires `JobController` + unified job tracking table — deferred to future phase
- **Multi-source support:** `AchillesResultReaderService` and `VocabularyController` use hardcoded connections; need Source daimon resolution for multi-source deployments
- **Query performance:** May need GIN trigram index on `omop.concept.concept_name` for substring search at scale

## 2026-04-19 — Migration guard fix

`isolate_finngen_schema.php`: wrapped `ALTER DEFAULT PRIVILEGES FOR ROLE parthenon_migrator` in `IF migrator_exists THEN` block. Community / development databases without the `parthenon_migrator` role no longer fail migration on first bootstrap. The `HIGHSEC` production role split is preserved for hardened deployments.
