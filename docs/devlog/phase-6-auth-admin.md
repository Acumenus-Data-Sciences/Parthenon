# Phase 6: Auth & Multi-Tenancy — Development Log

**Date:** 2026-03-01
**Branch:** `master`
**Status:** Complete — default credentials seeded, RBAC enforced, admin panel functional, auth provider configuration wired end-to-end.

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
- `docs/devlog/phase-6-auth-admin.md` — this file
- `PLAN.md` — Phase 6 updated; Phase 8 extensively rewritten
