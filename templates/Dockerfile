# Parthenon ingestion-templates runtime container.
# Runs FastAPI + Prefect server in-process under tini + honcho.
# Non-root user per HIGHSEC §4.1.

FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_CACHE_DIR=/tmp/uv-cache \
    UV_LINK_MODE=copy

# tini for proper PID-1 signal handling; build-essential pruned post-install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tini \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

# Non-root user (HIGHSEC §4.1).
RUN addgroup --system templates \
    && adduser --system --ingroup templates templates --home /home/templates --shell /usr/sbin/nologin

# Install uv as the non-root user's package manager.
RUN pip install --no-cache-dir uv==0.5.11

WORKDIR /app

# Copy project metadata first to maximize layer cache hits.
COPY --chown=templates:templates templates/pyproject.toml templates/README.md /app/templates/
COPY --chown=templates:templates templates/runtime /app/templates/runtime
COPY --chown=templates:templates templates/manifests /app/templates/manifests
COPY --chown=templates:templates docker/templates/honcho.cfg /app/honcho.cfg
COPY --chown=templates:templates docker/templates/entrypoint.sh /app/entrypoint.sh

RUN chmod 0755 /app/entrypoint.sh

# Storage volume mount target (matches docker-compose.yml).
RUN mkdir -p /var/parthenon/storage/templates \
    && chown -R templates:templates /var/parthenon /app

USER templates

# Build a venv inside the user home and install pinned deps.
ENV VIRTUAL_ENV=/home/templates/.venv \
    PATH="/home/templates/.venv/bin:${PATH}"
RUN uv venv /home/templates/.venv \
    && cd /app/templates \
    && uv pip install --python /home/templates/.venv/bin/python -e .

ENV PARTHENON_TEMPLATES_HOME=/app/templates \
    PARTHENON_STORAGE_ROOT=/var/parthenon/storage/templates \
    PREFECT_HOME=/home/templates/.prefect \
    PREFECT_API_URL=http://127.0.0.1:4200/api

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
CMD ["honcho", "-f", "/app/honcho.cfg", "start"]
