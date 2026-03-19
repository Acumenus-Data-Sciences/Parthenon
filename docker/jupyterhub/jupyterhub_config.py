"""JupyterHub configuration for Parthenon."""

import os
import sys
import requests
from dockerspawner import DockerSpawner

# Ensure the config directory is importable
sys.path.insert(0, "/srv/jupyterhub")

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

# ── Network: Database access ──
# The host PostgreSQL is at pgsql.acumenus.net (not Docker postgres).
# User containers on the isolated jupyter_users network need extra_hosts to reach it.
DB_HOST_IP = os.environ.get("PARTHENON_DB_HOST_IP", "")
DB_HOST_NAME = os.environ.get("PARTHENON_DB_HOST_NAME", "pgsql.acumenus.net")

if DB_HOST_IP:
    c.DockerSpawner.extra_host_config = {"extra_hosts": [f"{DB_HOST_NAME}:{DB_HOST_IP}"]}

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
        "PARTHENON_DB_HOST": DB_HOST_NAME,
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
