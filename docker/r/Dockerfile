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
    && R CMD javareconf \
    && rm -rf /var/lib/apt/lists/*

# CRAN + OHDSI R-universe repos
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  install.packages(c( \
    'plumber', 'jsonlite', 'DBI', 'RPostgres', 'httr2', 'remotes', \
    'rJava', 'DatabaseConnector', 'SqlRender', 'Cyclops', \
    'Andromeda', 'ParallelLogger', 'FeatureExtraction', \
    'CohortMethod', 'PatientLevelPrediction', \
    'SelfControlledCaseSeries', 'EvidenceSynthesis', \
    'CohortGenerator', 'EmpiricalCalibration', \
    'ResultModelManager' \
  )); \
  if (!requireNamespace('CohortMethod', quietly = TRUE)) stop('CohortMethod failed'); \
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
