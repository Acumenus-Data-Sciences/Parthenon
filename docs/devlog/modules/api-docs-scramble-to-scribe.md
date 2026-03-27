# API Documentation: Scramble to Scribe Migration

**Date:** 2026-03-27
**Scope:** API reference at `/docs/api`
**Commits:** `63c0cd4e7` through `be04eecd2`

## Problem

The Scramble-powered API reference (`/docs/api`) was returning HTTP 500 through nginx/PHP-FPM. Scramble generates the full OpenAPI spec **at runtime** by analyzing all 800+ routes on every page load:

- 240MB peak memory per request
- 4-5 second generation time
- PHP 8.4 deprecation warnings in Scramble's `FileNameResolver.php`
- Opaque FPM-only failure (worked in CLI/tinker, crashed through FPM)
- Debugging was a dead end -- the error was invisible with `APP_DEBUG=false` due to Scramble's Generator silently re-throwing exceptions

This had been working but broke sometime after the v0.13.16 update or PHP 8.4.19 minor bump. The root cause was never definitively isolated because the failure only manifested in the FPM execution path.

## Decision

Replace Scramble (`dedoc/scramble`) with Scribe (`knuckleswtf/scribe`).

| Dimension | Scramble | Scribe |
|-----------|----------|--------|
| Generation | Runtime (every page load) | Build time (`php artisan scribe:generate`) |
| Output | PHP route serving Stoplight Elements | Static HTML + OpenAPI YAML |
| Memory | 240MB per request | Zero at runtime |
| Failure mode | Live 500 error | Build fails, old docs stay up |
| Annotations | None (static analysis) | `@group` PHPDoc on controller class |
| Maturity | v0.13, frequent breaking changes | v4.x, battle-tested |

The annotation overhead is minimal -- `@group GroupName` on each controller class, which also serves as useful documentation.

## What Changed

### Package Swap
- Removed `dedoc/scramble`, installed `knuckleswtf/scribe`
- Created `backend/config/scribe.php` with Parthenon branding, Sanctum auth docs, group ordering
- Generated output gitignored (`public/docs/`, `.scribe/`)

### Controller Annotations
- 118 controllers annotated with `@group` PHPDoc tags
- 72 had existing Scramble `#[Group]` attributes (converted)
- 46 had no group (inferred from controller domain)

### Infrastructure
- nginx: `/docs/api` changed from PHP-FPM proxy to static file `alias`
- `deploy.sh`: `scramble:export` replaced with `scribe:generate --no-interaction`
- OpenAPI flow: Scribe generates YAML, Python converts to JSON for TypeScript type generator

### Cleanup
- Deleted: `config/scramble.php`, `DebugScramble.php` middleware, debug routes, published Blade view
- Reverted `APP_DEBUG` to `false` (was left `true` from debugging session)

## Verification

- `/docs/api` returns HTTP 200 with 5.8MB static HTML
- 785 API operations in OpenAPI spec
- Zero PHP-FPM involvement in serving docs
- TypeScript compilation clean
- `grep -r scramble backend/` returns nothing

## Lessons Learned

1. **Runtime spec generation is fragile at scale.** 800+ routes pushing 240MB per request is asking for trouble. Build-time generation is the right pattern for large APIs.
2. **Scramble's error handling masks failures.** The Generator catches all Throwables and re-throws without logging when `APP_DEBUG=false`. This made debugging nearly impossible.
3. **Static output eliminates an entire class of problems.** No PHP memory, no FPM workers, no middleware conflicts, no session handling -- just nginx serving files.
