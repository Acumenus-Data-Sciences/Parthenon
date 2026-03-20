# HIGHSEC — Parthenon Security Operations Specification

**Effective:** 2026-03-20
**Status:** ENFORCED — all development agents MUST comply
**Scope:** Every code change, Docker config edit, route addition, model creation, or infrastructure modification

---

## 1. Principle of Least Privilege

Every user, container, service, and database connection operates with the minimum permissions required for its function. Defaults are restrictive; access is granted explicitly.

### 1.1 New User Registration

New accounts receive the `viewer` role only. Promotion to `researcher`, `data-steward`, `admin`, or `super-admin` requires an existing admin's manual action.

**NEVER** assign `admin`, `researcher`, `data-steward`, or `mapping-reviewer` to newly registered users in `AuthController::register()`.

```php
// CORRECT — viewer only
$user->assignRole(['viewer']);

// WRONG — privilege escalation
$user->assignRole(['admin', 'researcher', 'data-steward', 'mapping-reviewer']);
```

### 1.2 Sanctum Token Expiration

Tokens expire after **480 minutes (8 hours)**. This is set in `backend/config/sanctum.php`. Do not set `expiration` to `null`.

---

## 2. Route Protection — Three-Layer Model

Every API route MUST pass through all three layers:

| Layer | Mechanism | What It Does |
|-------|-----------|--------------|
| **Authentication** | `auth:sanctum` middleware | Rejects unauthenticated requests |
| **Authorization** | `permission:domain.action` middleware | Enforces RBAC at the route level |
| **Ownership** | Controller-level `$this->authorize()` or policy | Ensures users only modify their own resources |

### 2.1 Route Middleware Rules

1. **Every non-public route** MUST have `auth:sanctum` middleware.
2. **Read routes** (index, show, executions) require `permission:{domain}.view`.
3. **Write routes** (store, update, destroy) require `permission:{domain}.create`.
4. **Execution routes** (execute, run, generate) require `permission:{domain}.run` or `permission:{domain}.execute`.
5. **Admin routes** require `role:admin|super-admin` or `role:super-admin`.

### 2.2 Permission Domains (from RolePermissionSeeder)

```
users       — view, create, edit, delete, impersonate
roles       — view, create, edit, delete
permissions — view, assign
auth-providers — view, configure
sources     — view, create, edit, delete
vocabulary  — view, manage
ingestion   — view, upload, run, delete
mapping     — view, review, override
cohorts     — view, create, edit, delete, generate
concept-sets — view, create, edit, delete
analyses    — view, create, edit, run, delete
studies     — view, create, edit, execute, delete
data-quality — view, run, delete
jobs        — view, cancel
profiles    — view
system      — view-horizon, view-logs, manage-config
gis         — view, load-data, import, import.manage
```

### 2.3 Adding New Routes — Checklist

When adding ANY new API route:

- [ ] Route is inside an `auth:sanctum` middleware group
- [ ] Route has `permission:` or `role:` middleware appropriate to its action
- [ ] Destructive actions (DELETE, execute) have the most restrictive permission
- [ ] Rate limiting is applied to expensive or abuse-prone endpoints
- [ ] Route does NOT expose an unauthenticated path to PHI, PII, or clinical data

**NEVER create a public (unauthenticated) route that serves patient data, medical images, clinical notes, or any OMOP CDM content.** The only public routes are: `/health`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, and `/cohort-definitions/shared/{token}` (time-limited, non-PHI).

---

## 3. Model Security

### 3.1 Mass Assignment Protection

Every Eloquent model MUST use `$fillable` to whitelist assignable attributes. **NEVER** set `$guarded = []`.

```php
// CORRECT
protected $fillable = ['concept_id', 'concept_name', 'embedding'];

// FORBIDDEN — disables all mass assignment protection
protected $guarded = [];
```

### 3.2 CdmModel (Read-Only)

Models extending `CdmModel` are read-only abstractions over OMOP CDM tables. **NEVER** add write operations (create, update, delete) to CDM models. Clinical data integrity depends on this.

---

## 4. Docker Container Security

### 4.1 Non-Root Execution

Every container MUST run as a non-root user. The following `USER` directives are enforced:

| Service | Dockerfile | User |
|---------|-----------|------|
| PHP | docker/php/ | `www-data` (via entrypoint) |
| Python AI | docker/python/Dockerfile | `appuser` |
| Node/Vite | docker/node/Dockerfile | `node` |
| Study Agent | docker/study-agent/Dockerfile | `agentuser` |
| Hecate | docker/hecate/Dockerfile | `hecate` |
| FHIR-to-CDM | docker/fhir-to-cdm/Dockerfile | `fhircdm` |
| JupyterHub | docker/jupyterhub/Dockerfile | `jupyterhub` |
| R Runtime | docker/r/Dockerfile | *(root — hardening planned)* |

When adding a new Dockerfile, ALWAYS include:
```dockerfile
RUN addgroup --system svcgroup && adduser --system --ingroup svcgroup svcuser
USER svcuser
```

### 4.2 Service Authentication

| Service | Auth Mechanism | Config Location |
|---------|---------------|-----------------|
| Redis | `--requirepass` | docker-compose.yml command + `REDIS_PASSWORD` in .env |
| Orthanc | `ORTHANC__AUTHENTICATION_ENABLED=true` | docker-compose.yml environment |
| Grafana | `GF_AUTH_ANONYMOUS_ENABLED=false` | docker-compose.yml environment |
| PostgreSQL | Password auth via `parthenon` user | docker/postgres/init.sql |
| Horizon | `Gate::define('viewHorizon')` checks `super-admin` role | HorizonServiceProvider.php |

**NEVER disable authentication** on any service. If a service needs inter-container access, use service accounts with credentials from environment variables — not open unauthenticated access.

### 4.3 Docker Socket

`/var/run/docker.sock` is mounted into JupyterHub (for spawning user containers) and Alloy (for log collection). This is a known privilege escalation vector.

**Rules:**
- Do NOT mount docker.sock into any new service without explicit authorization
- Do NOT add `privileged: true` to any container definition
- Do NOT mount `/:/rootfs` or host root filesystem into new containers

---

## 5. Secrets Management

### 5.1 File Permissions

Sensitive files MUST be `chmod 600` (owner read/write only):

```
backend/.env          — 600
.resendapikey         — 600
.claudeapikey         — 600 (if present)
```

**NEVER** commit secrets to git. The following patterns are in `.gitignore` and MUST remain:
- `*.env` (except `.env.example`)
- `.resendapikey`, `.claudeapikey`
- Any file containing API keys, JWT secrets, or database passwords

### 5.2 Environment Variables

Secrets are passed to containers via:
1. `env_file` referencing `backend/.env` (loaded at container **creation** time — `docker compose restart` does NOT reload)
2. File mounts (e.g., `.resendapikey:/run/secrets/resend:ro`)
3. `${VAR:-default}` interpolation in docker-compose.yml

**NEVER** hardcode credentials directly in docker-compose.yml, Dockerfiles, or application code. Use environment variable references.

### 5.3 Production Debug Mode

`APP_DEBUG` MUST be `false` in production. `LOG_LEVEL` MUST be `warning` or higher. Debug mode leaks stack traces, environment variables, and SQL queries.

---

## 6. RBAC Role Hierarchy

```
super-admin  →  All permissions (wildcard). Bootstrap admin only.
admin        →  User/role/source/system management. No research.
researcher   →  Full research lifecycle: cohorts, analyses, studies. No admin.
data-steward →  Data pipelines, ingestion, mapping, DQD. No study execution.
mapping-reviewer → AI concept mapping review only.
viewer       →  Read-only access to all research outputs. DEFAULT for new users.
```

### 6.1 Horizon Dashboard Access

Controlled by a Laravel Gate, not route middleware:

```php
Gate::define('viewHorizon', fn ($user) => $user && $user->hasRole('super-admin'));
```

**NEVER** use an empty email whitelist or hardcoded email list for Horizon access.

---

## 7. PHI and Clinical Data Protection

Parthenon handles OMOP CDM clinical data and MIMIC-IV ICU data (PHI under HIPAA). Special rules apply:

1. **Patient profile routes** require authentication AND `profiles.view` permission
2. **Medical imaging (WADO/DICOM)** endpoints require `auth:sanctum` — no unauthenticated image retrieval
3. **Clinical notes** endpoints require authentication — no public access to NOTE_NLP content
4. **Concept embeddings** (pgvector) may encode patient-adjacent information — access through authenticated AI service only
5. **Shared cohort links** are time-limited, contain no PHI (definition metadata only), and use cryptographically random tokens

---

## 8. Deployment Verification

Before deploying any change that touches auth, routes, Docker config, or permissions:

- [ ] `docker compose config --quiet` passes (valid YAML)
- [ ] `php artisan route:list` shows correct middleware on all routes
- [ ] No `$guarded = []` in any model (`grep -r 'guarded = \[\]' backend/app/Models/`)
- [ ] No unauthenticated routes serving clinical data
- [ ] All Dockerfiles have `USER` directives (except documented exceptions)
- [ ] `.env` and secret files are `chmod 600`
- [ ] `APP_DEBUG=false` in production `.env`
- [ ] Redis, Orthanc, and Grafana have authentication enabled
- [ ] Sanctum token expiration is set (not `null`)
- [ ] New user registration assigns `viewer` role only

---

## 9. Incident Response

If a security issue is discovered during development:

1. **STOP** — do not continue the current task
2. **Assess** — determine if PHI/PII was exposed
3. **Fix** — apply the minimum change to close the vulnerability
4. **Rotate** — if credentials were exposed, rotate them immediately
5. **Audit** — search the codebase for similar patterns (`grep`, `Glob`)
6. **Document** — note the finding and fix in the commit message

---

## 10. What Changed (2026-03-20 Security Hardening)

These changes established the HIGHSEC paradigm:

| Change | File(s) | Impact |
|--------|---------|--------|
| WADO endpoint now requires auth | `backend/routes/api.php` | Medical images no longer publicly accessible |
| New users get `viewer` role only | `backend/app/Http/Controllers/Api/V1/AuthController.php` | Self-registration no longer grants admin access |
| Horizon gate uses role check | `backend/app/Providers/HorizonServiceProvider.php` | super-admin can access Horizon; was locked out for everyone |
| Removed `$guarded = []` | `backend/app/Models/Vocabulary/ConceptEmbedding.php` | Mass assignment protection restored |
| Permission middleware on all research routes | `backend/routes/api.php` | Analyses/studies enforce RBAC (view/create/run split) |
| Sanctum token expiration: 8 hours | `backend/config/sanctum.php` | Tokens no longer live forever |
| Redis authentication enabled | `docker-compose.yml`, `backend/.env` | Redis requires password on all connections |
| Orthanc authentication enabled | `docker-compose.yml` | DICOM server no longer open to network |
| Grafana anonymous access disabled | `docker-compose.yml` | Monitoring dashboards require login |
| Non-root Docker users | `docker/python/`, `docker/node/`, `docker/study-agent/` | 3 services no longer run as root |
| Secret file permissions: 600 | `.env`, `.resendapikey` | No longer group-readable |
