# Authentik SSO — Phase 7: Live Smoke Test + Production Rollout

**Date:** 2026-04-15
**Branch:** main (merged from feature/authentik-sso)
**Status:** ✅ First live SSO round-trip succeeded; `OIDC_ENABLED=true` on prod

## What Shipped

### Backend (pre-Phase 7, already merged)

- `app.user_external_identities` — durable `(provider, provider_subject)` link to `app.users`, cascade delete
- `app.oidc_email_aliases` — 5-row C-suite alias map (Authentik work email → existing Parthenon canonical email)
- Four OIDC services under `App\Services\Auth\Oidc`: handshake store (Redis, one-time code + PKCE state, single-use), discovery (JWKS cache, 1h), token validator (iss/aud/exp/nonce), reconciliation (sub → email → alias → JIT-create, additive-only roles)
- `GET /api/v1/auth/oidc/{redirect,callback}` + `POST /api/v1/auth/oidc/exchange` — public routes, flag-gated; each returns 404 when `OIDC_ENABLED=false`
- `GET /api/v1/auth/providers` — always reachable; drives login-page button visibility
- 38 unit + feature tests passing at merge time

### Frontend

- `/auth/callback` public route mounting `OidcCallbackPage`
- Conditional "Sign in with Authentik" button on `LoginPage`, rendered only when `/auth/providers` reports `oidc_enabled=true`

### Infra

- Authentik app `parthenon-oidc` registered via `scripts/authentik/provision_parthenon_oidc.py` (standalone stdlib Python); created provider pk=35, application, `groups` property mapping, and policy binding to group `Parthenon Admins`
- `acropolis/installer/authentik.py` extended with `parthenon-oidc` in `NATIVE_SSO_DEFS` so future clean installs provision this automatically
- `backend/.env` populated with `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`; `OIDC_ENABLED` flipped `false → true` at Phase 7 gate

## Phase 7 Ops Timeline

1. Rescued a 5-file "Desktop GUI MVP" install-page pivot from an unresolved stash-pop conflict on main into `feature/install-gui-mvp` branch (commit `8de1aeeb2`). Kept main on the "verified-release-bootstrap" landing page.
2. Stashed 40+ in-flight files (stash@{0}) to clear main for merge.
3. Merged `feature/authentik-sso` into main via `--no-ff` merge commit `86770b1b7` (10 commits of SSO work).
4. Ran Phase 1 + 2 migrations explicitly: `migrate --path=… --force` with `DB_USERNAME=parthenon_migrator`. `deploy.sh --db` ran a bare `migrate` which the 2026-03-30-incident guard correctly blocks — had to invoke migrate with explicit paths.
5. Post-migration, had to `GRANT SELECT, INSERT, UPDATE, DELETE` on both new tables + their sequences to `parthenon_app`. The migrator/runtime role split doesn't auto-propagate grants for newly created tables — follow-up task: wire this into the migration up() blocks or add a trigger.
6. Seeded 5 alias rows via `OidcEmailAliasSeeder`.
7. `./deploy.sh --frontend` built SPA with flag OFF, confirmed baseline via `/auth/providers` (`oidc_enabled: false`), confirmed local login endpoint still returns 401 on bad creds.
8. Flipped `OIDC_ENABLED=true`, `docker compose up -d php` (recreate — restart does not reload env_file).
9. First browser round-trip: Authentik auth succeeded, redirected to `/auth/callback?code=…`, but the SPA stuck on "Completing sign-in…" spinner. Apache access log showed the `POST /auth/oidc/exchange` returned 200, 1890 bytes. `app.personal_access_tokens` gained the new token, but `last_used_at=NULL` — confirmed the browser never used it. localStorage `parthenon-auth` existed as a Zustand-persist shell but held no token — `setAuth` never fired despite the 200.
10. Root cause: `useMutation(…).mutate(code, { onSuccess, onError })` inline-callback pattern didn't execute `onSuccess` in this React 19 production build. Rewrote `OidcCallbackPage` to use imperative `await apiClient.post` + try/catch — same pattern `LoginPage.handleSubmit` already uses successfully.
11. Second issue: `LoginPage` regressed to hardcoded legacy colors after the merge. Not a merge regression — the in-progress auth-token CSS refactor lived entirely in stash@{0}. Surgically restored 3 files from the stash: new `frontend/src/styles/components/auth.css` (52 lines, with `html.light { --auth-page-bg: var(--surface-base); --auth-panel-bg: url('/sunlight.jpg'); … }`), `@import` in `frontend/src/index.css`, and the token-swap patch for `LoginPage.tsx`. The rest of stash@{0} remains untouched for later resume.
12. Copied `external/artwork/sunlight.jpg` (1.2 MB) into `frontend/public/sunlight.jpg` so Vite serves it at `/sunlight.jpg` — required by `html.light --auth-panel-bg`.
13. Second round-trip: login succeeded end-to-end. `admin@acumenus.net` (id 117) `last_login_at` bumped, `app.user_external_identities` gained one row linking `provider_subject=7cdd88e9…` to user 117 via alias (`sudoshi@acumenus.io` → `admin@acumenus.net`). **No duplicate user. Existing `super-admin` role preserved (no roles added).**

## Reconciliation Evidence (post-Phase 7)

```
 id  |       email        |    last_login_at
-----+--------------------+---------------------
 117 | admin@acumenus.net | 2026-04-15 20:26:05

 user_id | provider  | sub (prefix)     | provider_email_at_link | linked_at
---------+-----------+------------------+------------------------+---------------------
     117 | authentik | 7cdd88e9934a731e | sudoshi@acumenus.io    | 2026-04-15 20:03:15
```

## Guardrails that held

- HIGHSEC additive-only: no existing auth endpoint modified or removed, `ChangePasswordModal` and `SetupWizard` flows untouched
- Additive-only roles: linked-by-alias path did not touch `model_has_roles`; super-admin preserved byte-for-byte
- Sanctum token never appeared in a URL (one-time-code exchange via Redis, 60s TTL)
- Discovery URL exposes `scopes_supported=[email, openid, profile, groups]` + `groups` in claims_supported — JIT path is viable
- Local login still works (401 on bad creds during baseline)
- Migration guard blocked bare `migrate` on prod as designed (2026-03-30 incident protection)

## Outstanding

- **Phase 8** (paused): smoke test `dmuraco`/`jdawe` alias + email paths, plus `lmiller` JIT path. Authentik policy binding confirmed all 7 C-suite are in `Parthenon Admins`, so they'll be admitted.
- **Phase 9**: monitoring/alerts on `oidc_failed` error spikes, tag `auth-oidc-v1-shipped`.
- **Follow-up A**: automate `GRANT` to `parthenon_app` in migration up() blocks (or a post-migrate hook) to avoid the manual grant step.
- **Follow-up B**: resume the auth-token CSS refactor + 37 other WIP files still sitting in stash@{0}.
- **Follow-up C**: install-page Desktop GUI MVP pivot lives at branch `feature/install-gui-mvp` awaiting product decision.

## Rollback

If SSO misbehaves: `sed -i 's/^OIDC_ENABLED=true$/OIDC_ENABLED=false/' /home/smudoshi/Github/Parthenon/backend/.env && docker compose up -d php`. Button disappears, redirect/callback/exchange routes return 404, local login unaffected. `app.user_external_identities` rows stay (harmless).

To scrub Sanjay's SSO link without touching the account: `delete from app.user_external_identities where user_id=117 and provider='authentik';`.
