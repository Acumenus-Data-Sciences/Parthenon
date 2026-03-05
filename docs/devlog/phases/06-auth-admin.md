# Phase 6: Auth & Multi-Tenancy — Development Log

**Date:** 2026-03-01 (Phase 6) / 2026-03-02 (Auth Regime addendum)
**Branch:** `master`
**Status:** Complete — default credentials seeded, RBAC enforced, admin panel functional, auth provider configuration wired end-to-end. Addendum: full auth regime implemented (temp passwords, must-change-password flow, rate limiting, ChangePasswordModal, RegisterPage).

---

## Overview

Phase 6 activates the authentication and administration layer that was scaffolded but unimplemented in Phase 1. The work covers four areas:

1. **Default admin account** — `admin@parthenon.local / superuser` seeded on every fresh `db:seed`.
2. **RBAC** — 6 platform roles and 80+ granular permissions across 15 domains, enforced at the API route level via Spatie's `role:` middleware.
3. **Admin API** — Three controllers (User, Role, AuthProvider) mounted under `/api/v1/admin/`, gated by role.
4. **Admin frontend** — Full administration feature: user management, roles & permissions (including a spreadsheet-style permission matrix for bulk edits), and a per-provider auth configuration panel covering LDAP/AD, OAuth 2.0, SAML 2.0, and OIDC.

PLAN.md Phase 6 and Phase 8 (testing section) were also extensively revised during this session.

---

## What Was Built

### Step 6A: Default Credentials & Seeding

**`DatabaseSeeder.php`** — Rewritten to call two child seeders before creating the admin user.

```
DatabaseSeeder
  ├── RolePermissionSeeder   (roles + permissions)
  ├── AuthProviderSeeder     (one row per provider, all disabled)
  └── admin@parthenon.local  (super-admin, password: superuser)
```

`firstOrCreate` used throughout so re-running `php artisan db:seed` is idempotent.

**`RolePermissionSeeder.php`** — Defines the full permission taxonomy and role assignments:

| Role | Description |
|---|---|
| `super-admin` | All permissions (auto-synced) |
| `admin` | User/role/auth management + sources + system |
| `researcher` | Cohorts, concept sets, analyses, studies, vocabulary (read) |
| `data-steward` | Sources, ingestion pipeline, mapping, DQD/Achilles, vocabulary management |
| `mapping-reviewer` | Ingestion view + mapping review only |
| `viewer` | Read-only across all research domains |

Permission naming convention: `{domain}.{action}` — e.g. `cohorts.generate`, `mapping.override`, `system.view-horizon`. 15 domains, 80+ permission nodes. `super-admin` receives all permissions via `syncPermissions($all)` so adding a new permission node automatically propagates.

**`AuthProviderSeeder.php`** — Inserts one row per provider type (ldap, oauth2, saml2, oidc) into `auth_provider_settings`. All disabled by default. Settings stored as `encrypted:array` (AES-256-CBC via Laravel's app key).

---

### Step 6B: `auth_provider_settings` Table & Model

**Migration** `2026_03_01_180000_create_auth_provider_settings_table.php`:
- `provider_type` — unique string enum (ldap | oauth2 | saml2 | oidc)
- `is_enabled` — boolean, default false
- `priority` — integer for login-page ordering
- `settings` — `jsonb`, application-level encrypted
- `updated_by` — nullable FK to `users`

**`AuthProviderSetting` model** — `settings` cast as `encrypted:array`. Sensitive fields (bind passwords, client secrets, IdP certificates) never hit the database in plaintext.

---

### Step 6C: Admin API Controllers

All three controllers live in `App\Http\Controllers\Api\V1\Admin\`. Routes are mounted at `/api/v1/admin/` behind `auth:sanctum` + `role:admin|super-admin`. Role/permission and auth-provider sub-routes additionally require `role:super-admin`.

#### `UserController` (7 endpoints)

| Method | Route | Description |
|---|---|---|
| GET | `/admin/users` | Paginated, filterable (search, role), sortable user list |
| POST | `/admin/users` | Create user with role assignment |
| GET | `/admin/users/{user}` | Single user with full role+permission detail |
| PUT | `/admin/users/{user}` | Update name/email/password/roles |
| DELETE | `/admin/users/{user}` | Delete user + revoke all tokens |
| PUT | `/admin/users/{user}/roles` | Sync role set |
| GET | `/admin/users/roles` | Available roles list (for dropdowns) |

Safety guard: deleting or demoting the last `super-admin` returns HTTP 422 with an explanatory message.

#### `RoleController` (6 endpoints + permissions index)

| Method | Route | Description |
|---|---|---|
| GET | `/admin/roles` | All roles with `users_count` and permissions |
| POST | `/admin/roles` | Create custom role |
| GET | `/admin/roles/{role}` | Single role |
| PUT | `/admin/roles/{role}` | Update name or permission set |
| DELETE | `/admin/roles/{role}` | Delete (blocked for built-in roles) |
| GET | `/admin/roles/permissions` | All permissions grouped by domain |

Built-in roles (`super-admin`, `admin`, `researcher`, `data-steward`, `mapping-reviewer`, `viewer`) are protected from rename and deletion. `super-admin` permissions cannot be manually changed.

#### `AuthProviderController` (6 endpoints)

| Method | Route | Description |
|---|---|---|
| GET | `/admin/auth-providers` | All providers ordered by priority |
| GET | `/admin/auth-providers/{type}` | Single provider settings |
| PUT | `/admin/auth-providers/{type}` | Partial-merge settings update |
| POST | `/admin/auth-providers/{type}/enable` | Enable provider |
| POST | `/admin/auth-providers/{type}/disable` | Disable provider |
| POST | `/admin/auth-providers/{type}/test` | Live connectivity test |

The `update` endpoint **merges** the incoming `settings` object with the existing row — sending `{ "host": "ldap2.example.com" }` updates only that field; no other settings are cleared.

Live test support:
- **LDAP**: opens a real TCP connection, attempts `ldap_bind`, returns bind error string on failure.
- **OIDC**: fetches the discovery document URL, returns issuer + authorization/token endpoint from the parsed JSON.

#### `AuthController::user()` update

Now returns `roles[]` (array of role name strings) and `permissions[]` (array of all resolved permission names) alongside the standard user fields. These are stored in the frontend auth store and used for role-gated UI rendering.

---

### Step 6D: Frontend Administration Feature

New feature directory: `frontend/src/features/administration/`

```
administration/
├── api/adminApi.ts              (all fetch functions for users, roles, providers)
├── hooks/
│   ├── useAdminUsers.ts         (TanStack Query + mutations)
│   ├── useAdminRoles.ts
│   └── useAuthProviders.ts
├── components/
│   ├── UserModal.tsx            (create/edit modal with role multi-select)
│   ├── PermissionMatrix.tsx     (bulk grid editor — see below)
│   ├── LdapConfigForm.tsx
│   ├── OAuth2ConfigForm.tsx
│   ├── Saml2ConfigForm.tsx
│   └── OidcConfigForm.tsx
└── pages/
    ├── AdminDashboardPage.tsx   (stats + nav cards)
    ├── UsersPage.tsx            (table + CRUD)
    ├── RolesPage.tsx            (role list + matrix tab)
    └── AuthProvidersPage.tsx    (provider cards + config drawers)
```

#### Users Page

- Paginated, sortable (name, email, last login, joined), filterable by role
- Per-row edit (opens modal) and delete (confirmation dialog)
- Avatar initial letter rendered from name; last login formatted locale-aware
- Role badges colour-coded by role name
- Prevents accidental deletion via explicit confirmation text

#### Roles Page — two tabs

**Role List tab:** Each role shown as a card with permission chips (first 8 + overflow count). Click edit to open an inline accordion editor. Domain sections are collapsible; the domain-level checkbox is indeterminate when partially selected.

**Permission Matrix tab (`PermissionMatrix.tsx`):**

The key feature for bulk permission management. A spreadsheet-style grid:

- **Columns** = editable roles (super-admin excluded as read-only)
- **Rows** = individual permissions, grouped by domain with a domain section header row
- **Cell click** — toggles a single permission for a single role
- **Row header click** — toggles that permission across ALL roles simultaneously
- **Domain section header click** — toggles ALL permissions in that domain across ALL roles
- **Column header click** — grants/revokes ALL permissions for that role
- Indeterminate checkbox indicators on domain headers when partially selected
- Per-column "save" link appears when that role has unsaved changes; "Save All" button saves all dirty roles in one click
- No full-page refresh — all state local, mutations go to the same `PUT /admin/roles/{id}` endpoint

#### Auth Providers Page

One card per provider, ordered by priority. Each card shows:
- Icon + description
- Enable/disable toggle (calls enable/disable endpoints immediately)
- "Configure" button expands an inline config form

Provider-specific forms:

**LDAP** — host, port, SSL/TLS checkboxes, timeout, bind DN/password, user search base, user filter (`{username}` token documented), attribute mapping (username/email/name fields), optional group sync section (search base + filter) revealed by checkbox.

**OAuth 2.0** — driver selector (GitHub / Google / Microsoft / Custom); custom driver reveals three extra URL fields (auth, token, userinfo). Scope field is a space-separated string mapped to/from an array.

**SAML 2.0** — IdP entity ID, SSO URL, SLO URL, IdP certificate textarea (PEM), SP entity ID, ACS URL, SLO URL, NameID format selector (4 standard formats), sign-assertions checkbox, attribute mapping (email + name).

**OIDC** — discovery URL, client ID/secret, redirect URI, scopes, PKCE toggle.

All forms have a "Save" button with a `✓ Saved` flash indicator (disappears after 3 s). LDAP and OIDC forms additionally show a "Test Connection" button that calls the backend test endpoint and displays the result inline.

The "Username & Password" Sanctum provider is shown as an always-on card at the top with the default credentials documented.

#### Auth Store

Extended `useAuthStore` with:
- `hasRole(role | role[])` — returns true if user has any of the given roles
- `hasPermission(permission)` — checks the full resolved permission list
- `isAdmin()` — true for `admin` or `super-admin`
- `isSuperAdmin()` — true for `super-admin` only

#### Sidebar

- Administration link now only renders for users with admin or super-admin roles
- When the `/admin` route is active and the sidebar is expanded, sub-links appear:
  - **Users** (all admins)
  - **Roles & Permissions** (super-admin only)
  - **Auth Providers** (super-admin only)
- Sub-links filtered by role before rendering — non-super-admins cannot see or navigate to the roles/auth-provider pages

---

### Step 6E: PLAN.md Revisions

Two major revisions committed in this session:

**Phase 8 (Testing)** — Expanded from a 6-row table to a 14-subsection specification covering: testing philosophy, static analysis (PHPStan L8, mypy strict, Ruff), PHP Pest structure + coverage targets + key patterns, TypeScript Vitest structure, Playwright E2E critical paths + POM pattern, Python pytest + accuracy benchmarks, R testthat, CI/CD pipeline definition with coverage gates, contract testing (Schemathesis + consumer-driven), mutation testing (Infection + mutmut), k6 load testing targets, and OWASP ZAP security scanning.

**Phase 6 (Auth)** — Updated to reflect actual implementation: default credentials documented, admin panel scope described.

---

## Architectural Notes

### Settings encryption

`auth_provider_settings.settings` is cast as `encrypted:array` in the model. Laravel uses AES-256-CBC keyed from `APP_KEY`. This means LDAP bind passwords, OAuth client secrets, and SAML IdP certificates are never stored in plaintext. The tradeoff: the column cannot be queried by its JSON contents, which is fine since we only ever fetch by `provider_type`.

### Role middleware

Routes use Spatie's `role:admin|super-admin` syntax on the outer group and `role:super-admin` on the inner groups. This means a plain `admin` user can manage users but cannot touch roles or auth providers — matches the security model in the seeder.

### Super-admin protection

Two places guard against self-lockout:
1. `UserController::destroy` — refuses if the user being deleted is the last `super-admin`.
2. `UserController::update` + `syncRoles` — refuses to remove `super-admin` from a user if they are the only `super-admin`.

Both return HTTP 422 with a descriptive message rather than silently failing.

---

## Files Changed / Created

### Backend (new)
- `app/Http/Controllers/Api/V1/Admin/UserController.php`
- `app/Http/Controllers/Api/V1/Admin/RoleController.php`
- `app/Http/Controllers/Api/V1/Admin/AuthProviderController.php`
- `app/Models/App/AuthProviderSetting.php`
- `database/migrations/2026_03_01_180000_create_auth_provider_settings_table.php`
- `database/seeders/RolePermissionSeeder.php`
- `database/seeders/AuthProviderSeeder.php`

### Backend (modified)
- `database/seeders/DatabaseSeeder.php` — calls child seeders, creates admin account
- `app/Http/Controllers/Api/V1/AuthController.php` — `user()` returns roles + permissions
- `routes/api.php` — admin route group added

### Frontend (new)
- `features/administration/api/adminApi.ts`
- `features/administration/hooks/useAdminUsers.ts`
- `features/administration/hooks/useAdminRoles.ts`
- `features/administration/hooks/useAuthProviders.ts`
- `features/administration/components/UserModal.tsx`
- `features/administration/components/PermissionMatrix.tsx`
- `features/administration/components/LdapConfigForm.tsx`
- `features/administration/components/OAuth2ConfigForm.tsx`
- `features/administration/components/Saml2ConfigForm.tsx`
- `features/administration/components/OidcConfigForm.tsx`
- `features/administration/pages/AdminDashboardPage.tsx`
- `features/administration/pages/UsersPage.tsx`
- `features/administration/pages/RolesPage.tsx`
- `features/administration/pages/AuthProvidersPage.tsx`

### Frontend (modified)
- `stores/authStore.ts` — role/permission helpers
- `types/models.ts` — Role, Permission, AuthProviderSetting types
- `app/router.tsx` — nested `/admin/*` routes
- `components/layout/Sidebar.tsx` — role-gated admin links + sub-navigation

### Docs
- `docs/devlog/phases/06-auth-admin.md` — this file
- `docs/devlog/strategy/PLAN.md` — Phase 6 updated; Phase 8 extensively rewritten

---

## Auth Regime Addendum (2026-03-02)

### Overview

After the initial Phase 6 delivery, the full auth regime from `docs/devlog/architecture/authregime.md` was implemented. This adapts the Node.js/Express auth pattern from that document to Parthenon's Laravel/React stack. The core additions are:

- **Temp password registration flow** — users register with email + name only; a generated temp password is emailed to them
- **`must_change_password` enforcement** — blocking modal on first login, cleared only after password change
- **`POST /api/v1/auth/change-password`** — protected endpoint that verifies current password, updates hash, and returns updated user
- **Login rate limiting** — `throttle:5,15` middleware (5 attempts per 15 minutes per IP, built into Laravel)
- **Resend email integration** — auto-configured from `.resendapikey` file at repo root via AppServiceProvider
- **`php artisan admin:seed`** — interactive Artisan command to create/update the super-admin account
- **Frontend gate** — `ProtectedLayout` component in the router redirects to `/login` when unauthenticated
- **RegisterPage** — `/register` route with success state (shows "check your email" after submit)

---

### Step 6F: Backend Auth Regime

#### Migration — `must_change_password`

`2026_03_02_300000_add_must_change_password_to_users_table.php` adds a `must_change_password` boolean (default `true`) to the `users` table. Existing users were backfilled to `false` on deploy. New users created via the public `/auth/register` endpoint always start with `true`; the admin seed command always sets `false`.

#### `AuthController` rewrite

The full controller was rewritten with these methods:

| Method | Endpoint | Key behaviours |
|---|---|---|
| `register()` | `POST /auth/register` | Takes `name`, `email`, optional `phone_number`. Generates 12-char temp password (no ambiguous chars: `0/O/1/l/I`). Emails via `TempPasswordMail`. Always returns the same success message whether email is new or existing (prevents enumeration). Non-fatal email failure: logs temp password to `laravel.log`. |
| `login()` | `POST /auth/login` | Returns same `"Invalid credentials"` for unknown email AND wrong password (prevents enumeration). Includes `must_change_password` in response user object. |
| `changePassword()` | `POST /auth/change-password` | Requires `auth:sanctum`. Verifies current password, rejects same-as-current new password, updates hash, sets `must_change_password=false`, returns updated user object. |
| `user()` | `GET /auth/user` | Now uses shared `formatUser()` helper, includes `must_change_password`. |
| `logout()` | `POST /auth/logout` | Unchanged. |

The `formatUser()` private helper centralises the user array shape, ensuring every endpoint returns the same fields.

Temp password generation uses `random_int()` (CSPRNG, not `rand()`):
```php
$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
// 12 chars from this set — no 0/O/1/l/I ambiguity
```

#### Rate limiting

`throttle:5,15` middleware applied directly on the login route:
```php
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,15');
```
5 requests per 15-minute window per IP. Laravel uses the cache driver for the counter — clearing `php artisan cache:clear` resets it in development. Returns HTTP 429 with `Retry-After` header when exceeded.

#### Admin `UserController` update

`Admin\UserController::store()` now also supports the temp-password flow. `send_temp_password` (boolean, defaults to `true`) controls whether a generated password is emailed or a caller-supplied password is used. This means admins creating users via the panel get the same first-login flow as self-registered users.

#### Artisan admin seed command

`php artisan admin:seed` — interactive, safe to re-run:
- Prompts for email, name, password (hidden), confirmation
- Uses `User::updateOrCreate()` (upsert on email)
- Sets `must_change_password=false`, `email_verified_at=now()`
- Ensures `super-admin` and `admin` roles exist via `firstOrCreate`
- Assigns `super-admin` role

```bash
php artisan admin:seed
# > Admin email: admin@example.com
# > Admin name: Super Admin
# > Password: ********
# ✓ Created super-admin: admin@example.com
```

#### Resend email integration

`AppServiceProvider::boot()` reads `.resendapikey` from the project root (two levels above `backend/`):

```php
$keyFile = base_path('../../.resendapikey');
$key = is_readable($keyFile) ? trim((string) file_get_contents($keyFile)) : '';

if ($key !== '') {
    config([
        'mail.default'                  => 'resend',
        'mail.mailers.resend.transport' => 'resend',
        'resend.api_key'                => $key,
    ]);
}
```

Laravel 11.31 includes native Resend mail transport — no extra package required. When `.resendapikey` is empty or absent, the app falls back to `MAIL_MAILER` from `.env` (default: `log`). In `log` mode, the temp password appears in `storage/logs/laravel.log` under a `WARNING` entry — useful for development and for admin recovery.

The `TempPasswordMail` Mailable renders `resources/views/emails/temp-password.blade.php` — a dark-themed HTML email consistent with the app's visual identity.

---

### Step 6G: Frontend Auth Regime

#### `User` type update

Added `must_change_password: boolean` and `phone_number: string | null` to the `User` interface in `types/models.ts`.

#### Auth store

Added `updateUser(user: User)` action — updates the `user` slice in the Zustand store without touching the token or `isAuthenticated` flag. Used by `ChangePasswordModal` after a successful password change.

#### `ChangePasswordModal`

`features/auth/components/ChangePasswordModal.tsx` — a blocking overlay rendered on top of `MainLayout` when `user.must_change_password === true`. Key design decisions:

- **No backdrop click handler** — cannot be dismissed without completing the form
- **No close button** — intentionally non-dismissable
- `autoFocus` on the temp-password field
- On success: calls `updateUser(data.user)` — since `data.user.must_change_password` is now `false`, the modal disappears without navigation or re-login
- On error: clears the current-password field only (not the new-password fields)

#### `RegisterPage`

`features/auth/pages/RegisterPage.tsx` at `/register`. Takes name + email (no password — the server generates it). Two states:

1. **Form state** — name + email fields, "Request access" button
2. **Success state** — `CheckCircle` icon, "Check your email" message, "Go to sign in" link

Matches the LoginPage's visual style exactly (same dark glassmorphic layout, left hero, right form panel).

#### `ProtectedLayout` route guard

`router.tsx` now wraps all authenticated routes in:

```tsx
function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <MainLayout />;
}
```

Previously the app relied entirely on the API returning 401 to trigger redirect. The guard provides an immediate redirect for unauthenticated deep-link navigation.

#### `MainLayout` integration

```tsx
{user?.must_change_password && <ChangePasswordModal />}
```

Rendered before the app shell — appears above all other content with `z-index: 9999` and a blurred backdrop.

#### `LoginPage` — register link

Added "Don't have an account? **Request access**" link to the footer section, pointing to `/register`.

---

### Gotchas & Lessons Learned

#### Docker bind mount does not propagate edits

The `parthenon-php` container has `backend/` bind-mounted to `/var/www/html` but file edits made on the host are **not visible inside the container** — the inode and device differ between host and container, suggesting the image's COPY layer shadows the bind mount at the overlay filesystem level.

**Workaround:** After editing any PHP file, sync manually:
```bash
docker cp backend/path/to/file.php parthenon-php:/var/www/html/path/to/file.php
```
This is a persistent infrastructure issue that should be resolved (likely by removing the `COPY backend/ .` from the Dockerfile or by using a named volume for vendor/ and anonymous bind for src/).

**Affected files this session:**
- `routes/api.php`
- `app/Http/Controllers/Api/V1/AuthController.php`
- `app/Http/Controllers/Api/V1/Admin/UserController.php`
- `app/Models/User.php`
- `app/Providers/AppServiceProvider.php`
- `app/Mail/TempPasswordMail.php`
- `app/Console/Commands/SeedAdminCommand.php`
- `resources/views/emails/temp-password.blade.php`

#### Migrations also need manual sync

The same issue affects migration files. After writing a migration to disk, the container still runs the old version. A migration that had already been fixed on the host still ran the old (broken) version inside the container, requiring a manual `docker compose exec php sh -c 'cat > /var/www/html/...'` to push the corrected content.

#### `!` in shell JSON strings causes invalid JSON

When building curl test commands with `!` in passwords (e.g. `TestPass99!`), bash history expansion converts `!` to `\!` inside double-quoted strings. This produces `{"new_password":"TestPass99\!"}` which is invalid JSON — PHP sees an empty body and validation fails with "field required" for every field. The symptom looks exactly like the JSON body is being dropped entirely, not like an escape error.

**Fix:** Use `--data-raw` with single-quoted strings, or avoid `!` in test passwords.

#### `auth:sanctum` does NOT consume the request body

Initial debugging suggested Sanctum's `EnsureFrontendRequestsAreStateful` middleware was consuming the input stream (since `$request->all()` returned `[]` while `$request->getContent()` returned the raw body). The root cause was actually the `\!` invalid JSON — PHP's JSON decoder silently returned `null` on parse failure, making `$request->json()->all()` return `[]`, and then `$request->all()` also returned `[]` since `isJson()` was `true` but the decoded result was `null`. The Sanctum middleware is innocent.

#### Rate limiter counts ALL login attempts, not just failures

`throttle:5,15` counts every request to the login endpoint from a given IP — including successful logins. During testing, the counter accumulated across multiple curl invocations, triggering 429 earlier than expected. Use `php artisan cache:clear` to reset in development.

#### Laravel 11 Resend mail driver — no extra package

`MAIL_MAILER=resend` and `config(['mail.mailers.resend.transport' => 'resend', 'resend.api_key' => $key])` work out of the box in Laravel 11.31+. No `resend/resend-php` composer package needed.

---

### Files Changed / Created (Addendum)

#### Backend (new)
- `database/migrations/2026_03_02_300000_add_must_change_password_to_users_table.php`
- `app/Mail/TempPasswordMail.php`
- `resources/views/emails/temp-password.blade.php`
- `app/Console/Commands/SeedAdminCommand.php`

#### Backend (modified)
- `app/Models/User.php` — `must_change_password` in `$fillable` + `$casts`
- `app/Http/Controllers/Api/V1/AuthController.php` — full rewrite
- `app/Http/Controllers/Api/V1/Admin/UserController.php` — temp-password on store, `send_temp_password` flag
- `routes/api.php` — `throttle:5,15` on login, new `change-password` route
- `app/Providers/AppServiceProvider.php` — Resend auto-configuration from `.resendapikey`
- `.env.example` — `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`

#### Frontend (new)
- `src/features/auth/components/ChangePasswordModal.tsx`
- `src/features/auth/pages/RegisterPage.tsx`

#### Frontend (modified)
- `src/types/models.ts` — `must_change_password`, `phone_number` on `User`
- `src/stores/authStore.ts` — `updateUser()` action
- `src/app/router.tsx` — `ProtectedLayout` guard, `/register` route
- `src/components/layout/MainLayout.tsx` — `ChangePasswordModal` conditional render
- `src/features/auth/pages/LoginPage.tsx` — "Request access" register link
