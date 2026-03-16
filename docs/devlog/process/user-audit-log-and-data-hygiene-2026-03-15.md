# User Audit Log, UI Alignment & Data Hygiene — 2026-03-15

## Overview

Three distinct pieces of work shipped in this session:

1. **User Audit Log** — full-stack feature tracking login, logout, feature access, and password events
2. **UI Alignment** — UsersPage and UserAuditPage rewritten to match the global dark clinical design standard
3. **Data Hygiene** — two fake seeder sources purged from production; factory chain fixed to prevent recurrence

---

## 1. User Audit Log System

### Motivation

The question was simple: do we know when users log in, what they use, and when they log out? The answer was no. Built it from scratch.

### What Was Built

**Backend**

- `database/migrations/2026_03_15_240000_create_user_audit_logs_table.php`
  - `user_audit_logs` table: `user_id` (nullable FK, nullOnDelete), `action varchar(100)`, `feature varchar(100)`, `ip_address varchar(45)`, `user_agent text`, `metadata jsonb`, `occurred_at`
  - Indexes on `[user_id, occurred_at]`, `action`, `occurred_at`

- `app/Models/App/UserAuditLog.php` — standard Eloquent model, `metadata` cast to array

- `app/Http/Middleware/RecordUserActivity.php`
  - Appended to the `api` middleware group in `bootstrap/app.php`
  - Maps 25+ API path prefixes to feature slugs (e.g. `admin/users` → `admin.users`, `genomics` → `genomics`)
  - Skips unauthenticated requests and `/api/v1/auth/` paths (handled explicitly in AuthController)
  - Hourly throttle via cache key `audit:{user_id}:{feature}:{Y-m-d-H}` — prevents log flood without losing visibility

- `app/Http/Controllers/Api/V1/Admin/UserAuditController.php`
  - `GET /api/v1/admin/user-audit` — paginated, filterable by user, action, feature, date range
  - `GET /api/v1/admin/user-audit/summary` — `logins_today`, `active_users_week`, top 10 features last 7 days, recent logins
  - `GET /api/v1/admin/users/{user}/audit` — per-user audit history

- `app/Http/Controllers/Api/V1/AuthController.php` — synchronous `UserAuditLog::create()` on login, logout, password_changed

**Frontend**

- `features/administration/api/adminApi.ts` — `UserAuditEntry`, `PaginatedAuditLog`, `AuditSummary`, `AuditFilters` types + fetch functions
- `features/administration/hooks/useUserAudit.ts` — TanStack Query hooks with `staleTime` and auto-refresh
- `features/administration/pages/UserAuditPage.tsx` — full audit log UI
- `app/router.tsx` — added `user-audit` lazy route under admin
- `components/layout/Sidebar.tsx` — added Audit Log entry under Administration

### Key Technical Decision: Synchronous Writes

Initial implementation used `dispatch(fn())->afterResponse()` for deferred audit writes to avoid adding latency to the request path. This proved completely unreliable — PHP closures with captured `$request` aren't serializable for queue dispatch, and `afterResponse()` depends on `fastcgi_finish_request()` which FPM doesn't guarantee.

Switched to synchronous `UserAuditLog::create()` everywhere. The hourly cache throttle on feature access events makes this acceptable — at most one INSERT per feature per user per hour.

---

## 2. UI Alignment — Dark Clinical Design Standard

Both the UserAuditPage (new) and the UsersPage (existing) were using semantic Tailwind tokens (`text-foreground`, `bg-background`) and UI component wrappers (`DataTable`, `Badge`, `Button`, `Modal`, `SearchBar`). The standard — established by CohortDefinitionsPage — uses raw hex tokens directly.

### Design Token Reference

| Token | Usage |
|-------|-------|
| `#0E0E11` | Page background |
| `#151518` | Panel / table row bg |
| `#1A1A1E` | Alternating table row |
| `#1C1C20` | Table header / modal bg |
| `#232328` | Border default |
| `#2A2A30` | Border subtle / button border |
| `#3A3A42` | Border hover |
| `#F0EDE8` | Primary text |
| `#C5C0B8` | Secondary text |
| `#8A857D` | Muted text |
| `#5A5650` | Ghost / placeholder text |
| `#2DD4BF` | Teal — active, focus ring, CTA |
| `#C9A227` | Gold — warnings, admin role |
| `#9B1B30` | Crimson — danger, super-admin role |
| `#60A5FA` | Blue — data-steward role |
| `#A78BFA` | Purple — mapping-reviewer role |
| IBM Plex Mono | All numeric values, emails, IPs, timestamps, keys |

### What Changed in UsersPage

- Replaced `DataTable` with a native `<table>` — sortable column headers with `ChevronUp`/`ChevronDown` indicators
- Replaced `Badge` with inline `RoleBadge` component using per-role hex colors
- Replaced `Modal` (delete confirm) with an inline `DeleteConfirmModal` using raw fixed overlay
- Replaced `Button` throughout with native `<button>` elements
- Replaced `SearchBar` with a raw `<input>` + Search icon
- Avatar initials circle uses teal `#2DD4BF15` bg
- Online status dot uses `Circle` fill matching the audit log pattern

### What Changed in UserModal

- Replaced `Modal` wrapper with a raw fixed overlay + `#1C1C20` panel
- Role checkboxes wrapped in card-style labels that light up teal when checked
- All inputs: `#151518` bg, `#232328` border, teal focus ring
- Error banner uses crimson palette

---

## 3. Data Hygiene — Fake Sources Purged

### Discovery

The Data Sources page showed 4 sources. The production database (`ohdsi` on `pgsql.acumenus.net`) had:

| ID | Key | Name | Created |
|----|-----|------|---------|
| 44 | `enim-aliquam` | Acumenus CDM | 2026-03-15 02:32 |
| 45 | `autem-excepturi-sunt` | Wolf and Sons CDM | 2026-03-15 02:32 |
| 46 | `EUNOMIA` | Eunomia (demo) | 2026-03-15 03:15 |
| 47 | `ACUMENUS` | OHDSI Acumenus CDM | 2026-03-15 03:15 |

IDs 44 and 45 are Faker artifacts — `enim-aliquam` and `autem-excepturi-sunt` are Faker slugs, "Wolf and Sons CDM" is a Faker company name.

### Root Cause

`AnalysisExecutionFactory` and `CohortGenerationFactory` both had `source_id => Source::factory()` as their default. Whenever a seeder (likely StudySeeder or AnalysisSeeder during the March 15 DatabaseSeeder incident) created analysis executions or cohort generations, it silently auto-spawned new sources. Source 44 accumulated 109 fake `analysis_executions` and 15 fake `cohort_generations` before being caught.

### What Was Deleted from Production

```sql
DELETE FROM app.analysis_executions WHERE source_id IN (44, 45);  -- 110 rows
DELETE FROM app.cohort_generations WHERE source_id IN (44, 45);   -- 15 rows
DELETE FROM app.source_daimons WHERE source_id IN (44, 45);       -- 6 rows
DELETE FROM app.sources WHERE id IN (44, 45);                      -- 2 rows
```

### Prevention (committed as `03f00b3d`)

1. **`SourceFactory`** — throws `\LogicException` if `app()->environment('production')`. Test names now use `test-*` prefix so any leak is immediately obvious.
2. **`AnalysisExecutionFactory`** — `source_id` default changed from `Source::factory()` to `null`. Must be provided explicitly.
3. **`CohortGenerationFactory`** — same.

All 67 affected tests still pass after the factory changes.

---

## Gotchas

- **Production DB is `pgsql.acumenus.net:5432/ohdsi`** — not the Docker postgres. The Docker PG is a stale local dev remnant. Always query the real DB when investigating production issues.
- **`app.sources` has no `created_by` column** — there is no user attribution on sources. They are created either by Artisan commands or (incorrectly) by factory chains.
- **`source_daimons` FK cascades are inconsistent** — `cohort_generations` and `analysis_executions` have non-cascading FKs to `sources`, requiring manual cleanup order.
