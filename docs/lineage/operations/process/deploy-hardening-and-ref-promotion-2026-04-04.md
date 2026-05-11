# Deploy Hardening and Safe Ref Promotion — 2026-04-04

## Summary

This pass hardened Parthenon's deployment path in two places:

1. `deploy.sh` now performs post-deploy smoke checks against the public host and exits non-zero on critical failures.
2. `deploy-ref.sh` was added as a separate server-side promotion wrapper so a specific tested commit, tag, or branch can be deployed without giving CI direct shell access to the server.

The immediate trigger was a production regression where the Jobs page and other frontend routes returned `403 Forbidden` even though the application code itself was healthy.

## Incident

**Symptom:** `https://parthenon.acumenus.net/jobs` returned `403 Forbidden`. The same issue affected `/` and `/login`.

**Root cause:** Apache serves the SPA directly from `frontend/dist`. A frontend deploy left the built files and directories with permissions too restrictive for the `www-data` user, so Apache could not traverse or read the deployed assets.

**What made this a process failure:** the deploy path treated "build succeeded" as success, but had no public-route verification step to confirm the site was actually serving.

## Hardening Applied

### 1. Frontend deploy permission normalization

`deploy.sh` already builds the frontend. It now also normalizes the generated output so Apache can always read it:

- directories under `frontend/dist` are set to `755`
- files under `frontend/dist` are set to `644`

This prevents the specific `403` failure mode caused by restrictive build artifacts.

### 2. Post-deploy smoke checks

`deploy.sh` now resolves a smoke-test base URL from:

1. `DEPLOY_SMOKE_BASE_URL` if provided
2. `APP_URL` from `backend/.env`
3. fallback: `https://parthenon.acumenus.net`

The script then runs route checks appropriate to the deploy mode:

- frontend/full deploys:
  - `/` -> `200`
  - `/login` -> `200`
  - `/jobs` -> `200`
- PHP / DB / OpenAPI deploys:
  - `/sanctum/csrf-cookie` -> `204`
  - `/api/v1/nonexistent-endpoint` -> `404`
- docs deploys:
  - `/docs/` -> `200`

If any critical smoke check fails, `deploy.sh` now exits with a non-zero status instead of printing a soft warning.

### 3. Safe ref promotion wrapper

`deploy-ref.sh` was added as a separate promotion path for server-side releases.

Its purpose is to support the model:

- CI validates code
- the server deploys code

instead of allowing GitHub Actions to push arbitrary shell commands into the live environment.

`deploy-ref.sh`:

- fetches from a chosen remote before resolving the target ref
- accepts a commit SHA, tag, or branch
- prefers `origin/<branch>` for plain branch names after fetch
- keeps `HEAD`, explicit refs, and raw SHAs local
- refuses a dirty checkout by default
- switches the repo to a detached HEAD at the target commit
- runs `./deploy.sh` with any forwarded deploy flags
- records a promotion log in `backups/deploy-ref-history.log`
- writes `.last-deployed-sha` and `.last-deployed-ref` on success

This preserves the fast inner-loop workflow for daily development while adding a safer path for promoting known-good refs.

## Operational Model Going Forward

Rapid development still uses `./deploy.sh` directly on the server for near-real-time iteration.

Promotion of tested code should use:

```bash
./deploy-ref.sh main
./deploy-ref.sh v1.0.4
./deploy-ref.sh a1b2c3d -- --frontend
```

This keeps CI as the quality gate, but avoids making the production server dependent on CI-driven remote shell access.

## Verification

- `bash -n deploy.sh` passed after the smoke-check changes
- `./deploy.sh --frontend` completed successfully and the smoke checks passed live against `https://parthenon.acumenus.net`
- `bash -n deploy-ref.sh` passed
- `./deploy-ref.sh --allow-dirty --dry-run HEAD` resolved the local current commit correctly
- `./deploy-ref.sh --allow-dirty --dry-run main -- --frontend` resolved `origin/main` correctly after fetch

## Files Changed

| File | Change |
|------|--------|
| `deploy.sh` | Added frontend permission normalization, post-deploy smoke checks, and non-zero exit on deploy failure |
| `deploy-ref.sh` | Added new server-side ref promotion wrapper |
| `README.md` | Documented safe ref promotion usage |

## Remaining Risk

The main remaining process risk is bypassing `deploy.sh` or `deploy-ref.sh` and mutating the live checkout manually. The scripts are now safer, but they only protect the paths that are actually used.

The safest long-term pattern is a dedicated clean server checkout for promotion and a separate workspace for live development, so tested ref promotion never competes with in-progress local edits.
