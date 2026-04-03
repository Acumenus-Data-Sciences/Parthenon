# =============================================================================
# Apache Superset — Configuration
# =============================================================================
# Docs: https://superset.apache.org/docs/configuration/configuring-superset
#
# Authentication: Authentik OIDC via Flask-AppBuilder OAuth2.
# Forward-auth gate preserved as defense-in-depth via Traefik middleware.
# =============================================================================
import os
from flask_appbuilder.security.manager import AUTH_OAUTH

# ── Core ────────────────────────────────────────────────────────────────────
ENABLE_PROXY_FIX = True
PROXY_FIX_CONFIG = {"x_for": 1, "x_proto": 1, "x_host": 1, "x_port": 1, "x_prefix": 1}
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY", "CHANGE_ME_TO_A_RANDOM_SECRET")
SQLALCHEMY_DATABASE_URI = (
    f"postgresql://"
    f"{os.environ.get('DATABASE_USER', 'superset')}:"
    f"{os.environ.get('DATABASE_PASSWORD', 'superset')}@"
    f"{os.environ.get('DATABASE_HOST', 'superset-db')}:"
    f"{os.environ.get('DATABASE_PORT', '5432')}/"
    f"{os.environ.get('DATABASE_DB', 'superset')}"
)

# ── Cache ───────────────────────────────────────────────────────────────────
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": os.environ.get("REDIS_HOST", "superset-cache"),
    "CACHE_REDIS_PORT": int(os.environ.get("REDIS_PORT", "6379")),
    "CACHE_REDIS_DB": 1,
}

DATA_CACHE_CONFIG = {**CACHE_CONFIG, "CACHE_DEFAULT_TIMEOUT": 600}
FILTER_STATE_CACHE_CONFIG = {**CACHE_CONFIG, "CACHE_DEFAULT_TIMEOUT": 600}
EXPLORE_FORM_DATA_CACHE_CONFIG = {**CACHE_CONFIG, "CACHE_DEFAULT_TIMEOUT": 600}

# ── Celery ──────────────────────────────────────────────────────────────────
class CeleryConfig:
    broker_url = f"redis://{os.environ.get('REDIS_HOST', 'superset-cache')}:{os.environ.get('REDIS_PORT', '6379')}/0"
    result_backend = broker_url
    imports = ("superset.sql_lab", "superset.tasks.scheduler", "superset.tasks.thumbnails", "superset.tasks.cache")
    worker_prefetch_multiplier = 1
    task_acks_late = False


CELERY_CONFIG = CeleryConfig

# ── Feature Flags ───────────────────────────────────────────────────────────
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_EXPLORE_DRAG_AND_DROP": True,
}

# ── Security ────────────────────────────────────────────────────────────────
WTF_CSRF_ENABLED = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"

# ── Authentik OIDC ─────────────────────────────────────────────────────────
DOMAIN = os.environ.get("DOMAIN", "acumenus.net")
AUTH_TYPE = AUTH_OAUTH
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "Public"
OAUTH_PROVIDERS = [
    {
        "name": "authentik",
        "icon": "fa-key",
        "token_key": "access_token",
        "remote_app": {
            "client_id": os.environ.get("SUPERSET_OAUTH_CLIENT_ID"),
            "client_secret": os.environ.get("SUPERSET_OAUTH_CLIENT_SECRET"),
            "api_base_url": f"https://auth.{DOMAIN}/application/o/",
            "access_token_url": f"https://auth.{DOMAIN}/application/o/token/",
            "authorize_url": f"https://auth.{DOMAIN}/application/o/authorize/",
            "server_metadata_url": f"https://auth.{DOMAIN}/application/o/superset-oidc/.well-known/openid-configuration",
            "client_kwargs": {"scope": "openid profile email"},
        },
    }
]

# ── Display ─────────────────────────────────────────────────────────────────
APP_NAME = "Acropolis Analytics"
SUPERSET_WEBSERVER_TIMEOUT = 300

# ── Theming (Superset 6.0+ Ant Design v5) ──────────────────────────────────
THEME_DEFAULT = {
    "token": {
        "brandAppName": "Acropolis Analytics",
    }
}

# ── OMOP Database Connections ───────────────────────────────────────────────
# Pre-configure in Superset UI or via API:
# - postgresql://user:pass@host.docker.internal:5432/ohdsi  (OMOP CDM)
# - postgresql://user:pass@host.docker.internal:5480/parthenon (App DB)
