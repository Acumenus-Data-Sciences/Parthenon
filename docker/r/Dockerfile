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
    && rm -rf /var/lib/apt/lists/*

# Configure Java for rJava — detect JAVA_HOME from the active JDK
# and bake it into R's Makeconf so rJava can find libjvm at compile time.
RUN JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) \
    && echo "JAVA_HOME=$JAVA_HOME" \
    && R CMD javareconf

## Layer 1 — base R plumbing + the two packages that require native compilation
##            (rJava needs javareconf to have run; duckdb compiles a C++ library)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages(c( \
    'plumber', 'jsonlite', 'DBI', 'RPostgres', 'httr2', 'remotes', \
    'ParallelLogger', \
    'rJava', \
    'duckdb' \
  )); \
  if (!requireNamespace('rJava',  quietly = TRUE)) stop('rJava failed'); \
  if (!requireNamespace('duckdb', quietly = TRUE)) stop('duckdb failed'); \
"

## Layer 2 — OHDSI connectivity core (depends on rJava + duckdb from layer 1)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages(c('SqlRender', 'DatabaseConnector', 'Andromeda')); \
  if (!requireNamespace('DatabaseConnector', quietly = TRUE)) stop('DatabaseConnector failed'); \
  if (!requireNamespace('Andromeda',         quietly = TRUE)) stop('Andromeda failed'); \
"

## Layer 3 — analytics core (depends on layer 2)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages(c( \
    'Cyclops', 'FeatureExtraction', \
    'ResultModelManager', 'EmpiricalCalibration' \
  )); \
  if (!requireNamespace('Cyclops',            quietly = TRUE)) stop('Cyclops failed'); \
  if (!requireNamespace('FeatureExtraction',  quietly = TRUE)) stop('FeatureExtraction failed'); \
"

## Layer 4 — HADES analysis packages (depends on layers 2 + 3)
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages(c( \
    'CohortMethod', 'PatientLevelPrediction', \
    'SelfControlledCaseSeries', 'EvidenceSynthesis', \
    'CohortGenerator' \
  )); \
  if (!requireNamespace('CohortMethod',           quietly = TRUE)) stop('CohortMethod failed'); \
  if (!requireNamespace('PatientLevelPrediction', quietly = TRUE)) stop('PLP failed'); \
"

# Python packages for PLP sklearn-based models (GBM, RF, AdaBoost, etc.)
RUN pip3 install --break-system-packages scikit-learn numpy xgboost lightgbm

# Download PostgreSQL JDBC driver for DatabaseConnector
RUN mkdir -p /app/jdbc && \
    curl -L -o /app/jdbc/postgresql-42.7.3.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.3.jar
ENV DATABASECONNECTOR_JAR_FOLDER=/app/jdbc

## ──────────────────────────────────────────────────────────────────
## Stage 2: Application code (fast layer — changes on every edit)
## ──────────────────────────────────────────────────────────────────
FROM hades-base AS runtime

WORKDIR /app

COPY r-runtime/ .

EXPOSE 8787
CMD ["Rscript", "plumber_api.R"]
