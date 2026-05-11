# Authentik SSO for Parthenon Handoff

**Date:** 2026-04-13  
**Status:** Ready for implementation  
**Goal:** Finish Authentik SSO for Parthenon with a login-page button and safe account reconciliation so existing Parthenon accounts are linked, not duplicated.

## Repository Context

Work in `/home/smudoshi/Github/Parthenon`.

Important repo instruction:

- For frontend deployment in this repo, use `./deploy.sh --frontend`, not `npm run build`.

## Current State

Authentik is running in the Acropolis stack:

- `acropolis-authentik-server`
- `acropolis-authentik-db`
- `acropolis-authentik-worker`
- `acropolis-authentik-redis`

Parthenon local containers are also running:

- `parthenon-php`
- `parthenon-postgres`
- `parthenon-nginx`
- related Parthenon services

A local Parthenon DB query showed only one local user, `admin@acumenus.net` with `super-admin`. The human says David, John, and Sanjay already have Parthenon accounts, so verify the target environment before assuming the local DB is authoritative.

## Authentik C-Suite Accounts

The C-suite accounts were normalized in Authentik to the standard `first initial + last name` username format and work email as the primary email.

All seven were added to both groups:

- `authentik Admins`, where `is_superuser=true`
- `Parthenon Admins`, where `is_superuser=false`

Accounts:

| Username | Name | Primary Email | Personal Alias | Role |
|---|---|---|---|---|
| `sudoshi` | Sanjay Udoshi | `sudoshi@acumenus.io` | `sudoshi@mac.com` | Chief Medical Informatics Officer |
| `ebruno` | Emily Bruno | `ebruno@acumenus.net` | `brunoemilyk@gmail.com` | CEO |
| `kpatel` | Kash Patel | `kpatel@acumenus.net` | `kash37@yahoo.com` | CIO |
| `jdawe` | John Dawe | `jdawe@acumenus.io` | `john.dawe@gmail.com` | COO |
| `dmuraco` | David Muraco | `dmuraco@acumenus.io` | `david.muraco@gmail.com` | CTO |
| `gbock` | Glenn Bock | `gbock@acumenus.net` | `ghbock1@gmail.com` | Chief Science Officer |
| `lmiller` | Lisa Miller | `lmiller@acumenus.net` | `Lisa@lisatmiller.com` | Chief Strategy Officer |

A starter Authentik password was set for all seven by user request. Do not echo the password into logs, docs, final output, PR descriptions, or generated scripts unless the human explicitly asks. Their Authentik attributes include `must_rotate_password=true`.

## Current Parthenon Auth Architecture

Frontend login page:

- `frontend/src/features/auth/pages/LoginPage.tsx`
- Currently posts local credentials to `/api/v1/auth/login`.
- Stores `{ token, user }` via `useAuthStore().setAuth`.

Frontend API client:

- `frontend/src/lib/api-client.ts`
- Base URL is `/api/v1`.
- Sends the bearer token from the persisted `parthenon-auth` Zustand store.

Frontend router:

- `frontend/src/app/router.tsx`
- Unauthenticated users redirect to `/login`.

Backend auth controller:

- `backend/app/Http/Controllers/Api/V1/AuthController.php`
- Currently supports local register, login, current user, change password, forgot password, and logout.
- It does not yet implement OIDC redirect/callback.

Admin auth provider configuration exists, but it is mainly config/test surface:

- `backend/app/Http/Controllers/Api/V1/Admin/AuthProviderController.php`
- `backend/app/Models/App/AuthProviderSetting.php`
- `backend/database/seeders/AuthProviderSeeder.php`

OIDC settings currently include:

- `client_id`
- `client_secret`
- `discovery_url`
- `redirect_uri`
- `scopes`
- `pkce_enabled`

Routes file:

- `backend/routes/api.php`
- Public auth routes currently include `/auth/login`, `/auth/register`, and `/auth/forgot-password`.
- Admin auth providers are under `/admin/auth-providers`.

Composer:

- `backend/composer.json` already includes `firebase/php-jwt`.
- It does not currently include Socialite.

## Implementation Tasks

### 1. Add Durable Identity Linking

Add a migration/model for something like `user_external_identities`.

Suggested fields:

- `id`
- `user_id` foreign key to `users`
- `provider`, e.g. `authentik`
- `provider_subject`, the OIDC `sub`
- `provider_email_at_link`, nullable string
- `linked_at`, timestamp
- `created_at`
- `updated_at`

Add these indexes:

- Unique index on `(provider, provider_subject)`
- Optional index on `(provider, provider_email_at_link)`

Be careful with delete behavior. Cascading from user to identity link is reasonable, but do not allow identity rows to cause account deletion.

### 2. Add Approved Alias Reconciliation

The safest long-term target is canonical Parthenon emails matching Authentik work emails.

For migration, support these aliases:

| Personal Alias | Canonical Work Email |
|---|---|
| `sudoshi@mac.com` | `sudoshi@acumenus.io` |
| `brunoemilyk@gmail.com` | `ebruno@acumenus.net` |
| `kash37@yahoo.com` | `kpatel@acumenus.net` |
| `john.dawe@gmail.com` | `jdawe@acumenus.io` |
| `david.muraco@gmail.com` | `dmuraco@acumenus.io` |
| `ghbock1@gmail.com` | `gbock@acumenus.net` |
| `lisa@lisatmiller.com` | `lmiller@acumenus.net` |

Prefer a small config file or DB table over hard-coding aliases inside controller logic. Never do fuzzy name matching.

### 3. Add Backend OIDC Endpoints

Add public routes:

- `GET /api/v1/auth/oidc/redirect`
- `GET /api/v1/auth/oidc/callback`

Redirect endpoint:

- Load the enabled `oidc` provider from `auth_provider_settings`.
- Use Authentik discovery metadata.
- Generate and store `state` and `nonce` in the session.
- Redirect to the Authentik authorization endpoint.

Callback endpoint:

- Validate `state`.
- Exchange `code` for tokens server-side.
- Validate the ID token:
  - JWKS signature
  - issuer
  - audience/client ID
  - expiry
  - nonce
- Require `sub`, `email`, and `name`.
- Require the user to be in `Parthenon Admins` or another explicitly allowed group before just-in-time creation.

Reconcile in this order:

1. Existing `user_external_identities.provider = 'authentik'` plus matching `provider_subject = sub`.
2. Exact lowercased canonical email match against `users.email`.
3. Approved alias map to canonical email, then match/create by canonical.
4. Only if group-approved, create a new user.

After resolving the user:

- Create or update the external identity link.
- Sync role from Authentik group:
  - `Parthenon Admins` -> Parthenon `admin`
  - Do not map `authentik Admins` to `super-admin` unless the human explicitly approves.
- Issue a Sanctum token using `$user->createToken('auth-token')->plainTextToken`.
- Update `last_login_at`.
- Write an audit log entry consistent with local login.
- Return the auth result to the SPA safely.

### 4. Decide Callback Delivery Pattern

The current SPA expects token/user in frontend state.

Avoid putting the Sanctum token directly in a URL query string. Better options:

1. Backend callback stores the auth result under a short one-time code and redirects to `/auth/callback?code=...`.
2. Frontend route calls `POST /api/v1/auth/oidc/exchange` with the code.
3. Backend returns `{ token, user }`.
4. Frontend calls `setAuth(token, user)` and navigates to `/`.

If using this pattern, add:

- Backend route: `POST /api/v1/auth/oidc/exchange`
- Frontend route: `/auth/callback`
- A small frontend callback page/component that exchanges the one-time code, updates `useAuthStore`, and navigates home.

### 5. Add the Frontend Login Button

In `frontend/src/features/auth/pages/LoginPage.tsx`, add a button or link under or above the local sign-in button.

Suggested target:

```tsx
<a href="/api/v1/auth/oidc/redirect">
  Sign in with Authentik
</a>
```

Keep local email/password login as a fallback. Do not overhaul the login page design.

### 6. Register Authentik App/Provider

Use Authentik app slug:

- `parthenon-oidc`

Production redirect URI:

- `https://parthenon.acumenus.net/api/v1/auth/oidc/callback`

If local development is needed, add a matching local redirect URI for the local app URL.

Scopes:

- `openid profile email`

Likely discovery URL:

- `https://auth.acumenus.net/application/o/parthenon-oidc/.well-known/openid-configuration`

Existing automation:

- `acropolis/installer/authentik.py`

That file already creates OIDC providers for Grafana, Superset, pgAdmin, DataHub, and Portainer via `NATIVE_SSO_DEFS`. Extend that pattern or add a one-off idempotent function for Parthenon.

Store the Authentik client ID/secret into Parthenon's OIDC provider settings in `auth_provider_settings` or into env/config, depending on the repo's existing conventions.

## Test Plan

Backend tests:

- Existing external identity links directly.
- Exact canonical email links to the existing user.
- Personal email alias maps to canonical existing account.
- No duplicate user is created.
- User without approved group cannot create/login.
- `Parthenon Admins` maps to `admin`, not `super-admin`.

Frontend tests:

- Login page renders the Authentik button.
- The button/link points at `/api/v1/auth/oidc/redirect`.

Manual smoke:

1. Test with `sudoshi` first.
2. Confirm the user lands in Parthenon authenticated state.
3. Confirm `app.users` has no duplicate for the same person.
4. Confirm `user_external_identities` contains the Authentik `sub`.
5. Test `dmuraco`, `jdawe`, and one newly created user such as `lmiller`.

## Useful Commands

Authentik user/group verification:

```bash
docker exec acropolis-authentik-db psql -U authentik -d authentik -c "select u.username, u.name, u.email, string_agg(g.name, ', ' order by g.name) as groups from authentik_core_user u join authentik_core_user_groups ug on ug.user_id=u.id join authentik_core_group g on g.group_uuid=ug.group_id group by u.username, u.name, u.email order by u.username;"
```

Parthenon user verification:

```bash
docker exec parthenon-postgres psql -U parthenon -d parthenon -c "select u.id, u.name, u.email, coalesce(string_agg(r.name, ', ' order by r.name), '') as roles from app.users u left join app.model_has_roles mhr on mhr.model_id=u.id and mhr.model_type='App\\Models\\User' left join app.roles r on r.id=mhr.role_id group by u.id, u.name, u.email order by u.email;"
```

Authentik Django shell:

```bash
docker exec acropolis-authentik-server ak shell -c "..."
```

Do not print secrets, password hashes, or starter passwords in final output.

## Deliverables

- Migration/model for external identities or equivalent.
- Backend OIDC redirect/callback/exchange implementation.
- Authentik provider registration/config instructions or automation.
- Login page Authentik button.
- Focused tests.
- Concise summary of verification.
