# Phase 12 — Admin Dashboard Expansion + AI Provider Configuration

**Date:** 2026-03-03
**Branch:** master

---

## What Was Built

### Phase 12A: AI Provider Configuration

Admins can now switch Abby's AI backend between 8 providers without touching config files.

**Database:**
- `ai_provider_settings` table (migration `2026_03_02_500000`)
- 8 rows seeded: ollama (active), anthropic, openai, gemini, deepseek, qwen, moonshot, mistral
- `is_active` enforces single-active constraint via transaction in `activate()`
- Settings (api_key, base_url) stored encrypted via `encrypted:array` cast

**Backend:**
- `AiProviderSetting` model — mirrors `AuthProviderSetting` pattern
- `AiProviderController` — index, show, update, activate, enable, disable, test
- `test()` — provider-specific connectivity checks:
  - Ollama: GET `{base_url}/api/tags`
  - Anthropic: POST `/v1/messages` with tiny prompt (200 or 400 = key valid, 401 = invalid)
  - OpenAI/DeepSeek/Qwen/Moonshot/Mistral: GET `/v1/models` with Bearer token
  - Gemini: GET `/v1/models?key={key}` (no Bearer, key in query)

**Frontend:**
- `AiProvidersPage` — 8 collapsible provider cards
  - Region badges (US / EU / China / Local)
  - Active provider green banner at top
  - Model selector (pre-populated per provider)
  - API key input with show/hide toggle (password type)
  - Ollama: URL field instead of API key
  - "Set as Active" radio button, enable toggle, "Test Connection" with inline result
- `useAiProviders` hooks — full TanStack Query coverage
- API functions in `adminApi.ts`

### Phase 12B: System Health Dashboard

**Backend:**
- `SystemHealthController` — checks 5 services:
  1. Backend API (always healthy — if it responds, it's up)
  2. Redis — `Redis::ping()` with try/catch
  3. AI Service (Abby) — `Http::timeout(3)->get("{AI_SERVICE_URL}/health")`
  4. R Analytics Runtime — `Http::timeout(3)->get("{R_PLUMBER_URL}/healthz")`
  5. Job Queue — `DB::table('jobs')->count()` + failed_jobs
- Route: `GET /api/v1/admin/system-health` (admin+ role)

**Frontend:**
- `SystemHealthPage` — grid of 5 status cards
  - Color-coded: green (healthy) / yellow (degraded) / red (down)
  - Queue card shows pending + failed counts
  - Overall health banner
  - Auto-refreshes every 30s (`refetchInterval: 30_000`)
  - Manual "Refresh" button with spinner

### Admin Dashboard Updates
- Added "Active AI Provider" stat card (shows name + model)
- Added "AI Provider Configuration" nav card (orange, super-admin only)
- Added "System Health" nav card (emerald, all admins)
- Stats grid expanded to 4 columns

### Bug Fix: Spatie Role Middleware Alias (Pre-existing)
- **Root cause**: `role` middleware alias was never registered in `bootstrap/app.php` for Laravel 11
- **Symptom**: All routes under `middleware('role:super-admin')` threw `Target class [role] does not exist.` during `terminateMiddleware()` phase → HTTP 500
- **Evidence**: 22 prior occurrences in `laravel.log` (pre-existing, not introduced by Phase 12)
- **Fix**: Added to `bootstrap/app.php`:
  ```php
  $middleware->alias([
      'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
      'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
      'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
  ]);
  ```

### Phase 12C/D (Planned Only)
- Audit log: `admin_audit_logs` table + Model Observer + searchable UI
- Vocabulary Management: upload Athena zip → queue job → swap into `omop` schema

---

## Files Changed

### New
| File | Description |
|------|-------------|
| `backend/database/migrations/2026_03_02_500000_create_ai_provider_settings_table.php` | DB schema |
| `backend/database/seeders/AiProviderSeeder.php` | 8 provider rows |
| `backend/app/Models/App/AiProviderSetting.php` | Eloquent model |
| `backend/app/Http/Controllers/Api/V1/Admin/AiProviderController.php` | REST + test endpoints |
| `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` | 5-service health check |
| `frontend/src/features/administration/pages/AiProvidersPage.tsx` | Provider card UI |
| `frontend/src/features/administration/pages/SystemHealthPage.tsx` | Health dashboard |
| `frontend/src/features/administration/hooks/useAiProviders.ts` | TanStack Query hooks |

### Modified
| File | Change |
|------|--------|
| `backend/bootstrap/app.php` | **Bug fix**: Register Spatie role/permission middleware aliases |
| `backend/routes/api.php` | Add AI provider + system-health routes |
| `backend/database/seeders/DatabaseSeeder.php` | Call AiProviderSeeder |
| `frontend/src/types/models.ts` | Add `AiProviderSetting`, `SystemHealth`, `SystemHealthService` types |
| `frontend/src/features/administration/api/adminApi.ts` | Add AI provider + health API functions |
| `frontend/src/features/administration/pages/AdminDashboardPage.tsx` | New stat + nav cards |
| `frontend/src/app/router.tsx` | Add `/admin/ai-providers`, `/admin/system-health` routes |

---

## Verification Results

```
GET  /api/v1/admin/ai-providers         → 200, 8 providers (ollama active)
PUT  /api/v1/admin/ai-providers/anthropic → 200, saves model + encrypted settings
POST /api/v1/admin/ai-providers/anthropic/test → success=False, "Invalid API key." (dummy key)
POST /api/v1/admin/ai-providers/anthropic/activate → sets is_active=True, clears others
POST /api/v1/admin/ai-providers/ollama/activate → restores
GET  /api/v1/admin/system-health        → 200, 5 services (backend+redis+queue healthy)
npx tsc --noEmit                        → 0 errors
Vite build                              → ✓ success
```

---

## Gotchas

1. **Docker bind mount inode mismatch**: `stat` inside container may show stale inode if the container cached the file, but `ls -la` and `cat` reflect the live mount. Always `route:clear` + `config:clear` after modifying `bootstrap/app.php`.

2. **Route cache must be cleared after bootstrap changes**: `bootstrap/app.php` changes affect middleware registration. If cached routes don't include the alias, clearing the route cache and rebuilding fixes it.

3. **Spatie middleware in Laravel 11**: Unlike Laravel 10 (which had `Http/Kernel.php`), Laravel 11 requires explicit `$middleware->alias()` registration in `bootstrap/app.php`. Spatie does NOT auto-register in `PermissionServiceProvider`.

4. **AI service hostname**: `AI_SERVICE_URL` defaults to `http://ai:8002` (Docker service name). PHP container can reach the AI container via this name when both are on the `parthenon` network. From outside Docker, this hostname doesn't resolve — expected behavior.
