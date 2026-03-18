# Parthenon Codebase Health Fixes

## What This Is

Systematic remediation of critical bugs found during a full-codebase health audit of Parthenon, a unified OHDSI outcomes research platform. This project fixes 3 critical issues that are actively breaking production functionality: email delivery, FHIR export, and data ingestion.

## Core Value

All production-facing features must actually work — no silently broken email, no crashing pages, no corrupted API responses.

## Requirements

### Validated

- ✓ Auth system (login, register, password reset) — existing
- ✓ Dashboard with CDM characterization — existing (restored from stash)
- ✓ Query Library with 201 OHDSI entries — existing (imported)
- ✓ Stats bar drill-through for Concept Sets and Cohort Definitions — existing

### Active

- [ ] RESEND_KEY env variable must match what Laravel reads — email delivery is broken
- [ ] FHIR Export page must have working backend endpoints — page crashes on any action
- [ ] Ingestion API must unwrap Laravel response envelope — 18+ API calls return wrong data shape

### Out of Scope

- High severity issues (hardcoded sourceId, history metadata, gene filter) — deferred to v2
- Medium severity issues (Solr config, accessibility, error states, type safety) — deferred to v2
- Low severity issues (modal consistency, dead code, empty state guidance) — deferred to v2
- New features or UI redesigns — this is a bugfix-only project
- Stash@{0} Abby agency framework review — separate decision, not a bug

## Context

**Audit findings (2026-03-18):** 5 parallel agents scanned all frontend feature modules and backend infrastructure. Found 16 issues total across 4 severity levels. This project addresses only the 3 critical issues.

**Tech stack:** Laravel 11 (PHP 8.4) + React 19 + TypeScript + Vite + TanStack Query. Production at https://parthenon.acumenus.net.

**Root causes:**
1. RESEND_KEY: `.env` uses `RESEND_API_KEY` but `config/services.php` reads `RESEND_KEY` via `env('RESEND_KEY')`. One-line fix.
2. FHIR Export: Frontend page exists at `/admin/fhir-export` calling `POST /fhir/$export` and `GET /fhir/$export/{id}`, but no backend routes or controller methods exist. Needs new controller or feature flag/disable.
3. Ingestion API: All 18+ API functions in `ingestionApi.ts` return raw Axios response data without unwrapping Laravel's `{data: T}` envelope. Need `data.data ?? data` pattern.

## Constraints

- **Auth system**: DO NOT modify any auth components (see `.claude/rules/auth-system.md`)
- **Production**: Changes must not break existing functionality
- **Secrets**: Never hardcode credentials; RESEND_API_KEY is already in .env, just wrong variable name
- **Testing**: Must verify fixes with TypeScript check and PHPStan before committing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix only Critical issues in v1 | Focused scope prevents more mistakes | — Pending |
| Skip research phase | Audit already identified exact root causes | — Pending |
| Use GSD tracking | Prevent context loss between fixes | — Pending |

---
*Last updated: 2026-03-18 after initialization*
