# =============================================================================
# Apache Superset — Configuration
# =============================================================================
# Docs: https://superset.apache.org/docs/configuration/configuring-superset
# =============================================================================
import os

# ── Core ────────────────────────────────────────────────────────────────────
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
    imports = ("superset.sql_lab",)
    worker_prefetch_multiplier = 1
    task_acks_late = False


CELERY_CONFIG = CeleryConfig

# ── Feature Flags ───────────────────────────────────────────────────────────
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_EXPLORE_DRAG_AND_DROP": True,
}

# ── Security ────────────────────────────────────────────────────────────────
WTF_CSRF_ENABLED = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"

# ── Display ─────────────────────────────────────────────────────────────────
APP_NAME = "Acropolis Analytics"
SUPERSET_WEBSERVER_TIMEOUT = 300

# ── OMOP Database Connections ───────────────────────────────────────────────
# Pre-configure in Superset UI or via API:
# - postgresql://user:pass@host.docker.internal:5432/ohdsi  (OMOP CDM)
# - postgresql://user:pass@host.docker.internal:5480/parthenon (App DB)
