FROM python:3.12-slim

# System deps for pyodbc (SQL Server/Synapse), oracledb, and health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc-dev gcc g++ curl gnupg2 && rm -rf /var/lib/apt/lists/*

# Microsoft ODBC Driver 17 for SQL Server
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
    > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql17 && \
    rm -rf /var/lib/apt/lists/*

# Non-root user (HIGHSEC section 4.1)
RUN addgroup --system blackrabbit && \
    adduser --system --ingroup blackrabbit blackrabbit

WORKDIR /app

COPY blackrabbit/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY blackrabbit/app/ ./app/
RUN chown -R blackrabbit:blackrabbit /app

USER blackrabbit
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
