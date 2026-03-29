FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Non-root user per HIGHSEC spec with a writable home directory
RUN addgroup --system poseidon && adduser --system --home /app/storage --ingroup poseidon poseidon

WORKDIR /app

# Install Python dependencies before copying full source (layer caching)
COPY poseidon/pyproject.toml /app/poseidon/

# Install the poseidon package and all its dependencies
RUN pip install --no-cache-dir /app/poseidon || \
    pip install --no-cache-dir \
        "dagster>=1.9,<2.0" \
        "dagster-webserver>=1.9,<2.0" \
        "dagster-dbt>=0.25,<1.0" \
        "dagster-postgres>=0.25,<1.0" \
        "dbt-postgres>=1.9,<2.0" \
        "sqlalchemy>=2.0,<3.0" \
        "psycopg2-binary>=2.9,<3.0" \
        "httpx>=0.27,<1.0" \
        "redis>=5.0,<6.0" \
        "pydantic>=2.0,<3.0" \
        "pydantic-settings>=2.0,<3.0"

# Install dbt packages (runs dbt deps; tolerate missing packages.yml gracefully)
COPY poseidon/dbt/ /app/poseidon/dbt/
RUN cd /app/poseidon/dbt && dbt deps --profiles-dir /app/poseidon/dbt || true

# Copy full poseidon source (overwrites partial copies above with final version)
COPY poseidon/ /app/poseidon/

# Create storage directory for Dagster run/event/schedule storage
RUN mkdir -p /app/storage && chown -R poseidon:poseidon /app/storage /app/poseidon

# Copy and configure entrypoint
COPY poseidon/docker/poseidon/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER poseidon

EXPOSE 3100

ENTRYPOINT ["/app/entrypoint.sh"]
