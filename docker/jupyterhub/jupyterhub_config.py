"""JupyterHub configuration for Parthenon."""

import os
import sys

# Ensure the config directory is importable (for parthenon_auth module)
sys.path.insert(0, "/srv/jupyterhub")

# ── Authentication ──
c.JupyterHub.authenticator_class = "parthenon_auth.ParthenonAuthenticator"
c.Authenticator.enable_auth_state = True
c.Authenticator.auto_login = True
c.Authenticator.allow_all = True  # Authorization is handled by Parthenon RBAC

# ── Base URL ──
c.JupyterHub.base_url = "/jupyter"
c.JupyterHub.bind_url = "http://0.0.0.0:8000/jupyter"

# ── Hub connect URL for spawned containers ──
# Spawned containers need to reach the Hub API. By default the Hub's internal
# API binds on 127.0.0.1:8081 which is unreachable from other containers.
# hub_ip makes the internal API listen on all interfaces so containers can reach it.
# hub_connect_url tells spawned servers the Hub's address on the Docker network.
c.JupyterHub.hub_ip = "0.0.0.0"
c.JupyterHub.hub_bind_url = "http://0.0.0.0:8081"
c.JupyterHub.hub_connect_url = "http://parthenon-jupyterhub:8081"

# ── Iframe embedding ──
c.JupyterHub.tornado_settings = {
    "headers": {
        "Content-Security-Policy": "frame-ancestors 'self' https://parthenon.acumenus.net",
        "X-Frame-Options": "ALLOWALL",
    },
    "xsrf_cookies": False,  # Auth is via signed JWT, not cookies
}

# ── Spawner ──
from dockerspawner import DockerSpawner

c.JupyterHub.spawner_class = DockerSpawner
c.DockerSpawner.image = os.environ.get(
    "JUPYTER_IMAGE",
    "ghcr.io/sudoshi/parthenon-jupyter-user:latest",
)
c.DockerSpawner.pull_policy = os.environ.get("JUPYTER_PULL_POLICY", "ifnotpresent")
c.DockerSpawner.network_name = os.environ.get(
    "JUPYTER_USER_NETWORK_NAME", "parthenon_jupyter_users"
)
c.DockerSpawner.name_template = "parthenon-jupyter-{username}"
c.DockerSpawner.remove = True
c.DockerSpawner.use_internal_ip = True  # Use container IP on the Docker network
c.DockerSpawner.start_timeout = 120  # Allow more time for first pull/start
c.DockerSpawner.debug = True  # Log spawn details

# The user image uses ENTRYPOINT ["tini", "-g", "--"] CMD ["start-singleuser"]
# DockerSpawner reads Config.Cmd — override to use our wrapper script
c.DockerSpawner.cmd = ["start-singleuser"]

# Resource limits
c.DockerSpawner.mem_limit = os.environ.get("JUPYTER_MEM_LIMIT", "2G")
c.DockerSpawner.cpu_limit = float(os.environ.get("JUPYTER_CPU_LIMIT", "1.0"))

# ── Volumes ──
c.DockerSpawner.volumes = {
    "jupyter-{username}": "/home/jovyan/notebooks",
    "jupyter-shared": "/home/jovyan/shared",
}
c.DockerSpawner.read_only_volumes = {
    os.environ.get("PARTHENON_REPO_PATH", "/app"): "/home/jovyan/parthenon",
}

# ── Network: external database access via host-gateway ──
# User containers reach the host DB via the magic 'host-gateway' hostname
DB_HOST_NAME = os.environ.get("PARTHENON_DB_HOST_NAME", "pgsql.acumenus.net")
c.DockerSpawner.extra_host_config = {
    "extra_hosts": {DB_HOST_NAME: "host-gateway"}
}

# ── Credential injection via auth_state_hook ──
ROLE_DB_MAP = {
    "super-admin": ("jupyter_admin", os.environ.get("JUPYTER_DB_ADMIN_PASSWORD", "")),
    "admin": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "researcher": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "data-steward": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
    "mapping-reviewer": ("jupyter_researcher", os.environ.get("JUPYTER_DB_RESEARCHER_PASSWORD", "")),
}
ROLE_PRIORITY = ["super-admin", "admin", "researcher", "data-steward", "mapping-reviewer"]


def auth_state_hook(spawner, auth_state):
    """Inject per-user environment from auth_state into spawned container."""
    if not auth_state:
        return

    user_id = auth_state.get("user_id", "")
    email = auth_state.get("email", "")
    roles = auth_state.get("roles", [])

    # Pick highest-priority role — fail closed
    db_user, db_password = None, None
    for role in ROLE_PRIORITY:
        if role in roles and role in ROLE_DB_MAP:
            db_user, db_password = ROLE_DB_MAP[role]
            break

    if not db_user:
        raise Exception(f"No Jupyter-eligible role for user {user_id} (roles: {roles})")

    spawner.environment.update({
        "PARTHENON_USER_ID": str(user_id),
        "PARTHENON_USER_EMAIL": email,
        "PARTHENON_API_BASE_URL": os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1"),
        "PARTHENON_DB_HOST": DB_HOST_NAME,
        "PARTHENON_DB_PORT": "5432",
        "PARTHENON_DB_NAME": os.environ.get("PARTHENON_DB_NAME", "parthenon"),
        "PARTHENON_DB_USER": db_user,
        "PARTHENON_DB_PASSWORD": db_password,
        "PARTHENON_NOTEBOOK_DIR": "/home/jovyan/notebooks",
        "PARTHENON_REPO_DIR": "/home/jovyan/parthenon",
    })


c.Spawner.auth_state_hook = auth_state_hook

# ── Audit via pre/post spawn hooks ──
import requests as _requests

_API_URL = os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1")
_HUB_API_KEY = os.environ.get("JUPYTER_HUB_API_KEY", "")


def _audit(event, user_id=None, metadata=None):
    try:
        _requests.post(
            f"{_API_URL}/jupyter/audit",
            json={"event": event, "user_id": user_id, "metadata": metadata or {}},
            headers={"X-Hub-Api-Key": _HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass


async def pre_spawn_hook(spawner):
    auth_state = await spawner.user.get_auth_state()
    if auth_state:
        _audit("server.spawn", auth_state.get("user_id"),
               {"email": auth_state.get("email", ""), "container": spawner.object_name})


async def post_stop_hook(spawner):
    auth_state = await spawner.user.get_auth_state()
    if auth_state:
        _audit("server.stop", auth_state.get("user_id"),
               {"reason": "idle_cull_or_manual"})


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
