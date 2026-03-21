## ──────────────────────────────────────────────────────────────────
## Stage 1: HADES dependency layer (cached — only rebuilds when
##           packages change, not on every code edit)
## ──────────────────────────────────────────────────────────────────
FROM rocker/r-ver:4.4 AS hades-base

# System dependencies required by HADES / DatabaseConnector / Cyclops / Arrow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libsodium-dev \
    zlib1g-dev \
    cmake \
    default-jdk \
    python3 python3-pip python3-venv \
    curl \
    xz-utils \
    libpcre2-dev \
    libdeflate-dev \
    liblzma-dev \
    libbz2-dev \
    libpng-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libfontconfig1-dev \
    libtiff5-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

# Rust toolchain — required by waysign (plumber2 dependency for cryptographic signing)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# Configure Java for rJava — detect JAVA_HOME from the active JDK
# and bake it into R's Makeconf so rJava can find libjvm at compile time.
RUN JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) \
    && echo "JAVA_HOME=$JAVA_HOME" \
    && R CMD javareconf

# ── Pinned package versions (2026-03-04) ────────────────────────────
# Pin versions to prevent rolling-release breakage.
# To update: check https://ohdsi.r-universe.dev/api/packages/{name}

## Layer 1 — base R plumbing + the two packages that require native compilation
##            (rJava needs javareconf to have run; duckdb compiles a C++ library)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages('remotes'); \
  install.packages(c('plumber2', 'mirai', 'nanonext', 'jsonlite', 'DBI', 'RPostgres', 'httr2', 'callr', 'processx')); \
  remotes::install_version('ParallelLogger', version = '3.5.1', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  install.packages(c('rJava', 'duckdb')); \
  if (!requireNamespace('plumber2', quietly = TRUE)) stop('plumber2 failed'); \
  if (!requireNamespace('mirai',    quietly = TRUE)) stop('mirai failed'); \
  if (!requireNamespace('rJava',    quietly = TRUE)) stop('rJava failed'); \
  if (!requireNamespace('duckdb',   quietly = TRUE)) stop('duckdb failed'); \
"

## Layer 2 — OHDSI connectivity core (depends on rJava + duckdb from layer 1)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_version('SqlRender',          version = '1.19.4', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('DatabaseConnector',  version = '7.1.0',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('Andromeda',          version = '1.2.0',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  if (!requireNamespace('DatabaseConnector', quietly = TRUE)) stop('DatabaseConnector failed'); \
  if (!requireNamespace('Andromeda',         quietly = TRUE)) stop('Andromeda failed'); \
"

## Layer 3 — analytics core (depends on layer 2)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_version('Cyclops',               version = '3.6.0',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('FeatureExtraction',      version = '3.12.0', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('ResultModelManager',     version = '0.6.2',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('EmpiricalCalibration',   version = '3.1.4',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  if (!requireNamespace('Cyclops',            quietly = TRUE)) stop('Cyclops failed'); \
  if (!requireNamespace('FeatureExtraction',  quietly = TRUE)) stop('FeatureExtraction failed'); \
"

## Layer 4 — HADES analysis packages (depends on layers 2 + 3)
## install_github used because r-universe lags behind GitHub releases;
## pinned tags ensure reproducibility.
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/CohortMethod@v6.0.0', \
    'OHDSI/PatientLevelPrediction@v6.5.1', \
    'OHDSI/SelfControlledCaseSeries@v6.1.1', \
    'OHDSI/EvidenceSynthesis@v1.1.0', \
    'OHDSI/CohortGenerator@v1.1.0' \
  ), upgrade = FALSE); \
  if (!requireNamespace('CohortMethod',           quietly = TRUE)) stop('CohortMethod failed'); \
  if (!requireNamespace('PatientLevelPrediction', quietly = TRUE)) stop('PLP failed'); \
"

## Layer 5 — Phase B: Cohort diagnostics + deep learning prediction
## CohortDiagnostics: phenotype evaluation (incidence, orphan concepts, temporal characterization)
## DeepPatientLevelPrediction: neural network models (Transformer, ResNet, MLP) for PLP
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/CohortDiagnostics@v3.4.2', \
    'OHDSI/DeepPatientLevelPrediction@v2.3.0' \
  ), upgrade = FALSE); \
  if (!requireNamespace('CohortDiagnostics',          quietly = TRUE)) stop('CohortDiagnostics failed'); \
  if (!requireNamespace('DeepPatientLevelPrediction', quietly = TRUE)) stop('DeepPLP failed'); \
"

## Layer 6 — Phase C: Study orchestration, incidence, characterization
## Strategus: coordinated multi-analysis study execution
## CohortIncidence: epidemiological incidence rate calculations
## Characterization: standardized baseline characterization with Table 1 + SMD
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/CohortIncidence@v4.1.1', \
    'OHDSI/Characterization@v2.2.0' \
  ), upgrade = FALSE); \
  if (!requireNamespace('CohortIncidence',   quietly = TRUE)) stop('CohortIncidence failed'); \
  if (!requireNamespace('Characterization',  quietly = TRUE)) stop('Characterization failed'); \
  remotes::install_github('OHDSI/Strategus@v1.4.1', upgrade = FALSE); \
  if (!requireNamespace('Strategus', quietly = TRUE)) stop('Strategus failed'); \
"

## Layer 7 — Phase E: ETL tools
## ETL-Synthea: Synthea CSV → OMOP CDM converter for synthetic data generation
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github('OHDSI/ETL-Synthea@v2.1.0', upgrade = FALSE); \
  if (!requireNamespace('ETLSyntheaBuilder', quietly = TRUE)) stop('ETLSyntheaBuilder failed'); \
"

# Python packages for PLP sklearn-based models — pinned versions
# + PyTorch and deps for DeepPatientLevelPrediction (via reticulate)
RUN pip3 install --break-system-packages \
    scikit-learn==1.6.1 \
    numpy==2.2.3 \
    xgboost==2.1.4 \
    lightgbm==4.6.0 \
    torch>=2.7 \
    polars>=1.31.0 \
    pyarrow \
    duckdb \
    tqdm \
    nvidia-ml-py

# Download PostgreSQL JDBC driver for DatabaseConnector.
# IMPORTANT: must live outside /app because docker-compose mounts ./r-runtime:/app
# at runtime, which would clobber /app/jdbc and make the driver unavailable.
RUN mkdir -p /opt/jdbc && \
    curl -L -o /opt/jdbc/postgresql-42.7.3.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.3.jar
ENV DATABASECONNECTOR_JAR_FOLDER=/opt/jdbc

# Pre-warm R namespaces — forces bytecode compilation and DLL loading at build time
# instead of first-request time. Cuts cold-start from ~60s to ~40s.
RUN Rscript -e " \
  options(java.parameters = c('-Xmx2g', '-Xms512m')); \
  suppressMessages({ \
    library(rJava); .jinit(); \
    library(DatabaseConnector); \
    library(CohortMethod); \
    library(PatientLevelPrediction); \
    library(SelfControlledCaseSeries); \
    library(FeatureExtraction); \
    library(callr); \
  }); \
  cat('[BUILD] All core HADES packages pre-warmed successfully\n'); \
"

# s6-overlay — lightweight process supervisor for proper PID 1 and crash recovery
ARG S6_OVERLAY_VERSION=3.2.0.2
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz && \
    rm /tmp/s6-overlay-*.tar.xz

## ──────────────────────────────────────────────────────────────────
## Stage 2: Application code (fast layer — changes on every edit)
## ──────────────────────────────────────────────────────────────────
FROM hades-base AS runtime

# Create non-root user for service execution (HIGHSEC §4.1)
# s6-overlay runs as root for PID 1, then drops to ruser for the plumber service
RUN addgroup --system ruser && adduser --system --ingroup ruser --home /home/ruser ruser \
    && mkdir -p /home/ruser && chown -R ruser:ruser /home/ruser

WORKDIR /app

COPY r-runtime/ .
RUN chown -R ruser:ruser /app

# s6-overlay service registration
COPY r-runtime/s6/plumber/ /etc/s6-overlay/s6-rc.d/plumber/
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/plumber

# Ensure JDBC driver directory is readable by ruser
RUN chown -R ruser:ruser /opt/jdbc

EXPOSE 8787

# s6-overlay as PID 1 — manages Valve which manages Plumber processes
# s6 runs as root for init, plumber service should use S6_USER to drop privileges
ENV S6_VERBOSITY=1
ENTRYPOINT ["/init"]
