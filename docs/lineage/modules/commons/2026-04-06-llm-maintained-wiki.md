# LLM-Maintained Wiki Engine for Commons

**Date:** 2026-04-06
**Status:** Implemented
**Scope:** AI-backed filesystem wiki for Commons, shipped in parallel with the legacy DB-backed wiki

## What Was Built

### AI-backed persistent wiki engine
- Added a new filesystem-backed wiki engine in the Python AI service under `ai/app/wiki/`
- Wiki content now lives in a dedicated mounted volume at `data/wiki`, with a separate Git repository for page history and workspace structure
- The engine supports:
  - workspace initialization
  - source ingestion from raw text, markdown, and PDF
  - wiki page synthesis and update
  - machine-maintained `index.md` page directory
  - machine-maintained `log.md` activity feed
  - query answering from wiki pages
  - linting for broken wikilinks and empty pages

### FastAPI wiki surface
- Added `/wiki/*` endpoints in the AI service:
  - `GET /wiki/workspaces`
  - `POST /wiki/workspaces/{workspace}/init`
  - `GET /wiki/pages`
  - `GET /wiki/pages/{slug}`
  - `GET /wiki/activity`
  - `POST /wiki/ingest`
  - `POST /wiki/query`
  - `POST /wiki/lint`
- Added Pydantic request/response models and unit/integration tests for the new wiki package

### Laravel proxy and RBAC
- Added a new top-level Laravel proxy controller for the AI wiki at `backend/app/Http/Controllers/Api/V1/WikiController.php`
- Added explicit AI proxy methods in `backend/app/Services/AiService.php`
- Added new permissions:
  - `wiki.view`
  - `wiki.ingest`
  - `wiki.lint`
  - `wiki.manage`
- Registered new protected API routes under `/api/v1/wiki/*`
- Preserved upstream AI-service status codes through the Laravel proxy so validation and failure states are not flattened to `200`

### Commons UI rewrite with parallel rollout
- Replaced the single wiki screen with a new two-mode Commons wiki shell:
  - `AI Wiki`: new browse/query/ingest experience for the filesystem wiki
  - `Legacy Wiki`: preserved access to the existing DB-backed article editor and revision history
- Added new frontend pieces for the AI wiki:
  - workspace selector
  - grouped page tree
  - markdown page renderer with wikilink navigation
  - source ingest panel
  - query panel
  - lint result display
  - activity feed
- Kept the legacy Commons wiki available as a separate tab so rollout remains parallel-first rather than destructive

## Architecture Notes

### Storage model
- `data/wiki/` is mounted into the AI container at `/data/wiki`
- The wiki engine initializes a separate Git repository inside that mounted directory
- Each workspace gets:
  - `sources/`
  - `wiki/source_summaries/`
  - `wiki/entities/`
  - `wiki/concepts/`
  - `wiki/comparisons/`
  - `wiki/analyses/`
  - `index.md`
  - `log.md`

### Frontend contract
- Added dedicated wiki types in `frontend/src/features/commons/types/wiki.ts`
- Added dedicated hooks in `frontend/src/features/commons/api/wiki.ts`
- Added dedicated state in `frontend/src/stores/wikiStore.ts`
- The new UI is optimized for machine-maintained knowledge browsing and ingestion, not manual markdown editing

## Hardening and Review Fixes

### Proxy status handling
- The first pass of the Laravel proxy returned upstream JSON with an implicit `200`
- This was corrected so `404`, `422`, and `503` responses from the AI service are preserved when proxied through Laravel

### Parallel rollout integrity
- The first pass of the Commons UI replaced the legacy wiki entirely
- This was corrected by restoring the legacy wiki as a separate tab, preserving access to the existing CRUD/revision flow during rollout

### pgvector migration resilience
- Hardened pgvector-dependent migrations so they no longer assume:
  - extension creation privileges
  - `public.vector`
  - pgvector being installed at all
- When pgvector is unavailable, the related tables still migrate without embedding columns instead of failing unrelated tests or deploys

## Verification

### Passed
- `python -m pytest ai/tests/wiki -q`
- `npm test -- --run src/features/commons/components/wiki/__tests__/MarkdownRenderer.test.tsx`
- `npm run build`
- `php -l` on the modified controller, service, routes, tests, and migration files

### Not Run
- Full Laravel feature execution via `php artisan test`
- Reason: user constraint required all actions to remain non-destructive on the database, and Laravel feature tests would create/reset the dedicated testing DB

## Deployment Notes

- `deploy.sh` default mode is not safe under the current DB constraint because it performs:
  - pre-migration backup
  - design fixture export/commit
  - database migrations
- Safe deployment path for this feature is targeted deploy only:
  - `./deploy.sh --php`
  - `./deploy.sh --frontend`
  - `./deploy.sh --openapi`

## Files Added or Changed

### AI service
- `ai/app/wiki/*`
- `ai/app/routers/wiki.py`
- `ai/app/config.py`
- `ai/app/main.py`
- `ai/tests/wiki/*`

### Backend
- `backend/app/Http/Controllers/Api/V1/WikiController.php`
- `backend/app/Services/AiService.php`
- `backend/database/seeders/RolePermissionSeeder.php`
- `backend/routes/api.php`
- `backend/tests/Feature/Wiki/WikiApiTest.php`

### Frontend
- `frontend/src/features/commons/api/wiki.ts`
- `frontend/src/features/commons/types/wiki.ts`
- `frontend/src/stores/wikiStore.ts`
- `frontend/src/features/commons/components/wiki/WikiPage.tsx`
- `frontend/src/features/commons/components/wiki/LegacyWikiPage.tsx`
- `frontend/src/features/commons/components/wiki/MarkdownRenderer.tsx`
- `frontend/src/features/commons/components/wiki/WikiPageTree.tsx`
- `frontend/src/features/commons/components/wiki/WikiPageView.tsx`
- `frontend/src/features/commons/components/wiki/WikiWorkspaceSelector.tsx`
- `frontend/src/features/commons/components/wiki/WikiIngestPanel.tsx`
- `frontend/src/features/commons/components/wiki/WikiQueryPanel.tsx`
- `frontend/src/features/commons/components/wiki/WikiActivityFeed.tsx`

### Infrastructure
- `docker-compose.yml`
- `.gitignore`

## Follow-up

- Run full Laravel feature tests against the dedicated testing database when DB mutation is permitted
- Perform end-to-end validation of ingest/query/lint flows against the live stack
- Decide whether to migrate legacy Commons wiki content into the new filesystem wiki or keep legacy as a long-term parallel mode
