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
    && rm -rf /var/lib/apt/lists/*

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
  install.packages(c('plumber', 'jsonlite', 'DBI', 'RPostgres', 'httr2')); \
  remotes::install_version('ParallelLogger', version = '3.5.1', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  install.packages(c('rJava', 'duckdb')); \
  if (!requireNamespace('rJava',  quietly = TRUE)) stop('rJava failed'); \
  if (!requireNamespace('duckdb', quietly = TRUE)) stop('duckdb failed'); \
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

# Python packages for PLP sklearn-based models — pinned versions
RUN pip3 install --break-system-packages \
    scikit-learn==1.6.1 \
    numpy==2.2.3 \
    xgboost==2.1.4 \
    lightgbm==4.6.0

# Download PostgreSQL JDBC driver for DatabaseConnector.
# IMPORTANT: must live outside /app because docker-compose mounts ./r-runtime:/app
# at runtime, which would clobber /app/jdbc and make the driver unavailable.
RUN mkdir -p /opt/jdbc && \
    curl -L -o /opt/jdbc/postgresql-42.7.3.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.3.jar
ENV DATABASECONNECTOR_JAR_FOLDER=/opt/jdbc

## ──────────────────────────────────────────────────────────────────
## Stage 2: Application code (fast layer — changes on every edit)
## ──────────────────────────────────────────────────────────────────
FROM hades-base AS runtime

WORKDIR /app

COPY r-runtime/ .

EXPOSE 8787
CMD ["Rscript", "plumber_api.R"]
