FROM python:3.12-slim

WORKDIR /opt/study-agent

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Python dependencies
# (submodule code is mounted at /opt/study-agent via docker-compose at runtime)
RUN pip install --no-cache-dir \
    mcp>=1.0.0 \
    pydantic>=2.0.0 \
    httpx \
    anyio \
    faiss-cpu \
    numpy \
    requests \
    pyyaml

# Create data directory for phenotype index
RUN mkdir -p /data/phenotype-index

# Copy entrypoint script
COPY docker/study-agent/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000 8765

ENTRYPOINT ["/app/entrypoint.sh"]
