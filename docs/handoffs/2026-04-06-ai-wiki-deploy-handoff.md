# Handoff: AI Commons Wiki Deploy + Test

## Commit

- `78ed7e64f` `feat: add AI-maintained commons wiki`

## Scope

This commit adds the new AI-backed Commons wiki across:

- FastAPI wiki engine + router
- Laravel proxy + RBAC
- React Commons wiki UI
- Devlog
- Deploy/docs fixes for OpenAPI typegen and Docusaurus docs build

## Safe Deploy Status

Already verified without DB mutation:

- `./deploy.sh --openapi` passes
- `./deploy.sh --docs` passes
- Live checks:
  - `/docs/` -> `200`
  - `/docs/api/get-api-v-1-wiki-workspaces` -> `200`
  - `/api/v1/wiki/workspaces` -> `401` when anonymous

## What To Do Next

1. Deploy application changes with DB-safe paths first:
   - `./deploy.sh --php`
   - `./deploy.sh --frontend`
   - `./deploy.sh --openapi`
   - `./deploy.sh --docs`

2. Test the new wiki end-to-end in the running app:
   - open Commons wiki UI
   - confirm both `AI Wiki` and `Legacy Wiki` tabs render
   - initialize a workspace
   - ingest raw text / markdown / PDF
   - confirm pages appear in tree
   - confirm wikilinks navigate
   - confirm query + lint return results
   - confirm activity feed updates

3. Verify Laravel proxy behavior:
   - auth/permissions enforced
   - upstream non-200 statuses preserved

## Important Notes

- Full `./deploy.sh` is not DB-safe. It includes DB work.
- `deploy.sh` still has an unstaged local DB-related hunk in this worktree; do not commit it accidentally.
- There are unrelated untracked docs files in the worktree:
  - `docs/devlog/modules/cdm-indexing-optimization-2026-04-06.md`
  - `docs/screenshot.png.md`

## Key Files

- [engine.py](/home/smudoshi/Github/Parthenon/ai/app/wiki/engine.py)
- [wiki.py](/home/smudoshi/Github/Parthenon/ai/app/routers/wiki.py)
- [WikiController.php](/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/WikiController.php)
- [AiService.php](/home/smudoshi/Github/Parthenon/backend/app/Services/AiService.php)
- [WikiPage.tsx](/home/smudoshi/Github/Parthenon/frontend/src/features/commons/components/wiki/WikiPage.tsx)
- [2026-04-06-llm-maintained-wiki.md](/home/smudoshi/Github/Parthenon/docs/devlog/modules/commons/2026-04-06-llm-maintained-wiki.md)
