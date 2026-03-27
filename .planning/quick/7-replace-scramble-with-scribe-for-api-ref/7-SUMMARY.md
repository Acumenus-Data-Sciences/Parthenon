---
phase: quick-7
plan: 01
subsystem: backend/api-docs
tags: [api-documentation, scribe, openapi, nginx]
dependency_graph:
  requires: []
  provides: [static-api-docs, openapi-spec]
  affects: [deploy-pipeline, nginx-config, all-controllers]
tech_stack:
  added: [knuckleswtf/scribe]
  removed: [dedoc/scramble]
  patterns: [static-site-generation, phpdoc-group-annotations]
key_files:
  created:
    - backend/config/scribe.php
  modified:
    - backend/composer.json
    - backend/composer.lock
    - backend/.gitignore
    - docker/nginx/default.conf.template
    - deploy.sh
    - backend/app/Http/Controllers/Api/V1/**/*.php (118 controllers)
  deleted:
    - backend/config/scramble.php
    - backend/app/Http/Middleware/DebugScramble.php
    - backend/routes/_debug_docs.php
    - backend/resources/views/vendor/scramble/docs.blade.php
    - backend/public/debug-docs.php
decisions:
  - "Static type ('static') over Laravel blade type -- eliminates runtime overhead entirely"
  - "Route prefix api/* instead of api/v1 -- catches all versioned routes"
  - "Python yaml-to-json conversion in deploy.sh -- PHP lacks yaml extension, avoids adding dependency"
  - "Generated docs (public/docs/, .scribe/) gitignored as build artifacts"
  - "Response calls disabled (only: []) -- avoids hitting real database during doc generation"
metrics:
  duration: 8min
  completed: 2026-03-27
  tasks_completed: 3
  tasks_total: 3
  files_modified: 125
---

# Quick Task 7: Replace Scramble with Scribe for API Documentation Summary

Replaced broken Scramble runtime API docs with Scribe static generation -- 118 controllers annotated, static HTML + OpenAPI spec generated at build time, nginx serves docs without PHP-FPM.

## What Was Done

### Task 1: Swap Scramble for Scribe (63c0cd4e7)

- Removed `dedoc/scramble` via composer, installed `knuckleswtf/scribe`
- Created `backend/config/scribe.php` with full configuration:
  - Static output to `public/docs/`
  - Sanctum Bearer auth documentation
  - OpenAPI 3.0.3 spec generation enabled
  - Try It Out enabled for interactive testing
  - Response calls disabled (no real DB hits during generation)
  - Group ordering for all 40+ API groups
  - Rich API description with auth instructions and standards
- Converted all 118 controllers from `#[Group('Name', weight: N)]` PHP 8 attributes to `@group Name` PHPDoc annotations
  - 72 controllers had existing Scramble Group attributes (converted)
  - 46 controllers had no group (inferred from controller name/domain)
- Deleted Scramble artifacts: config, DebugScramble middleware, debug routes, Blade view, debug-docs.php
- Reverted APP_DEBUG to false (was set to true during debugging)
- Added `public/docs/` and `.scribe/` to `.gitignore`

### Task 2: Update nginx and deploy.sh (72abfa2ec)

- Replaced PHP-FPM proxy block with static file `alias` for `/docs/api`
- Added `scribe:generate` to deploy.sh PHP section (runs on every full deploy)
- Updated deploy.sh OpenAPI section to use `scribe:generate` instead of `scramble:export`
- Recreated nginx container to pick up template change
- Verified: `/docs/api/` returns 200 with Parthenon-branded static HTML

### Task 3: OpenAPI export for TypeScript (2ece47967)

- Added Python `yaml.safe_load` -> `json.dumps` conversion step in deploy.sh
- Scribe generates `openapi.yaml`; conversion produces `api.json` for TypeScript type generator
- Verified OpenAPI spec has 785 operations across 745 API paths
- TypeScript compilation passes clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route prefix matching**
- **Found during:** Task 1
- **Issue:** Scribe with prefix `api/v1` produced empty OpenAPI spec (0 routes matched)
- **Fix:** Changed prefix to `api/*` which correctly matches all API routes
- **Files modified:** backend/config/scribe.php

**2. [Rule 1 - Bug] APP_DEBUG left as true**
- **Found during:** Task 1
- **Issue:** APP_DEBUG was set to true during previous debugging session
- **Fix:** Reverted to false per HIGHSEC spec (production debug mode must be false)
- **Files modified:** backend/.env

**3. [Rule 3 - Blocking] Container debug artifacts**
- **Found during:** Task 1
- **Issue:** `backend/public/debug-docs.php` existed from debugging session (also flagged by Pint)
- **Fix:** Deleted from both disk and container
- **Files modified:** backend/public/debug-docs.php (deleted)

**4. [Rule 3 - Blocking] Nginx template requires container recreation**
- **Found during:** Task 2
- **Issue:** `nginx -s reload` did not pick up template changes (template processed at startup)
- **Fix:** Used `docker compose up -d --force-recreate nginx`

## Verification Results

| Check | Result |
|-------|--------|
| /docs/api serves static HTML with Parthenon branding | PASS |
| Static HTML exists at backend/public/docs/index.html | PASS |
| OpenAPI spec exists at backend/public/docs/openapi.yaml | PASS |
| No Scramble references in codebase | PASS |
| nginx config valid | PASS |
| 118 controllers have @group annotations | PASS |
| TypeScript compilation clean | PASS |
| Pint formatting clean | PASS |

## Self-Check: PASSED
