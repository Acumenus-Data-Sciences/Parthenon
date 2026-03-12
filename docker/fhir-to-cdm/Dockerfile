# =============================================================================
# Stage 1: Builder — clone OHDSI/FhirToCdm and publish the .NET CLI tool
# =============================================================================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone the OHDSI FhirToCdm repository (shallow, latest default branch)
RUN git clone --depth 1 https://github.com/OHDSI/FhirToCdm.git .

# Publish as a self-contained, release-mode binary bundle
# The project file lives at the repo root under FHIRtoCDM/
RUN dotnet publish FHIRtoCDM/FHIRtoCDM.csproj \
        -c Release \
        -r linux-x64 \
        --self-contained false \
        -o /app/publish

# =============================================================================
# Stage 2: Runtime — minimal ASP.NET runtime + Python HTTP wrapper
# =============================================================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0

# Install Python 3, pip, curl (healthcheck), and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install minimal Python dependencies for the wrapper
RUN pip3 install --no-cache-dir --break-system-packages \
    psycopg2-binary

# Create a non-root user
RUN useradd --system --no-create-home --shell /usr/sbin/nologin fhircdm

WORKDIR /app

# Copy the published .NET tool from the builder stage
COPY --from=builder /app/publish ./dotnet/

# Copy Python HTTP wrapper
COPY wrapper.py ./wrapper.py

# Create working directories for temp FHIR files and CDM output
RUN mkdir -p /tmp/fhir_input /tmp/cdm_output \
    && chown -R fhircdm:fhircdm /app /tmp/fhir_input /tmp/cdm_output

# Ensure the .NET binary is executable
RUN chmod +x /app/dotnet/FHIRtoCDM

USER fhircdm

EXPOSE 8091

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8091/health || exit 1

CMD ["python3", "/app/wrapper.py"]
