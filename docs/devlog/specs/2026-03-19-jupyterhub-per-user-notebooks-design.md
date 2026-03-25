# JupyterHub Per-User Notebooks — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Replace single shared JupyterLab with JupyterHub + DockerSpawner for per-user isolated notebook environments

---

## 1. Problem Statement

The current Jupyter deployment is a single shared container with one token. All users see the same workspace, can overwrite each other's notebooks, share database credentials, and leave no audit trail. This doesn't meet requirements for:

- **Workspace isolation** — users need private notebooks (with opt-in sharing)
- **Resource isolation** — heavy workloads shouldn't impact other users
- **Audit/compliance** — must track who ran what, when
- **Permissions-driven data access** — database access must mirror Spatie roles

## 2. Decision

**JupyterHub with DockerSpawner**, replacing the single JupyterLab container. Designed for 5-15 concurrent users on the existing Docker Compose stack (no Kubernetes).

## 3. Architecture

```
Browser → Nginx (:8082) → /jupyter/* → JupyterHub (host :8888 → container :8000)
                                            ↓
                                      DockerSpawner
                                    ↓              ↓
                            jupyter-user-1    jupyter-user-2  ...
                            (per-user container from shared image)
```

### 3.1 Containers

| Container | Lifecycle | Purpose |
|-----------|-----------|---------|
| `parthenon-jupyterhub` | Always running | Hub process, authenticator, spawner |
| `parthenon-jupyter-{user_id}` | On-demand, idle-culled | Per-user JupyterLab instance |

### 3.2 Removed

- `parthenon-jupyter` single-instance container (replaced by Hub + spawned containers)
- `JUPYTER_TOKEN` env var and all token-in-URL patterns

## 4. Authentication Flow

Seamless SSO — no separate JupyterHub login page visible to users.

1. User clicks Jupyter in Parthenon UI
2. Frontend calls `POST /api/v1/jupyter/session`
3. Backend generates a signed JWT (60-second expiry) containing:
   ```json
   {
     "sub": 42,
     "email": "researcher@acumenus.net",
     "roles": ["researcher"],
     "iat": 1711065600,
     "exp": 1711065660
   }
   ```
4. Backend returns the JWT to the frontend
5. Frontend creates a hidden form and POSTs it to `/jupyter/hub/login` with the JWT in the body (avoids token in URL/query string/logs)
6. Hub's `ParthenonAuthenticator` extracts the JWT from the POST body and validates it by calling `GET /api/v1/jupyter/user/{jwt}`
7. Backend verifies signature + expiry, returns user identity and roles
8. Hub spawns or reconnects to the user's existing container
9. Hub sets a session cookie and redirects to the user's server
10. User lands in their private JupyterLab — seamless

### 4.1 JWT Configuration

- **Signing:** HMAC-SHA256 with `JUPYTER_JWT_SECRET` env var (shared between Laravel and Hub)
- **Expiry:** 60 seconds (handshake only — not a session token)
- **Claims:** `sub` (user ID), `email`, `roles` (Spatie role names), `iat`, `exp`
- **Single-use:** Hub tracks consumed JWT `jti` claims to prevent replay

### 4.2 Iframe Integration

Since the auth flow uses a POST (not GET), the frontend cannot simply set `iframe.src`. Instead:

1. Frontend receives JWT from `POST /api/v1/jupyter/session`
2. Frontend creates a hidden `<form>` targeting the iframe, with `method="POST"` and `action="/jupyter/hub/login"`
3. JWT is placed in a hidden input field
4. Form is submitted programmatically — the iframe receives the Hub's redirect response
5. Subsequent navigation within the iframe uses the Hub session cookie (no further JWT needed)

## 5. Storage & Workspace Layout

```
/home/jovyan/                        ← Container home
├── notebooks/                       ← Private workspace (volume: jupyter-user-{user_id})
│   └── parthenon-research-workbench.ipynb  ← Copied on first spawn
├── shared/                          ← Read-write shared folder (volume: jupyter-shared)
│   └── {user_id}/                   ← Per-user subdirectories for organization
└── parthenon/                       ← Read-only repo mount
```

### 5.1 Volumes

| Volume | Type | Mount | Access |
|--------|------|-------|--------|
| `jupyter-user-{user_id}` | Named Docker volume | `/home/jovyan/notebooks/` | Private, read-write |
| `jupyter-shared` | Named Docker volume | `/home/jovyan/shared/` | All users, read-write |
| Host `./` | Bind mount | `/home/jovyan/parthenon/` | All users, read-only |

### 5.2 Lifecycle

- **First spawn:** `pre_spawn_hook` detects empty volume, copies starter notebook into private workspace. Hub's built-in spawn lock prevents race conditions on concurrent requests for the same user.
- **Subsequent spawns:** Volume already has content, skip copy
- **Idle culling:** `cull_idle_servers` stops containers after **30 minutes** of inactivity
- **Volumes persist** across container stop/start — user's work survives culling

### 5.3 Shared Folder Conventions

- Each user gets a subdirectory `/shared/{user_id}/` created on first spawn
- Users can read all of `/shared/` but are expected to write only to their own subdirectory
- No enforced quota in v1 — acceptable for trusted team of 5-15. Monitor via periodic disk usage checks. If abuse occurs, add per-user subdirectory quotas in a future iteration.

## 6. Database Access & Permissions

### 6.1 PostgreSQL Roles

```sql
-- Read-only researcher role
CREATE ROLE jupyter_researcher LOGIN PASSWORD '{generated}';
GRANT USAGE ON SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
ALTER DEFAULT PRIVILEGES IN SCHEMA omop, results, eunomia, eunomia_results
    GRANT SELECT ON TABLES TO jupyter_researcher;

-- Super-admin role (read research schemas + write results, explicit table grants on app)
CREATE ROLE jupyter_admin LOGIN PASSWORD '{generated}';
GRANT USAGE ON SCHEMA omop, results, gis, eunomia, eunomia_results, app TO jupyter_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, gis, eunomia, eunomia_results TO jupyter_admin;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA results TO jupyter_admin;
REVOKE DELETE ON ALL TABLES IN SCHEMA results FROM jupyter_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA results
    GRANT INSERT, UPDATE ON TABLES TO jupyter_admin;

-- Explicit app schema grants (exclude auth-sensitive tables)
GRANT SELECT ON app.cohort_definitions, app.studies, app.data_sources,
    app.analysis_executions, app.concept_sets, app.jupyter_audit_log
    TO jupyter_admin;
-- NEVER grant access to: app.users, app.personal_access_tokens,
-- app.password_reset_tokens, app.model_has_roles, app.model_has_permissions
```

### 6.2 Excluded Schemas & Tables

No Jupyter role gets access to:
- `php.*` — Laravel internals (migrations, jobs, cache)
- `app.users` — Password hashes, tokens, PII
- `app.personal_access_tokens` — Sanctum tokens
- `app.password_reset_tokens` — Reset tokens
- `app.model_has_roles`, `app.model_has_permissions` — RBAC assignments

### 6.3 Role Mapping

| Spatie Role | Jupyter DB Role | Access Level |
|-------------|-----------------|--------------|
| `researcher` | `jupyter_researcher` | Read-only OMOP, results, eunomia |
| `super-admin` | `jupyter_admin` | Read all research schemas + write results + limited app |
| `admin` | `jupyter_researcher` | Same as researcher (admin is an app role, not a data role) |
| `data-steward` | `jupyter_researcher` | Same as researcher (stewardship is via app UI, not notebooks) |
| `mapping-reviewer` | `jupyter_researcher` | Same as researcher |
| `viewer` | — | **No Jupyter access** (blocked at API middleware) |

Users with multiple roles get the highest-privilege mapping. Priority: `super-admin` > all others.

### 6.4 Credential Injection

1. Spawner's `pre_spawn_hook` calls Parthenon API to resolve user's Spatie roles
2. Maps role to PostgreSQL credential per table above
3. Injects `PARTHENON_DB_USER` and `PARTHENON_DB_PASSWORD` as container environment variables
4. Existing starter notebook DB helper picks these up — no notebook code changes needed
5. **Retry policy:** 3 attempts with exponential backoff (1s, 2s, 4s). If API unreachable after retries, spawn fails with error (fail closed — never fall back to a default role).

## 7. Audit Trail

### 7.1 Events Logged

| Event | Data Captured |
|-------|---------------|
| `server.spawn` | user_id, email, container_name, timestamp |
| `server.stop` | user_id, reason (idle/manual/admin), timestamp |
| `auth.login` | user_id, email, ip_address, timestamp |
| `auth.failure` | attempted_token (redacted), ip_address, timestamp |

### 7.2 Storage

New table `app.jupyter_audit_log`:

```sql
CREATE TABLE app.jupyter_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES app.users(id),  -- NULL for auth.failure events
    event VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jupyter_audit_user ON app.jupyter_audit_log(user_id);
CREATE INDEX idx_jupyter_audit_event ON app.jupyter_audit_log(event);
CREATE INDEX idx_jupyter_audit_created ON app.jupyter_audit_log(created_at);

COMMENT ON COLUMN app.jupyter_audit_log.user_id IS 'NULL for unauthenticated events (auth.failure)';
```

### 7.3 Delivery

JupyterHub posts events to `POST /api/v1/jupyter/audit` (internal, authenticated with `JUPYTER_HUB_API_KEY` header). Laravel controller writes to `app.jupyter_audit_log`.

### 7.4 Retention

- Records older than 90 days are archived to a `app.jupyter_audit_log_archive` table via a scheduled Laravel command (`jupyter:archive-audit`), run weekly
- Archive table has same schema, no indexes (cold storage)
- Active table stays small for fast queries

## 8. Backend API Changes

### 8.1 New Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/jupyter/session` | Sanctum (researcher\|data-steward\|admin\|super-admin) | Mint JWT, return hub login URL |
| `GET` | `/api/v1/jupyter/user/{jwt}` | `X-Hub-Api-Key` header | Validate JWT, return user identity + roles |
| `POST` | `/api/v1/jupyter/audit` | `X-Hub-Api-Key` header | Receive audit events from Hub |
| `DELETE` | `/api/v1/jupyter/session` | Sanctum (researcher\|data-steward\|admin\|super-admin) | Stop user's server via Hub API |

Note: `viewer` role is excluded — no Jupyter access.

### 8.2 Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/v1/jupyter/workspace` | Returns Hub-aware URLs pointing to user's server |
| `GET` | `/api/v1/jupyter/health` | Checks Hub health instead of single JupyterLab |

### 8.3 Removed

- `JUPYTER_TOKEN` configuration from `config/services.php`
- Token-in-URL construction from `JupyterController`

## 9. Frontend Changes

Minimal changes to `JupyterPage.tsx`:

1. **Session initiation:** `useJupyterWorkspace` calls `POST /api/v1/jupyter/session` to get a JWT
2. **Hidden form POST:** Frontend creates a hidden form targeting the iframe, POSTs the JWT to `/jupyter/hub/login` (no token in URL)
3. **Spawning overlay:** New state — "Starting your notebook server..." with progress indicator (Hub exposes spawn progress via REST API)
4. **Spawn failure state:** "Failed to start notebook server" with retry button and error detail from Hub API
5. **Help drawer updates:** Shows user's private workspace path, documents `/shared` folder
6. **Server status:** Badge reflects user's server state (Spawning / Running / Stopped / Failed) instead of just Online/Unavailable

## 10. Docker & Nginx Changes

### 10.1 New Files

```
docker/jupyterhub/
├── Dockerfile              ← Hub image (python:3.12-slim + jupyterhub + dockerspawner)
├── jupyterhub_config.py    ← Spawner, authenticator, cull config
└── parthenon_auth.py       ← ParthenonAuthenticator class
```

### 10.2 Docker Compose

```yaml
jupyterhub:
  container_name: parthenon-jupyterhub
  build:
    context: .
    dockerfile: docker/jupyterhub/Dockerfile
  ports:
    - "${JUPYTER_PORT:-8888}:8000"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock  # DockerSpawner needs this — see Security section
    - jupyter-shared:/srv/jupyterhub/shared
  environment:
    - JUPYTER_JWT_SECRET=${JUPYTER_JWT_SECRET}
    - JUPYTER_HUB_API_KEY=${JUPYTER_HUB_API_KEY}
    - PARTHENON_API_URL=http://nginx/api/v1
    - DOCKER_NETWORK_NAME=parthenon_default
    - JUPYTER_USER_NETWORK_NAME=parthenon_jupyter_users
    - JUPYTER_IMAGE=parthenon-jupyter-user
    - JUPYTER_IDLE_TIMEOUT=${JUPYTER_IDLE_TIMEOUT:-1800}
    - JUPYTER_MEM_LIMIT=${JUPYTER_MEM_LIMIT:-2G}
    - JUPYTER_CPU_LIMIT=${JUPYTER_CPU_LIMIT:-1.0}
  depends_on:
    nginx:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8000/jupyter/hub/health >/dev/null"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
  networks:
    - parthenon
    - jupyter_users
  restart: unless-stopped

networks:
  parthenon:
    # existing network — Hub, Nginx, PHP, PostgreSQL
  jupyter_users:
    # new isolated network — Hub + per-user containers only
    name: parthenon_jupyter_users

volumes:
  jupyter-shared:
```

### 10.3 Network Isolation

Per-user containers are placed on the `jupyter_users` network, NOT the main `parthenon` network. The Hub is dual-homed (both networks). This means:

- User containers can reach: **Hub** (for API), **nothing else directly**
- User containers **cannot** reach: Redis, Solr, PHP, Orthanc, or any other internal service
- Database access: The spawner configures `extra_hosts` to map `postgres` to the PostgreSQL container's IP on the `parthenon` network, allowing DB connections without joining the full network

```python
# In jupyterhub_config.py
import docker
client = docker.from_env()
pg_container = client.containers.get('parthenon-postgres')
pg_ip = pg_container.attrs['NetworkSettings']['Networks']['parthenon_default']['IPAddress']

c.DockerSpawner.extra_host_config = {
    'extra_hosts': {f'postgres:{pg_ip}'}
}
c.DockerSpawner.network_name = 'parthenon_jupyter_users'
```

### 10.4 User Image

The existing `docker/jupyter/Dockerfile` becomes the per-user image (`parthenon-jupyter-user`), with minor changes:
- Remove hardcoded token/port config from `start.sh`
- JupyterHub's `jupyterhub-singleuser` replaces `jupyter lab` as entrypoint
- Same Python packages, same dark theme config
- Runs as non-root `jovyan` user with no sudo

### 10.5 Nginx

```nginx
location /jupyter/ {
    proxy_pass http://jupyterhub:8000;    # Hub on 8000, mapped to host 8888
    proxy_http_version 1.1;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

**Note:** Nginx `depends_on` must change from `jupyter` to `jupyterhub` in docker-compose.yml.

### 10.6 Port Allocation

| Port | Before | After |
|------|--------|-------|
| 8888 (host) | Single JupyterLab | JupyterHub (mapped from container 8000) |
| Dynamic | N/A | Per-user containers (jupyter_users network only, no host mapping) |

No conflicts with existing stack.

## 11. Migration Path

1. Build new `parthenon-jupyterhub` and `parthenon-jupyter-user` images
2. Run database migration to create `app.jupyter_audit_log` and PostgreSQL roles
3. Add new backend endpoints, `JUPYTER_JWT_SECRET`, and `JUPYTER_HUB_API_KEY` to `.env`
4. Update nginx config and nginx `depends_on` in docker-compose.yml
5. `docker compose down jupyter` (old container)
6. `docker compose up -d jupyterhub` (new hub)
7. Copy existing notebooks from `output/jupyter-notebook/` into `jupyter-shared` volume (preserves existing work as shared content accessible to all users)
8. Update frontend, rebuild
9. Verify: log in as researcher, confirm private workspace + shared folder + DB read-only access

**Rollback:** If Hub fails, revert docker-compose.yml to restore the old `jupyter` service definition. Shared volume notebooks are still accessible. The `output/jupyter-notebook/` host directory is preserved (not deleted) for rollback.

**Path compatibility:** Existing notebooks reference `/workspace/notebooks` and `/workspace/parthenon`. The new layout uses `/home/jovyan/notebooks/` and `/home/jovyan/parthenon/`. The user image adds symlinks: `/workspace/notebooks → /home/jovyan/notebooks` and `/workspace/parthenon → /home/jovyan/parthenon` for backward compatibility.

## 12. Security Considerations

### 12.1 Docker Socket Access (Known Risk)

The Hub container requires access to `/var/run/docker.sock` for DockerSpawner. **This is effectively root-equivalent access to the host** — the Docker socket is an API, and `:ro` mount flags do not prevent API calls that create, modify, or delete containers.

**Mitigations:**
- Hub container runs JupyterHub as a non-root `jupyterhub` user with Docker group membership (minimal privileges beyond Docker API)
- Hub container image is tightly controlled — no user-facing shell, minimal packages
- Hub container is not directly accessible to end users (only via Nginx proxy)
- No user-supplied code runs inside the Hub container (user code runs in spawned per-user containers)

**Future hardening (out of scope for v1):**
- Replace socket mount with TCP-based Docker API + mutual TLS authentication
- Or migrate to a socket proxy (e.g., `tecnativa/docker-socket-proxy`) that restricts allowed API calls

### 12.2 Authentication Security

- **JWT not in URLs:** Auth uses POST form submission, not query strings — tokens don't appear in Nginx logs, browser history, or Referer headers
- **60-second expiry:** Limits replay window
- **Single-use JTI tracking:** Hub rejects reused tokens
- **Key separation:** `JUPYTER_JWT_SECRET` (for JWT signing) and `JUPYTER_HUB_API_KEY` (for Hub-to-Laravel API calls) are separate secrets

### 12.3 Network Isolation

Per-user containers are on the isolated `jupyter_users` Docker network. They can reach PostgreSQL (via `extra_hosts`) and the Hub. They **cannot** reach Redis, Solr, PHP, the AI service, or any other internal container.

### 12.4 Container Security

- Containers run as non-root `jovyan` user with no sudo
- JupyterLab terminals are enabled (researchers need them) but the user cannot escalate privileges
- Per-user resource limits: 2G memory, 1.0 CPU (configurable)

### 12.5 Shared Folder

Users can read all of `/shared/` and write to their own subdirectory. Overwriting another user's files is possible but socially discouraged for a trusted team of 5-15. No enforced quotas in v1.

## 13. Environment Variables

### New

| Variable | Location | Purpose |
|----------|----------|---------|
| `JUPYTER_JWT_SECRET` | `.env`, Hub config | HMAC secret for JWT signing (auth handshake) |
| `JUPYTER_HUB_API_KEY` | `.env`, Hub config | API key for Hub → Laravel communication (audit, role lookup) |
| `JUPYTER_IMAGE` | Hub config | Docker image name for per-user containers |
| `JUPYTER_IDLE_TIMEOUT` | Hub config | Idle cull timeout in seconds (default: 1800) |
| `JUPYTER_MEM_LIMIT` | Hub config | Per-user container memory limit (default: 2G) |
| `JUPYTER_CPU_LIMIT` | Hub config | Per-user container CPU limit (default: 1.0) |

### Removed

| Variable | Reason |
|----------|--------|
| `JUPYTER_TOKEN` | Replaced by per-user JWT auth |

## 14. Out of Scope (Future)

- **Explicit notebook sharing UI** — sharing via `/shared` folder is sufficient for now
- **Source-based or row-level DB access** — role-based is the initial implementation
- **JupyterHub admin panel** — use Parthenon's admin UI instead
- **Kubernetes/KubeSpawner** — Docker Compose is sufficient for 5-15 users
- **Per-user Python environments** — all users share the same image/packages for now
- **Docker socket proxy** — hardening for the socket mount (v2)
- **Per-user disk quotas** — monitor manually in v1, enforce in v2 if needed
