# Built from MS Tools-for-Health-Data-Anonymization v3.1.1
# Mirrored to ghcr.io/sudoshi/parthenon-fhir-anonymizer:v3.1.1 per spec Q1.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch v3.1.1 \
    https://github.com/microsoft/Tools-for-Health-Data-Anonymization /build/src
WORKDIR /build/src/FHIR/src/Microsoft.Health.Fhir.Anonymizer.R4.CommandLineTool
RUN dotnet publish -c Release -o /out --self-contained false /p:PublishSingleFile=false

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev tini ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 10101 anonsvc \
    && adduser --system --uid 10101 --ingroup anonsvc --home /home/anonsvc \
       --shell /usr/sbin/nologin anonsvc
COPY --from=dotnet-build /out /opt/anonymizer
COPY --from=mcr.microsoft.com/dotnet/runtime:8.0 /usr/share/dotnet /usr/share/dotnet
ENV PATH=/usr/share/dotnet:$PATH
COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
RUN pip install --no-cache-dir --break-system-packages \
        'fastapi==0.115.6' 'uvicorn[standard]==0.32.1'

USER anonsvc
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
