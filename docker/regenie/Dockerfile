# docker/regenie/Dockerfile
# Thin artifact image — builds regenie v4.1 + plink2 alpha 6.33 binaries
# for consumption by Darkstar via multi-stage COPY (see docker/r/Dockerfile
# layer added in Phase 14 Wave 4). Runs as non-root per HIGHSEC §4.1 when
# built/tested standalone; runtime invocation happens inside Darkstar's
# existing ruser context (per D-14).

# Stage 1: regenie v4.1 (MIT, 2025-01-27; pinned)
FROM debian:12-slim AS regenie-builder
ARG REGENIE_VERSION=v4.1
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fL -o /tmp/regenie.zip \
        "https://github.com/rgcgithub/regenie/releases/download/${REGENIE_VERSION}/regenie_${REGENIE_VERSION}.gz_x86_64_Linux.zip" \
    && unzip /tmp/regenie.zip -d /opt/regenie \
    && chmod +x "/opt/regenie/regenie_${REGENIE_VERSION}.gz_x86_64_Linux" \
    && ln -s "/opt/regenie/regenie_${REGENIE_VERSION}.gz_x86_64_Linux" /opt/regenie/regenie \
    && rm /tmp/regenie.zip

# Stage 2: PLINK2 alpha 6.33 (2026-02-28; pinned) — needed for VCF→PGEN + PCA
FROM debian:12-slim AS plink2-builder
ARG PLINK2_DATE=20260228
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*
# S3 path moved to plink2-assets/alpha6/ in 2026-03 (Chris Chang rotated build
# assets into the alpha6 subdirectory while retaining the 20260228 build date).
# Flagged by RESEARCH.md A2 as a known URL-stability risk; version pin itself
# is unchanged.
RUN curl -fL -o /tmp/plink2.zip \
        "https://s3.amazonaws.com/plink2-assets/alpha6/plink2_linux_avx2_${PLINK2_DATE}.zip" \
    && unzip /tmp/plink2.zip -d /opt/plink2 \
    && chmod +x /opt/plink2/plink2 \
    && rm /tmp/plink2.zip

# Stage 3: final slim artifact image, HIGHSEC §4.1 non-root
FROM debian:12-slim
# regenie's upstream binary is compiled against GCC OpenMP (libgomp1); without
# it, `regenie --version` dies with "libgomp.so.1: cannot open shared object".
# Add only the runtime library (no build-essential) to keep the final layer
# small. ca-certificates is kept for any TLS calls from downstream consumers.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=regenie-builder /opt/regenie /opt/regenie
COPY --from=plink2-builder  /opt/plink2  /opt/plink2
RUN addgroup --system svcgroup \
    && adduser  --system --ingroup svcgroup svcuser \
    && mkdir -p /opt/workdir \
    && chown -R svcuser:svcgroup /opt/workdir /opt/regenie /opt/plink2
USER svcuser
ENV PATH="/opt/regenie:/opt/plink2:${PATH}"
WORKDIR /opt/workdir
