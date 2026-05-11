# Solr Integration — Phase 8b: System Health Drilldown & Admin UX Fixes

**Date:** 2026-03-06
**Scope:** Admin dashboard corrections, System Health drillable service panels, service detail pages with logs and metrics

## What Was Built

### 8b.1 — Admin Dashboard Corrections

- Removed Solr Search card from AdminDashboardPage NAV_CARDS (it's not a standalone admin section)
- Added Solr as a service in SystemHealthController alongside Redis, AI, R runtime, and Job Queue
- Solr health check queries the Solr admin cores API, returns core count + total document count
- Updated System Health card description to mention Solr

### 8b.2 — SolrAdminPage UX Rewrite

Rewrote SolrAdminPage from legacy CSS patterns to match the application's Tailwind + UI component system:
- Replaced `page-container`, `card`, `btn`, `alert` classes with `Panel`, `Badge`, `StatusDot`, `Button`
- Removed all inline `style` props with CSS variables (`var(--space-*)`, `var(--text-*)`, etc.)
- Now uses proper Tailwind classes throughout, matching SystemHealthPage patterns

### 8b.3 — Drillable System Health Panels

Made all 6 service cards on the System Health page clickable, each linking to a detail page at `/admin/system-health/:key`.

**Backend — `SystemHealthController::show()`**

New endpoint `GET /api/v1/admin/system-health/{key}` returns:
- `service` — status, name, message (same as index)
- `logs` — recent log entries (up to 50)
- `metrics` — service-specific key/value metrics

Log sources per service:
| Service | Log Source |
|---------|-----------|
| backend | Parsed from `storage/logs/laravel.log` (last 200 lines, structured into entries) |
| redis | Redis SLOWLOG (last 20 slow commands with duration) |
| ai | Laravel log entries filtered for AI/Ollama/MedGemma keywords |
| r | Laravel log entries filtered for R/Plumber/HADES keywords |
| solr | Solr's `/admin/info/logging` API (last 30 entries) |
| queue | Recent failed jobs from `failed_jobs` table with error excerpts |

Metrics per service:
| Service | Metrics |
|---------|---------|
| backend | PHP version, Laravel version, environment, debug mode, cache/queue drivers |
| redis | Version, uptime, connected clients, memory usage, hit/miss ratio |
| ai | Proxied from AI service `/health` endpoint |
| r | Proxied from R runtime `/healthz` endpoint |
| solr | Per-core doc counts, sizes, deleted docs, uptime |
| queue | Pending, failed, recent 1h job counts, driver |

**Frontend — `ServiceDetailPage`**

- Status banner with badge + dot
- Metrics grid (flat key/value pairs in responsive grid)
- Nested metrics (e.g., Solr per-core breakdowns as individual Panel cards)
- Scrollable log viewer with color-coded levels (error=red, warning=amber, info=blue, debug=muted)
- Monospace font, reverse-chronological, timestamps formatted to local time
- "Manage Solr Cores" button on Solr detail page linking to `/admin/solr`
- Auto-refreshes every 15 seconds
- Back link to System Health overview

**SystemHealthPage updates:**
- All service cards wrapped in `<Link>` to `/admin/system-health/:key`
- Hover effect shows "View details" with arrow
- Skeleton loader updated to 6 items (matching 6 services)

## Files Created
- `frontend/src/features/administration/pages/ServiceDetailPage.tsx`

## Files Modified
- `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` — Added `show()`, log/metrics methods, `tailFile()` helper
- `backend/routes/api.php` — Added `GET /admin/system-health/{key}` route
- `frontend/src/features/administration/pages/SystemHealthPage.tsx` — All cards drillable
- `frontend/src/features/administration/pages/SolrAdminPage.tsx` — Rewritten with Tailwind UI components
- `frontend/src/features/administration/pages/AdminDashboardPage.tsx` — Removed Solr card, updated System Health description
- `frontend/src/features/administration/api/adminApi.ts` — Added `fetchServiceDetail`, `ServiceDetail`, `ServiceLogEntry` types
- `frontend/src/features/administration/hooks/useAiProviders.ts` — Added `useServiceDetail` hook
- `frontend/src/app/router.tsx` — Added `/admin/system-health/:key` route

## Verification
- TypeScript compiles clean (`npx tsc --noEmit`)
- PHPStan level 8 passes on SystemHealthController
- Production build succeeds (`npx vite build`)
- Backend endpoint tested via tinker — returns structured logs + metrics for all 6 services
- Solr detail: 5 cores, 7.2M documents, per-core size/doc metrics, Solr logging API entries
- Redis detail: v7.4.7, 27 clients, 2.02M memory, 688K commands processed
- Backend detail: Laravel logs parsed with timestamps, levels, and truncated stack traces
