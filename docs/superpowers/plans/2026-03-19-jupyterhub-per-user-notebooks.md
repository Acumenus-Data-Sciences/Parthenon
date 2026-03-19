# JupyterHub Per-User Notebooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single shared JupyterLab container with JupyterHub + DockerSpawner for per-user isolated notebook environments with SSO, audit logging, and role-based database access.

**Architecture:** JupyterHub runs as a new always-on container that spawns per-user JupyterLab containers via DockerSpawner. Auth is seamless SSO via short-lived JWT minted by Laravel and validated by a custom Hub authenticator. Per-user containers run on an isolated Docker network with only PostgreSQL access, using role-mapped credentials.

**Tech Stack:** JupyterHub 5.x, DockerSpawner, Laravel 11 (PHP 8.4), React 19, PostgreSQL 16, Docker Compose, Nginx

**Spec:** `docs/superpowers/specs/2026-03-19-jupyterhub-per-user-notebooks-design.md`

---

## File Map

### New Files

| Path | Purpose |
|------|---------|
| `docker/jupyterhub/Dockerfile` | Hub container image |
| `docker/jupyterhub/jupyterhub_config.py` | Spawner, authenticator, cull config |
| `docker/jupyterhub/parthenon_auth.py` | Custom ParthenonAuthenticator |
| `docker/jupyter-user/Dockerfile` | Per-user JupyterLab image (derived from existing) |
| `docker/jupyter-user/start.sh` | Singleuser entrypoint |
| `backend/app/Http/Controllers/Api/V1/JupyterController.php` | Rewritten Hub-aware controller |
| `backend/app/Console/Commands/JupyterArchiveAuditCommand.php` | Scheduled audit log archival |
| `backend/database/migrations/xxxx_create_jupyter_audit_log_archive_table.php` | Archive table migration |
| `backend/app/Models/JupyterAuditLog.php` | Eloquent model for audit log |
| `backend/database/migrations/xxxx_create_jupyter_audit_log_table.php` | Audit log migration |
| `backend/database/migrations/xxxx_create_jupyter_postgres_roles.php` | DB role creation migration |
| `frontend/src/features/jupyter/hooks/useJupyterSession.ts` | Session/JWT hook |

> **Note:** The spec described a `GET /api/v1/jupyter/user/{jwt}` endpoint for Hub-to-Laravel JWT validation. The plan deliberately omits this — the Hub validates JWTs locally using PyJWT (more robust, no network dependency during auth). This is a simplification that improves reliability.

### Modified Files

| Path | Change |
|------|--------|
| `docker-compose.yml` | Replace `jupyter` service with `jupyterhub`, add `jupyter_users` network |
| `docker/nginx/default.conf` | Proxy to `jupyterhub:8000` instead of `jupyter:8888` |
| `backend/config/services.php` | Replace token config with JWT/API key config |
| `backend/routes/api.php` | Add new endpoints, update role middleware |
| `backend/.env.example` | Add `JUPYTER_JWT_SECRET`, `JUPYTER_HUB_API_KEY`, remove `JUPYTER_TOKEN` |
| `frontend/src/features/jupyter/api.ts` | Add session endpoint, update types |
| `frontend/src/features/jupyter/hooks/useJupyterWorkspace.ts` | Integrate with session hook |
| `frontend/src/features/jupyter/pages/JupyterPage.tsx` | Hidden form POST auth, spawn states |

### Deleted Files

| Path | Reason |
|------|--------|
| `docker/jupyter/Dockerfile` | Replaced by `docker/jupyter-user/Dockerfile` |
| `docker/jupyter/start.sh` | Replaced by `docker/jupyter-user/start.sh` |

---

## Phase 1: Infrastructure (Docker, Nginx, DB)

### Task 1: Create the per-user JupyterLab image

**Files:**
- Create: `docker/jupyter-user/Dockerfile`
- Create: `docker/jupyter-user/start.sh`

- [ ] **Step 1: Create the per-user Dockerfile**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    ipykernel \
    jupyterhub==5.2.1 \
    jupyterlab==4.4.1 \
    matplotlib \
    numpy \
    pandas \
    polars \
    pyarrow \
    "psycopg[binary]" \
    requests \
    seaborn \
    sqlalchemy

# Create non-root user
RUN useradd -m -s /bin/bash -N jovyan && \
    mkdir -p /home/jovyan/notebooks /home/jovyan/shared /home/jovyan/parthenon

# Backward-compat symlinks for existing notebooks that reference /workspace/*
RUN mkdir -p /workspace && \
    ln -s /home/jovyan/notebooks /workspace/notebooks && \
    ln -s /home/jovyan/parthenon /workspace/parthenon

# Dark theme — system + user level
RUN JUPYTER_DATA=$(python -c "import jupyter_core.paths; print(jupyter_core.paths.jupyter_data_dir())") && \
    mkdir -p "${JUPYTER_DATA}/lab/settings" && \
    echo '{"@jupyterlab/apputils-extension:themes":{"theme":"JupyterLab Dark"}}' \
      > "${JUPYTER_DATA}/lab/settings/overrides.json" && \
    mkdir -p /home/jovyan/.jupyter/lab/user-settings/@jupyterlab/apputils-extension && \
    echo '{"theme":"JupyterLab Dark"}' \
      > /home/jovyan/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/themes.jupyterlab-settings && \
    chown -R jovyan:users /home/jovyan

COPY docker/jupyter-user/start.sh /usr/local/bin/start-singleuser
RUN chmod +x /usr/local/bin/start-singleuser

WORKDIR /home/jovyan/notebooks
USER jovyan

EXPOSE 8888

ENTRYPOINT ["tini", "--", "/usr/local/bin/start-singleuser"]
```

- [ ] **Step 2: Create the singleuser start script**

```bash
#!/bin/bash
set -euo pipefail

# Launched by JupyterHub's DockerSpawner — environment variables are injected:
#   JUPYTERHUB_API_TOKEN, JUPYTERHUB_BASE_URL, JUPYTERHUB_SERVICE_PREFIX, etc.
#   PARTHENON_DB_HOST, PARTHENON_DB_USER, PARTHENON_DB_PASSWORD, etc.
#   PARTHENON_USER_ID — used for shared folder subdirectory

# Copy starter notebook on first spawn (empty private workspace)
if [ ! -f /home/jovyan/notebooks/parthenon-research-workbench.ipynb ]; then
    cp /home/jovyan/parthenon/output/jupyter-notebook/parthenon-research-workbench.ipynb \
       /home/jovyan/notebooks/ 2>/dev/null || true
fi

# Create user's shared subdirectory
if [ -n "${PARTHENON_USER_ID:-}" ]; then
    mkdir -p "/home/jovyan/shared/${PARTHENON_USER_ID}"
fi

exec jupyterhub-singleuser \
    --ip=0.0.0.0 \
    --port=8888 \
    --no-browser \
    --ServerApp.allow_remote_access=True \
    --ServerApp.root_dir=/home/jovyan/notebooks
```

- [ ] **Step 3: Build and verify the image**

Run: `docker build -t parthenon-jupyter-user -f docker/jupyter-user/Dockerfile .`
Expected: Image builds successfully, no errors

- [ ] **Step 4: Verify non-root user and paths**

Run: `docker run --rm parthenon-jupyter-user id`
Expected: `uid=1000(jovyan) gid=100(users)`

Run: `docker run --rm parthenon-jupyter-user ls -la /workspace/`
Expected: Symlinks to `/home/jovyan/notebooks` and `/home/jovyan/parthenon`

- [ ] **Step 5: Commit**

```bash
git add docker/jupyter-user/
git commit -m "feat(jupyter): create per-user JupyterLab singleuser image"
```

---

### Task 2: Create the JupyterHub image and configuration

**Files:**
- Create: `docker/jupyterhub/Dockerfile`
- Create: `docker/jupyterhub/jupyterhub_config.py`
- Create: `docker/jupyterhub/parthenon_auth.py`

- [ ] **Step 1: Create the Hub Dockerfile**

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    jupyterhub==5.2.1 \
    dockerspawner==13.0.0 \
    jupyterhub-idle-culler==1.4.0 \
    "docker>=7.0.0" \
    PyJWT==2.9.0 \
    requests==2.32.3

# Non-root hub user with Docker group access
RUN groupadd -g 999 docker && \
    useradd -m -s /bin/bash -G docker jupyterhub

COPY docker/jupyterhub/jupyterhub_config.py /srv/jupyterhub/jupyterhub_config.py
COPY docker/jupyterhub/parthenon_auth.py /srv/jupyterhub/parthenon_auth.py

RUN mkdir -p /srv/jupyterhub/data && \
    chown -R jupyterhub:jupyterhub /srv/jupyterhub

WORKDIR /srv/jupyterhub
USER jupyterhub

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["jupyterhub", "--config", "/srv/jupyterhub/jupyterhub_config.py"]
```

- [ ] **Step 2: Create the custom authenticator**

```python
"""ParthenonAuthenticator — validates JWTs minted by Laravel."""

import os
import jwt
import time
import requests
from jupyterhub.auth import Authenticator
from jupyterhub.handlers import BaseHandler
from tornado import web

PARTHENON_API_URL = os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1")
HUB_API_KEY = os.environ.get("JUPYTER_HUB_API_KEY", "")


def _post_audit(event: str, user_id: int | None = None, metadata: dict | None = None, ip: str | None = None):
    """Fire-and-forget audit event to Parthenon."""
    try:
        payload = {"event": event, "user_id": user_id, "metadata": metadata or {}}
        requests.post(
            f"{PARTHENON_API_URL}/jupyter/audit",
            json=payload,
            headers={"X-Hub-Api-Key": HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass  # Audit failure must not block auth flow


class ParthenonLoginHandler(BaseHandler):
    """Accepts POST with JWT, authenticates, redirects to user server."""

    async def post(self):
        token = self.get_argument("token", default=None)
        if not token:
            raise web.HTTPError(400, "Missing token")

        user = await self.login_user({"token": token})
        if user is None:
            _post_audit("auth.failure", metadata={"reason": "invalid_token"}, ip=self.request.remote_ip)
            raise web.HTTPError(401, "Authentication failed")

        # Log successful auth
        auth_state = await user.get_auth_state() or {}
        _post_audit("auth.login", user_id=auth_state.get("user_id"), metadata={"email": auth_state.get("email", "")}, ip=self.request.remote_ip)

        self.redirect(self.get_next_url(user))


class ParthenonAuthenticator(Authenticator):
    """Validates short-lived JWTs signed by Laravel backend."""

    _consumed_jtis: dict[str, float] = {}

    def get_handlers(self, app):
        return [("/jupyter/hub/login", ParthenonLoginHandler)]

    async def authenticate(self, handler, data):
        token = data.get("token")
        if not token:
            return None

        secret = os.environ.get("JUPYTER_JWT_SECRET", "")
        if not secret:
            self.log.error("JUPYTER_JWT_SECRET not configured")
            return None

        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            self.log.warning("JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            self.log.warning("JWT invalid: %s", e)
            return None

        # Require jti for replay protection
        jti = payload.get("jti")
        if not jti:
            self.log.warning("JWT missing jti claim")
            return None

        now = time.time()
        # Clean expired jtis (older than 120s)
        self._consumed_jtis = {
            k: v for k, v in self._consumed_jtis.items()
            if now - v < 120
        }
        if jti in self._consumed_jtis:
            self.log.warning("JWT replay attempt: jti=%s", jti)
            return None
        self._consumed_jtis[jti] = now

        user_id = payload.get("sub")
        email = payload.get("email", "")
        roles = payload.get("roles", [])

        if not user_id or not email:
            self.log.warning("JWT missing sub or email")
            return None

        # Use user_id as the JupyterHub username for container naming
        username = f"user-{user_id}"

        return {
            "name": username,
            "auth_state": {
                "user_id": user_id,
                "email": email,
                "roles": roles,
            },
        }
```

- [ ] **Step 3: Create the Hub config**

```python
"""JupyterHub configuration for Parthenon."""

import os
import requests
from dockerspawner import DockerSpawner

# ── Authentication ──
c.JupyterHub.authenticator_class = "parthenon_auth.ParthenonAuthenticator"
c.Authenticator.enable_auth_state = True
c.Authenticator.auto_login = True

# ── Base URL ──
c.JupyterHub.base_url = "/jupyter"
c.JupyterHub.bind_url = "http://0.0.0.0:8000/jupyter"

# ── Spawner ──
c.JupyterHub.spawner_class = DockerSpawner
c.DockerSpawner.image = os.environ.get("JUPYTER_IMAGE", "parthenon-jupyter-user")
c.DockerSpawner.network_name = os.environ.get(
    "JUPYTER_USER_NETWORK_NAME", "parthenon_jupyter_users"
)
c.DockerSpawner.name_template = "parthenon-jupyter-{username}"
c.DockerSpawner.remove = True  # Remove stopped containers (volumes persist)

# Resource limits
mem_limit = os.environ.get("JUPYTER_MEM_LIMIT", "2G")
cpu_limit = float(os.environ.get("JUPYTER_CPU_LIMIT", "1.0"))
c.DockerSpawner.mem_limit = mem_limit
c.DockerSpawner.cpu_limit = cpu_limit

# ── Volumes ──
# {username} is replaced by DockerSpawner with the JupyterHub username
c.DockerSpawner.volumes = {
    "jupyter-{username}": "/home/jovyan/notebooks",
    "jupyter-shared": "/home/jovyan/shared",
}
# Read-only repo bind mount
c.DockerSpawner.read_only_volumes = {
    os.environ.get("PARTHENON_REPO_PATH", "/app"): "/home/jovyan/parthenon",
}

# ── Network: PostgreSQL access via extra_hosts ──
PARTHENON_DB_HOST = os.environ.get("PARTHENON_DB_HOST_IP", "")


def _resolve_pg_ip():
    """Resolve PostgreSQL container IP if not explicitly set."""
    if PARTHENON_DB_HOST:
        return PARTHENON_DB_HOST
    try:
        import docker
        client = docker.from_env()
        pg = client.containers.get("parthenon-postgres")
        network_name = os.environ.get("DOCKER_NETWORK_NAME", "parthenon_default")
        return pg.attrs["NetworkSettings"]["Networks"][network_name]["IPAddress"]
    except Exception:
        return "172.17.0.1"  # Fallback to Docker host


PG_IP = _resolve_pg_ip()
c.DockerSpawner.extra_host_config = {"extra_hosts": [f"postgres:{PG_IP}"]}

# ── Environment injection via pre_spawn_hook ──
PARTHENON_API_URL = os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1")
HUB_API_KEY = os.environ.get("JUPYTER_HUB_API_KEY", "")

# Role → DB credential mapping
ROLE_DB_MAP = {
    "super-admin": ("jupyter_admin", os.environ.get("JUPYTER_DB_ADMIN_PASSWORD", "")),
    "admin": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "researcher": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "data-steward": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "mapping-reviewer": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
}

ROLE_PRIORITY = ["super-admin", "admin", "researcher", "data-steward", "mapping-reviewer"]


async def pre_spawn_hook(spawner):
    """Inject per-user environment variables before container starts."""
    auth_state = await spawner.user.get_auth_state()
    if not auth_state:
        raise Exception("No auth state — cannot determine user roles")

    user_id = auth_state["user_id"]
    email = auth_state["email"]
    roles = auth_state.get("roles", [])

    # Pick highest-priority role for DB credential — fail closed if no match
    db_user = None
    db_password = None
    for role in ROLE_PRIORITY:
        if role in roles and role in ROLE_DB_MAP:
            db_user, db_password = ROLE_DB_MAP[role]
            break

    if not db_user:
        raise Exception(f"No Jupyter-eligible role found for user {user_id} (roles: {roles})")

    spawner.environment.update({
        "PARTHENON_USER_ID": str(user_id),
        "PARTHENON_USER_EMAIL": email,
        "PARTHENON_API_BASE_URL": PARTHENON_API_URL,
        "PARTHENON_DB_HOST": "postgres",
        "PARTHENON_DB_PORT": "5432",
        "PARTHENON_DB_NAME": os.environ.get("PARTHENON_DB_NAME", "parthenon"),
        "PARTHENON_DB_USER": db_user,
        "PARTHENON_DB_PASSWORD": db_password,
        "PARTHENON_NOTEBOOK_DIR": "/home/jovyan/notebooks",
        "PARTHENON_REPO_DIR": "/home/jovyan/parthenon",
    })

    # Starter notebook copy and shared dir creation happen in start.sh (inside container)

    # Post audit event
    try:
        requests.post(
            f"{PARTHENON_API_URL}/jupyter/audit",
            json={
                "event": "server.spawn",
                "user_id": user_id,
                "metadata": {"email": email, "container": spawner.container_name},
            },
            headers={"X-Hub-Api-Key": HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass  # Audit failure should not block spawn


async def post_stop_hook(spawner):
    """Log server stop event to audit trail."""
    auth_state = await spawner.user.get_auth_state()
    if not auth_state:
        return
    try:
        requests.post(
            f"{PARTHENON_API_URL}/jupyter/audit",
            json={
                "event": "server.stop",
                "user_id": auth_state["user_id"],
                "metadata": {"reason": "idle_cull_or_manual"},
            },
            headers={"X-Hub-Api-Key": HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass


c.Spawner.pre_spawn_hook = pre_spawn_hook
c.Spawner.post_stop_hook = post_stop_hook

# ── Idle culling ──
c.JupyterHub.services = [
    {
        "name": "cull-idle",
        "admin": True,
        "command": [
            "python", "-m", "jupyterhub_idle_culler",
            f"--timeout={os.environ.get('JUPYTER_IDLE_TIMEOUT', '1800')}",
            "--cull-every=120",
        ],
    }
]
c.JupyterHub.load_roles = [
    {
        "name": "cull-idle-role",
        "scopes": ["list:users", "read:users:activity", "admin:servers"],
        "services": ["cull-idle"],
    }
]

# ── Hub DB (SQLite, internal) ──
c.JupyterHub.db_url = "sqlite:////srv/jupyterhub/data/jupyterhub.sqlite"
```

- [ ] **Step 4: Build and verify the Hub image**

Run: `docker build -t parthenon-jupyterhub -f docker/jupyterhub/Dockerfile .`
Expected: Image builds successfully

- [ ] **Step 5: Commit**

```bash
git add docker/jupyterhub/
git commit -m "feat(jupyter): create JupyterHub image with DockerSpawner and custom authenticator"
```

---

### Task 3: Database migrations — audit log table and PostgreSQL roles

**Files:**
- Create: `backend/database/migrations/2026_03_19_200000_create_jupyter_audit_log_table.php`
- Create: `backend/database/migrations/2026_03_19_200001_create_jupyter_postgres_roles.php`
- Create: `backend/app/Models/JupyterAuditLog.php`

- [ ] **Step 1: Create the audit log migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jupyter_audit_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event', 50);
            $table->jsonb('metadata')->default('{}');
            $table->ipAddress('ip_address')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index('user_id', 'idx_jupyter_audit_user');
            $table->index('event', 'idx_jupyter_audit_event');
            $table->index('created_at', 'idx_jupyter_audit_created');
        });

        DB::statement("COMMENT ON COLUMN app.jupyter_audit_log.user_id IS 'NULL for unauthenticated events (auth.failure)'");
    }

    public function down(): void
    {
        Schema::dropIfExists('jupyter_audit_log');
    }
};
```

- [ ] **Step 2: Create the PostgreSQL roles migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $researcherPassword = config('services.jupyter.db_researcher_password', 'jupyter_researcher_pass');
        $adminPassword = config('services.jupyter.db_admin_password', 'jupyter_admin_pass');

        // Create researcher role (read-only)
        DB::unprepared("
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jupyter_researcher') THEN
                    EXECUTE format('CREATE ROLE jupyter_researcher LOGIN PASSWORD %L', '{$researcherPassword}');
                END IF;
            END
            \$\$;

            GRANT USAGE ON SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
            GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, eunomia, eunomia_results TO jupyter_researcher;
            ALTER DEFAULT PRIVILEGES IN SCHEMA omop, results, eunomia, eunomia_results
                GRANT SELECT ON TABLES TO jupyter_researcher;
        ");

        // Create admin role (read + write results, selective app access)
        DB::unprepared("
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jupyter_admin') THEN
                    EXECUTE format('CREATE ROLE jupyter_admin LOGIN PASSWORD %L', '{$adminPassword}');
                END IF;
            END
            \$\$;

            GRANT USAGE ON SCHEMA omop, results, gis, eunomia, eunomia_results, app TO jupyter_admin;
            GRANT SELECT ON ALL TABLES IN SCHEMA omop, results, gis, eunomia, eunomia_results TO jupyter_admin;
            GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA results TO jupyter_admin;
            REVOKE DELETE ON ALL TABLES IN SCHEMA results FROM jupyter_admin;
            ALTER DEFAULT PRIVILEGES IN SCHEMA results
                GRANT INSERT, UPDATE ON TABLES TO jupyter_admin;
        ");

        // Selective app schema access (exclude auth tables: users, personal_access_tokens, etc.)
        DB::unprepared("
            GRANT SELECT ON app.jupyter_audit_log, app.cohort_definitions, app.studies,
                app.data_sources, app.analysis_executions, app.concept_sets
                TO jupyter_admin;
        ");
    }

    public function down(): void
    {
        DB::unprepared("
            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA omop, results, eunomia, eunomia_results FROM jupyter_researcher;
            REVOKE USAGE ON SCHEMA omop, results, eunomia, eunomia_results FROM jupyter_researcher;
            DROP ROLE IF EXISTS jupyter_researcher;

            REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA omop, results, gis, eunomia, eunomia_results, app FROM jupyter_admin;
            REVOKE USAGE ON SCHEMA omop, results, gis, eunomia, eunomia_results, app FROM jupyter_admin;
            DROP ROLE IF EXISTS jupyter_admin;
        ");
    }
};
```

- [ ] **Step 3: Create the JupyterAuditLog Eloquent model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JupyterAuditLog extends Model
{
    public $timestamps = false;

    protected $table = 'jupyter_audit_log';

    protected $fillable = [
        'user_id',
        'event',
        'metadata',
        'ip_address',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 4: Run migrations and verify**

Run: `docker compose exec php php artisan migrate`
Expected: Both migrations run successfully

Run: `docker compose exec postgres psql -U parthenon -c "\du jupyter_*"`
Expected: Both `jupyter_researcher` and `jupyter_admin` roles listed

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_03_19_* backend/app/Models/JupyterAuditLog.php
git commit -m "feat(jupyter): add audit log table and PostgreSQL roles for per-user access"
```

---

### Task 3b: Audit log archive table and scheduled command

**Files:**
- Create: `backend/database/migrations/2026_03_19_200002_create_jupyter_audit_log_archive_table.php`
- Create: `backend/app/Console/Commands/JupyterArchiveAuditCommand.php`

- [ ] **Step 1: Create the archive table migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jupyter_audit_log_archive', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event', 50);
            $table->jsonb('metadata')->default('{}');
            $table->ipAddress('ip_address')->nullable();
            $table->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jupyter_audit_log_archive');
    }
};
```

- [ ] **Step 2: Create the archive command**

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class JupyterArchiveAuditCommand extends Command
{
    protected $signature = 'jupyter:archive-audit {--days=90 : Archive records older than N days}';

    protected $description = 'Move old Jupyter audit log records to the archive table';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        $moved = DB::statement("
            WITH moved AS (
                DELETE FROM app.jupyter_audit_log
                WHERE created_at < ?
                RETURNING *
            )
            INSERT INTO app.jupyter_audit_log_archive
            SELECT * FROM moved
        ", [$cutoff]);

        $this->info("Archived audit records older than {$days} days.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 3: Register in scheduler**

Add to `backend/app/Console/Kernel.php` (or `routes/console.php` if using Laravel 11 schedule):

```php
Schedule::command('jupyter:archive-audit')->weekly();
```

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_19_200002_* backend/app/Console/Commands/JupyterArchiveAuditCommand.php
git commit -m "feat(jupyter): add audit log archive table and scheduled cleanup command"
```

---

### Task 4: Update Docker Compose — replace jupyter with jupyterhub

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/.env.example`

- [ ] **Step 1: Update .env.example with new variables**

Remove old lines (`JUPYTER_URL`, `JUPYTER_BASE_URL`, `JUPYTER_TOKEN`) and add to `backend/.env.example`:

```
# JupyterHub
JUPYTER_JWT_SECRET=change-me-generate-a-real-secret
JUPYTER_HUB_API_KEY=change-me-generate-a-real-api-key
JUPYTER_DB_RESEARCHER_PASSWORD=jupyter_researcher_pass
JUPYTER_DB_ADMIN_PASSWORD=jupyter_admin_pass
JUPYTER_IDLE_TIMEOUT=1800
JUPYTER_MEM_LIMIT=2G
JUPYTER_CPU_LIMIT=1.0
```

- [ ] **Step 2: Update .env with real secrets**

Run: `cd backend && php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"` (generate two secrets)

Remove old lines from `backend/.env`: `JUPYTER_URL`, `JUPYTER_BASE_URL`, `JUPYTER_TOKEN`

Add to `backend/.env`:
```
JUPYTER_JWT_SECRET={generated_secret_1}
JUPYTER_HUB_API_KEY={generated_secret_2}
JUPYTER_DB_RESEARCHER_PASSWORD={generated_password}
JUPYTER_DB_ADMIN_PASSWORD={generated_password}
```

- [ ] **Step 3: Replace jupyter service with jupyterhub in docker-compose.yml**

Remove the entire `jupyter:` service block (lines 257-295) and replace with:

```yaml
  jupyterhub:
    container_name: parthenon-jupyterhub
    build:
      context: .
      dockerfile: docker/jupyterhub/Dockerfile
    ports:
      - "${JUPYTER_PORT:-8888}:8000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - jupyter-shared:/srv/jupyterhub/shared
      - jupyterhub-data:/srv/jupyterhub/data
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
      - JUPYTER_DB_RESEARCHER_PASSWORD=${JUPYTER_DB_RESEARCHER_PASSWORD}
      - JUPYTER_DB_ADMIN_PASSWORD=${JUPYTER_DB_ADMIN_PASSWORD}
      - PARTHENON_DB_NAME=parthenon
      - PARTHENON_REPO_PATH=${PWD:-.}
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
```

Add to `networks:` section:
```yaml
  jupyter_users:
    name: parthenon_jupyter_users
```

Add to `volumes:` section:
```yaml
  jupyter-shared:
  jupyterhub-data:
```

Update nginx `depends_on` — change `jupyter` to `jupyterhub`:
```yaml
      jupyterhub:
        condition: service_healthy
```

- [ ] **Step 4: Update nginx config**

In `docker/nginx/default.conf`, change the jupyter location block (line 146):

Replace the `/jupyter/` location block content. Use a variable so Nginx can start even if Hub is still booting:

From:
```nginx
proxy_pass http://jupyter:8888;
```

To:
```nginx
set $jupyter_upstream http://jupyterhub:8000;
proxy_pass $jupyter_upstream;
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker/nginx/default.conf backend/.env.example
git commit -m "feat(jupyter): replace single jupyter container with jupyterhub in docker-compose"
```

---

## Phase 2: Backend API

### Task 5: Update Laravel services config

**Files:**
- Modify: `backend/config/services.php:78-82`

- [ ] **Step 1: Update jupyter config block**

Replace the existing `'jupyter'` config in `backend/config/services.php`:

```php
'jupyter' => [
    'hub_url' => env('JUPYTER_URL', 'http://jupyterhub:8000'),
    'base_url' => env('JUPYTER_BASE_URL', '/jupyter'),
    'jwt_secret' => env('JUPYTER_JWT_SECRET', ''),
    'hub_api_key' => env('JUPYTER_HUB_API_KEY', ''),
    'db_researcher_password' => env('JUPYTER_DB_RESEARCHER_PASSWORD', ''),
    'db_admin_password' => env('JUPYTER_DB_ADMIN_PASSWORD', ''),
],
```

- [ ] **Step 2: Commit**

```bash
git add backend/config/services.php
git commit -m "refactor(jupyter): update services config for JupyterHub"
```

---

### Task 6: Create the JupyterHub controller

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/JupyterController.php`

- [ ] **Step 1: Rewrite the controller for Hub integration**

Replace the entire `JupyterController.php` with:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JupyterAuditLog;
use Dedoc\Scramble\Attributes\Group;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

#[Group('Jupyter', weight: 228)]
class JupyterController extends Controller
{
    private string $hubUrl;

    private string $baseUrl;

    private string $jwtSecret;

    private string $hubApiKey;

    public function __construct()
    {
        $this->hubUrl = rtrim(config('services.jupyter.hub_url', 'http://jupyterhub:8000'), '/');
        $this->baseUrl = '/'.trim(config('services.jupyter.base_url', '/jupyter'), '/');
        $this->jwtSecret = (string) config('services.jupyter.jwt_secret', '');
        $this->hubApiKey = (string) config('services.jupyter.hub_api_key', '');
    }

    /**
     * Check JupyterHub health.
     */
    public function health(): JsonResponse
    {
        try {
            $response = Http::timeout(10)->get("{$this->hubUrl}/jupyter/hub/health");

            return response()->json([
                'data' => [
                    'available' => $response->successful(),
                    'status' => $response->successful() ? 'healthy' : 'unavailable',
                ],
            ], $response->successful() ? 200 : 503);
        } catch (\Throwable) {
            return response()->json([
                'data' => [
                    'available' => false,
                    'status' => 'unavailable',
                ],
            ], 503);
        }
    }

    /**
     * Create a session — mint a JWT for Hub authentication.
     */
    public function session(Request $request): JsonResponse
    {
        $user = $request->user();
        $roles = $user->getRoleNames()->toArray();

        $now = time();
        $payload = [
            'sub' => $user->id,
            'email' => $user->email,
            'roles' => $roles,
            'iat' => $now,
            'exp' => $now + 60,
            'jti' => Str::uuid()->toString(),
        ];

        $token = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return response()->json([
            'data' => [
                'token' => $token,
                'login_url' => "{$this->baseUrl}/hub/login",
                'expires_in' => 60,
            ],
        ]);
    }

    /**
     * Receive audit events from JupyterHub.
     */
    public function audit(Request $request): JsonResponse
    {
        if ($request->header('X-Hub-Api-Key') !== $this->hubApiKey) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'event' => 'required|string|max:50',
            'user_id' => 'nullable|integer|exists:users,id',
            'metadata' => 'nullable|array',
        ]);

        JupyterAuditLog::create([
            'event' => $validated['event'],
            'user_id' => $validated['user_id'] ?? null,
            'metadata' => $validated['metadata'] ?? [],
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['status' => 'ok']);
    }

    /**
     * Stop the current user's server.
     */
    public function destroySession(Request $request): JsonResponse
    {
        $user = $request->user();
        $hubUsername = "user-{$user->id}";

        try {
            Http::withHeaders(['Authorization' => "token {$this->hubApiKey}"])
                ->timeout(10)
                ->delete("{$this->hubUrl}/jupyter/hub/api/users/{$hubUsername}/server");
        } catch (\Throwable) {
            // Server may already be stopped
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Get workspace info — Hub-aware.
     */
    public function workspace(Request $request): JsonResponse
    {
        $user = $request->user();
        $hubUsername = "user-{$user->id}";

        // Check Hub health
        $available = false;
        try {
            $healthResp = Http::timeout(5)->get("{$this->hubUrl}/jupyter/hub/health");
            $available = $healthResp->successful();
        } catch (\Throwable) {
            // Hub unavailable
        }

        // Check user server status
        $serverStatus = 'stopped';
        if ($available) {
            try {
                $userResp = Http::withHeaders(['Authorization' => "token {$this->hubApiKey}"])
                    ->timeout(5)
                    ->get("{$this->hubUrl}/jupyter/hub/api/users/{$hubUsername}");

                if ($userResp->successful()) {
                    $userData = $userResp->json();
                    $server = $userData['servers'][''] ?? null;
                    if ($server) {
                        $serverStatus = $server['ready'] ? 'running' : 'spawning';
                    }
                }
            } catch (\Throwable) {
                // Can't determine server status
            }
        }

        return response()->json([
            'data' => [
                'available' => $available,
                'status' => $available ? 'healthy' : 'unavailable',
                'server_status' => $serverStatus,
                'label' => 'Jupyter Research Workbench',
                'summary' => 'Per-user notebook environment with isolated workspace and role-based database access.',
                'workspace_path' => '/home/jovyan/notebooks',
                'shared_path' => '/home/jovyan/shared',
                'repository_path' => '/home/jovyan/parthenon',
                'mounts' => [
                    [
                        'label' => 'Private notebooks',
                        'path' => '/home/jovyan/notebooks',
                        'description' => 'Your personal notebook workspace. Persists across sessions.',
                    ],
                    [
                        'label' => 'Shared folder',
                        'path' => '/home/jovyan/shared',
                        'description' => 'Read-write folder shared with all Jupyter users. Use shared/{your_id}/ for your files.',
                    ],
                    [
                        'label' => 'Parthenon repository',
                        'path' => '/home/jovyan/parthenon',
                        'description' => 'Read-only mount of the full Parthenon codebase and docs.',
                    ],
                ],
                'starter_notebooks' => [
                    [
                        'name' => 'Parthenon Research Workbench',
                        'filename' => 'parthenon-research-workbench.ipynb',
                        'description' => 'Starter notebook with environment checks, API wiring, and research-oriented prompts.',
                    ],
                ],
                'hints' => [
                    'Your notebooks are private by default. Copy files to /shared/ to share with colleagues.',
                    'Database credentials are injected based on your role — use the starter notebook helpers.',
                    'Your server stops after 30 minutes of inactivity. All your work is saved and restored on next visit.',
                ],
            ],
        ]);
    }
}
```

- [ ] **Step 2: Install firebase/php-jwt**

Run: `docker compose exec php composer require firebase/php-jwt`
Expected: Package installed successfully

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/JupyterController.php backend/composer.json backend/composer.lock
git commit -m "feat(jupyter): rewrite controller for JupyterHub with JWT session and audit endpoints"
```

---

### Task 7: Update API routes

**Files:**
- Modify: `backend/routes/api.php:498-504`

- [ ] **Step 1: Replace the jupyter route group**

Replace the existing jupyter route group in `backend/routes/api.php`:

```php
Route::prefix('jupyter')->group(function () {
    // Authenticated endpoints (researcher, data-steward, admin, super-admin — NOT viewer)
    Route::middleware(['role:researcher|data-steward|admin|super-admin', 'throttle:10,1'])
        ->group(function () {
            Route::get('/health', [JupyterController::class, 'health']);
            Route::get('/workspace', [JupyterController::class, 'workspace']);
            Route::post('/session', [JupyterController::class, 'session']);
            Route::delete('/session', [JupyterController::class, 'destroySession']);
        });

    // Hub-to-Laravel endpoints (authenticated via X-Hub-Api-Key header, no Sanctum)
    Route::withoutMiddleware(['auth:sanctum'])
        ->middleware(['throttle:60,1'])
        ->group(function () {
            Route::post('/audit', [JupyterController::class, 'audit']);
        });
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/api.php
git commit -m "feat(jupyter): add session, validate, and audit API routes"
```

---

## Phase 3: Frontend

### Task 8: Update the frontend API layer

**Files:**
- Modify: `frontend/src/features/jupyter/api.ts`
- Create: `frontend/src/features/jupyter/hooks/useJupyterSession.ts`

- [ ] **Step 1: Update api.ts with new types and session endpoint**

Replace `frontend/src/features/jupyter/api.ts`:

```typescript
import apiClient from "@/lib/api-client";

export interface JupyterMount {
  label: string;
  path: string;
  description: string;
}

export interface JupyterStarterNotebook {
  name: string;
  filename: string;
  description: string;
}

export interface JupyterWorkspace {
  available: boolean;
  status: "healthy" | "unavailable";
  server_status: "running" | "spawning" | "stopped";
  label: string;
  summary: string;
  workspace_path: string;
  shared_path: string;
  repository_path: string;
  mounts: JupyterMount[];
  starter_notebooks: JupyterStarterNotebook[];
  hints: string[];
}

export interface JupyterSession {
  token: string;
  login_url: string;
  expires_in: number;
}

export interface JupyterHealth {
  available: boolean;
  status: "healthy" | "unavailable";
}

export async function fetchJupyterWorkspace(): Promise<JupyterWorkspace> {
  const { data } = await apiClient.get("/jupyter/workspace");
  return data.data;
}

export async function fetchJupyterHealth(): Promise<JupyterHealth> {
  const { data } = await apiClient.get("/jupyter/health");
  return data.data;
}

export async function createJupyterSession(): Promise<JupyterSession> {
  const { data } = await apiClient.post("/jupyter/session");
  return data.data;
}

export async function destroyJupyterSession(): Promise<void> {
  await apiClient.delete("/jupyter/session");
}
```

- [ ] **Step 2: Create the session hook**

```typescript
import { useMutation } from "@tanstack/react-query";
import { createJupyterSession } from "../api";

export function useJupyterSession() {
  return useMutation({
    mutationFn: createJupyterSession,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/jupyter/api.ts frontend/src/features/jupyter/hooks/useJupyterSession.ts
git commit -m "feat(jupyter): add session API and hook for JWT auth flow"
```

---

### Task 9: Update the JupyterPage component

**Files:**
- Modify: `frontend/src/features/jupyter/pages/JupyterPage.tsx`

- [ ] **Step 1: Rewrite JupyterPage with hidden form POST auth and spawn states**

Replace `frontend/src/features/jupyter/pages/JupyterPage.tsx`:

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  ServerCog,
  SquareTerminal,
  BookOpenText,
  Lightbulb,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Drawer } from "@/components/ui/Drawer";
import { useJupyterWorkspace } from "../hooks/useJupyterWorkspace";
import { useJupyterSession } from "../hooks/useJupyterSession";

type ServerState = "idle" | "authenticating" | "spawning" | "running" | "failed";

export default function JupyterPage() {
  const { data, isLoading, isFetching, refetch } = useJupyterWorkspace();
  const session = useJupyterSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(780);
  const [serverState, setServerState] = useState<ServerState>("idle");
  const [helpOpen, setHelpOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recalcHeight = useCallback(() => {
    if (!shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 12;
    setFrameHeight(Math.max(720, available));
  }, []);

  useLayoutEffect(() => {
    recalcHeight();
    window.addEventListener("resize", recalcHeight);
    return () => window.removeEventListener("resize", recalcHeight);
  }, [recalcHeight]);

  // Auto-authenticate when Hub is available and we're idle
  useEffect(() => {
    if (data?.available && serverState === "idle") {
      launchSession();
    }
  }, [data?.available]); // eslint-disable-line react-hooks/exhaustive-deps

  const launchSession = useCallback(() => {
    setServerState("authenticating");
    setErrorMsg(null);

    session.mutate(undefined, {
      onSuccess: (result) => {
        // Submit the JWT via hidden form POST targeting the iframe
        if (formRef.current) {
          const tokenInput = formRef.current.querySelector<HTMLInputElement>('input[name="token"]');
          if (tokenInput) {
            tokenInput.value = result.token;
            formRef.current.action = result.login_url;
            formRef.current.submit();
            setServerState("spawning");
          }
        }
      },
      onError: (error) => {
        setServerState("failed");
        setErrorMsg(error instanceof Error ? error.message : "Failed to create session");
      },
    });
  }, [session]);

  // Poll workspace to detect when server becomes ready
  useEffect(() => {
    if (serverState !== "spawning") return;
    const interval = setInterval(() => {
      void refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [serverState, refetch]);

  // Transition from spawning → running when server is ready
  useEffect(() => {
    if (serverState === "spawning" && data?.server_status === "running") {
      setServerState("running");
    }
  }, [data?.server_status, serverState]);

  const serverBadge = () => {
    switch (serverState) {
      case "idle":
        return <Badge variant={data?.available ? "success" : "critical"}>{data?.available ? "Hub Online" : "Unavailable"}</Badge>;
      case "authenticating":
        return <Badge variant="warning">Authenticating...</Badge>;
      case "spawning":
        return <Badge variant="warning">Starting Server...</Badge>;
      case "running":
        return <Badge variant="success">Running</Badge>;
      case "failed":
        return <Badge variant="critical">Failed</Badge>;
    }
  };

  return (
    <div>
      {/* Hidden form for POST-based JWT auth to iframe */}
      <form
        ref={formRef}
        method="POST"
        target="jupyter-frame"
        style={{ display: "none" }}
      >
        <input type="hidden" name="token" value="" />
      </form>

      {/* ── Page header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 className="page-title">Jupyter Workbench</h1>
            {serverBadge()}
          </div>
          <p className="page-subtitle">
            Your personal notebook environment for interactive research, custom analyses, and data exploration
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={() => {
              setServerState("idle");
              void refetch();
            }}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {serverState === "running" && (
            <a
              href="/jupyter/hub/home"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              Open In New Tab
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Workspace details"
            title="Workspace details"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5A5650] hover:text-[#8A857D] hover:bg-[#1E1E24] transition-colors"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* ── Full-width embedded JupyterLab ── */}
      <div
        ref={shellRef}
        className="panel"
        style={{ position: "relative", overflow: "hidden", padding: 0 }}
      >
        {/* Loading Hub */}
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-teal)" }} />
              Checking JupyterHub...
            </div>
          </div>
        )}

        {/* Hub unavailable */}
        {!isLoading && !data?.available && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
            <EmptyState
              icon={<ServerCog size={28} />}
              title="JupyterHub is not reachable"
              message="The notebook service is currently unavailable. Refresh after the container is healthy."
            />
          </div>
        )}

        {/* Authenticating / Spawning overlay */}
        {(serverState === "authenticating" || serverState === "spawning") && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,14,17,0.88)", backdropFilter: "blur(4px)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-teal)" }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                {serverState === "authenticating" ? "Authenticating..." : "Starting your notebook server..."}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)" }}>
                This may take up to 30 seconds on first launch
              </div>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {serverState === "failed" && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,14,17,0.88)", backdropFilter: "blur(4px)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", maxWidth: 400, textAlign: "center" }}>
              <AlertCircle className="h-6 w-6" style={{ color: "var(--color-crimson)" }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
                Failed to start notebook server
              </div>
              {errorMsg && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {errorMsg}
                </div>
              )}
              <button type="button" onClick={launchSession} className="btn btn-primary" style={{ marginTop: "var(--space-2)" }}>
                Retry
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          name="jupyter-frame"
          title="Parthenon Jupyter"
          style={{ width: "100%", height: frameHeight, border: "none", display: "block" }}
          onLoad={() => {
            if (serverState === "spawning") {
              setServerState("running");
            }
            recalcHeight();
          }}
        />
      </div>

      {/* ── Help drawer with workspace details ── */}
      <Drawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Jupyter Workspace Details"
        size="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Environment info */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <ServerCog size={14} style={{ color: "var(--color-teal)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Environment
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Runtime</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {data?.label ?? "JupyterLab 4.4"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Python 3.12 with pandas, polars, sqlalchemy, and role-based database access.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Private Workspace</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.workspace_path ?? "/home/jovyan/notebooks"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Your personal notebook directory. Persists across sessions — your work is always saved.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Shared Folder</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.shared_path ?? "/home/jovyan/shared"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Copy notebooks here to share with colleagues. All Jupyter users can read this folder.
                </div>
              </div>
            </div>
          </section>

          {/* Mounted paths */}
          {(data?.mounts ?? []).length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                <FolderOpen size={14} style={{ color: "var(--color-gold)" }} />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                  Mounted Paths
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {(data?.mounts ?? []).map((mount) => (
                  <div key={mount.path} className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {mount.label}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-teal)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      {mount.path}
                    </div>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: "var(--space-2)" }}>
                      {mount.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Starter notebooks */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <SquareTerminal size={14} style={{ color: "var(--color-teal)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Starter Notebooks
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {(data?.starter_notebooks ?? []).map((notebook) => (
                <div key={notebook.filename} className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {notebook.name}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    {notebook.filename}
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: "var(--space-2)" }}>
                    {notebook.description}
                  </p>
                </div>
              ))}
              {(data?.starter_notebooks ?? []).length === 0 && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)" }}>
                  No starter notebooks available.
                </p>
              )}
            </div>
          </section>

          {/* Research guidance */}
          {(data?.hints ?? []).length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                <Lightbulb size={14} style={{ color: "var(--color-gold)" }} />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                  Tips
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {data!.hints.map((hint, i) => (
                  <div key={i} className="rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                      <span
                        style={{
                          marginTop: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "rgba(45,212,191,0.15)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          color: "var(--color-teal)",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                        {hint}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick links */}
          <section style={{ borderTop: "1px solid #1E1E24", paddingTop: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <BookOpenText size={14} style={{ color: "var(--color-gold)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Quick Links
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <a
                href="/jupyter/hub/home"
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-teal)", textDecoration: "none" }}
              >
                <ExternalLink size={14} />
                Open JupyterHub in new tab
              </a>
            </div>
          </section>
        </div>
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/jupyter/
git commit -m "feat(jupyter): update frontend for JupyterHub with hidden form POST auth and spawn states"
```

---

## Phase 4: Integration & Deployment

### Task 10: Remove old Jupyter files and deploy

**Files:**
- Delete: `docker/jupyter/Dockerfile`
- Delete: `docker/jupyter/start.sh`

- [ ] **Step 1: Remove old Jupyter Docker files**

```bash
git rm docker/jupyter/Dockerfile docker/jupyter/start.sh
rmdir docker/jupyter
```

- [ ] **Step 2: Build all images**

Run: `docker compose build jupyterhub` and `docker build -t parthenon-jupyter-user -f docker/jupyter-user/Dockerfile .`
Expected: Both images build successfully

- [ ] **Step 3: Stop old Jupyter container**

Run: `docker compose down jupyter` (if it exists — may error if already removed from compose, that's fine)

- [ ] **Step 4: Run database migrations**

Run: `docker compose exec php php artisan migrate`
Expected: Audit log table created, PostgreSQL roles created

- [ ] **Step 5: Clear Laravel caches**

Run: `docker compose exec php php artisan optimize:clear`

- [ ] **Step 6: Start JupyterHub**

Run: `docker compose up -d jupyterhub`
Expected: Hub starts, health check passes within 30 seconds

Run: `docker compose ps jupyterhub`
Expected: Status shows "healthy"

- [ ] **Step 7: Build frontend**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds

- [ ] **Step 8: Copy existing notebooks to shared volume**

```bash
docker cp output/jupyter-notebook/. $(docker compose ps -q jupyterhub):/srv/jupyterhub/shared/legacy/
```

- [ ] **Step 9: Smoke test — verify end-to-end flow**

1. Open https://parthenon.acumenus.net/jupyter
2. Verify Hub Online badge appears
3. Verify "Starting your notebook server..." overlay appears
4. Verify JupyterLab loads in dark mode within the iframe
5. Verify private workspace at `/home/jovyan/notebooks/` contains starter notebook
6. Verify `/home/jovyan/shared/` is accessible
7. Verify `/home/jovyan/parthenon/` is read-only
8. Verify database connection works with role-based credentials (run starter notebook cell)
9. Open help drawer — verify workspace details are correct

- [ ] **Step 10: Commit and push**

```bash
git add -A
git commit -m "feat(jupyter): complete JupyterHub migration — per-user notebooks with SSO, audit, and role-based DB access"
git push
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1. Infrastructure | Tasks 1-4 (incl. 3b) | Docker images, DB migrations, audit archive, compose config |
| 2. Backend API | Tasks 5-7 | JWT sessions, audit endpoint, role mapping |
| 3. Frontend | Tasks 8-9 | Hidden form POST auth, spawn states, updated UI |
| 4. Integration | Task 10 | Full deployment, smoke test, cleanup |

**Total tasks:** 11
**Estimated commits:** 11
