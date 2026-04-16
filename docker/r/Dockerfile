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
    libcairo2-dev \
    libxt-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Rust toolchain — required by waysign (plumber2 dependency for cryptographic signing)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# Configure Java for rJava — detect JAVA_HOME from the active JDK
# and bake it into R's Makeconf so rJava can find libjvm at compile time.
RUN JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java)))) \
    && echo "JAVA_HOME=$JAVA_HOME" \
    && R CMD javareconf

# ── Pinned package versions (2026-03-26) ────────────────────────────
# Pin versions to prevent rolling-release breakage.
# To update: run scripts/darkstar-version-check.sh
# or check https://ohdsi.r-universe.dev/api/packages/{name}

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
  remotes::install_version('SqlRender',          version = '1.19.5', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
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
  remotes::install_version('Cyclops',               version = '3.7.0',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('FeatureExtraction',      version = '3.13.0', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('ResultModelManager',     version = '0.6.2',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('EmpiricalCalibration',   version = '3.1.4',  repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  if (!requireNamespace('Cyclops',            quietly = TRUE)) stop('Cyclops failed'); \
  if (!requireNamespace('FeatureExtraction',  quietly = TRUE)) stop('FeatureExtraction failed'); \
"

# Patch FeatureExtraction SQL: cap concept_ids to prevent INT overflow.
# OMOP CDM extension vocabularies (SNOMED CT) use concept_ids > 2^31 which
# overflow INT when FeatureExtraction computes covariate_id = concept_id * 1000.
# BIGINT would fix SQL but R numeric loses precision above 2^53 and Andromeda
# (DuckDB) corrupts integer64 values. Safest fix: exclude oversized concept_ids
# from covariate construction (they are rare SNOMED extension codes).
RUN FE_SQL="/usr/local/lib/R/site-library/FeatureExtraction/sql/sql_server" && \
    sed -i 's|AND @domain_concept_id != 0|AND @domain_concept_id != 0\n\t\tAND @domain_concept_id < 2147483|g' \
        "$FE_SQL/DomainConcept.sql" "$FE_SQL/DomainConceptGroup.sql" && \
    sed -i 's|WHERE @domain_concept_id != 0|WHERE @domain_concept_id != 0\n\t\tAND @domain_concept_id < 2147483|g' \
        "$FE_SQL/DomainConcept.sql" "$FE_SQL/DomainConceptGroup.sql"

## Layer 4 — HADES analysis packages (depends on layers 2 + 3)
## install_github used because r-universe lags behind GitHub releases;
## pinned tags ensure reproducibility.
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/CohortMethod@v6.0.1', \
    'OHDSI/PatientLevelPrediction@v6.6.0', \
    'OHDSI/SelfControlledCaseSeries@v6.1.1', \
    'OHDSI/EvidenceSynthesis@v1.1.0', \
    'OHDSI/CohortGenerator@v1.1.0' \
  ), upgrade = FALSE); \
  if (!requireNamespace('CohortMethod',           quietly = TRUE)) stop('CohortMethod failed'); \
  if (!requireNamespace('PatientLevelPrediction', quietly = TRUE)) stop('PLP failed'); \
"

## Layer 5 — Phase B: Cohort diagnostics + DQD + deep learning prediction
## CohortDiagnostics: phenotype evaluation (incidence, orphan concepts, temporal characterization)
## DataQualityDashboard: OHDSI DQ checks (now on CRAN as of Feb 2026)
## DeepPatientLevelPrediction: neural network models (Transformer, ResNet, MLP) for PLP
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github('OHDSI/CohortDiagnostics@v3.4.2', upgrade = FALSE); \
  remotes::install_version('DataQualityDashboard', version = '2.8.7', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_github('OHDSI/DeepPatientLevelPrediction@v2.3.0', upgrade = FALSE); \
  if (!requireNamespace('CohortDiagnostics',          quietly = TRUE)) stop('CohortDiagnostics failed'); \
  if (!requireNamespace('DataQualityDashboard',       quietly = TRUE)) stop('DQD failed'); \
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
  remotes::install_github('OHDSI/CohortIncidence@v4.1.1', upgrade = FALSE); \
  remotes::install_version('Characterization', version = '3.0.0', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  if (!requireNamespace('CohortIncidence',   quietly = TRUE)) stop('CohortIncidence failed'); \
  if (!requireNamespace('Characterization',  quietly = TRUE)) stop('Characterization failed'); \
  remotes::install_github('OHDSI/Strategus@v1.5.0', upgrade = FALSE); \
  if (!requireNamespace('Strategus', quietly = TRUE)) stop('Strategus failed'); \
"

## Layer 7A — OHDSI parity packages from r-universe
## Runtime-capability parity for package-native OHDSI workflows. Native React
## remains the preferred UI for Shiny-adjacent capabilities; the packages are
## installed so report/artifact imports and method-specific endpoints can load.
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_version('TreatmentPatterns', version = '3.1.2', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('Achilles', version = '1.7.2', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('CirceR', version = '1.3.3', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('OhdsiReportGenerator', version = '2.1.0', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('BrokenAdaptiveRidge', version = '1.0.2', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  remotes::install_version('IterativeHardThresholding', version = '1.0.3', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')); \
  tryCatch( \
    remotes::install_version('OhdsiShinyAppBuilder', version = '1.0.0', repos = c('https://ohdsi.r-universe.dev', 'https://cloud.r-project.org')), \
    error = function(e) message('[BUILD] OhdsiShinyAppBuilder install skipped (optional, needs devtools): ', conditionMessage(e)) \
  ); \
  parity_pkgs <- c( \
    'TreatmentPatterns', 'Achilles', 'CirceR', 'OhdsiReportGenerator', \
    'BrokenAdaptiveRidge', 'IterativeHardThresholding' \
  ); \
  missing <- parity_pkgs[!vapply(parity_pkgs, requireNamespace, logical(1), quietly = TRUE)]; \
  if (length(missing) > 0) stop('OHDSI r-universe parity package install failed: ', paste(missing, collapse = ', ')); \
  cat('[BUILD] OHDSI r-universe parity packages installed:', paste(parity_pkgs, collapse = ', '), '\n'); \
"

## Layer 7B — OHDSI method + authoring parity packages from pinned GitHub tags
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/SelfControlledCohort@v1.6.0', \
    'OHDSI/PheValuator@v2.2.16', \
    'OHDSI/EnsemblePatientLevelPrediction@v1.0.3', \
    'OHDSI/Capr@v2.1.1', \
    'OHDSI/PhenotypeLibrary@v3.37.0' \
  ), upgrade = FALSE); \
  parity_pkgs <- c( \
    'SelfControlledCohort', 'PheValuator', 'EnsemblePatientLevelPrediction', \
    'Capr', 'PhenotypeLibrary' \
  ); \
  missing <- parity_pkgs[!vapply(parity_pkgs, requireNamespace, logical(1), quietly = TRUE)]; \
  if (length(missing) > 0) stop('OHDSI method parity package install failed: ', paste(missing, collapse = ', ')); \
  cat('[BUILD] OHDSI method parity packages installed:', paste(parity_pkgs, collapse = ', '), '\n'); \
"

## Layer 7C — OHDSI sharing, exploration, method evaluation, and Shiny compatibility
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github(c( \
    'OHDSI/OhdsiSharing@v0.2.2', \
    'OHDSI/CohortExplorer@v0.1.0', \
    'OHDSI/MethodEvaluation@v2.4.0', \
    'OHDSI/BigKNN@v1.0.2', \
    'OHDSI/OhdsiShinyModules@v3.5.0', \
    'OHDSI/Keeper@v2.0.0' \
  ), upgrade = FALSE); \
  parity_pkgs <- c( \
    'OhdsiSharing', 'CohortExplorer', 'MethodEvaluation', \
    'BigKnn', 'OhdsiShinyModules', 'Keeper' \
  ); \
  missing <- parity_pkgs[!vapply(parity_pkgs, requireNamespace, logical(1), quietly = TRUE)]; \
  if (length(missing) > 0) stop('OHDSI sharing/exploration parity package install failed: ', paste(missing, collapse = ', ')); \
  cat('[BUILD] OHDSI sharing/exploration parity packages installed:', paste(parity_pkgs, collapse = ', '), '\n'); \
"

## Layer 8 — Phase E: ETL tools
## ETL-Synthea: Synthea CSV → OMOP CDM converter for synthetic data generation
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github('OHDSI/ETL-Synthea@v2.1.0', upgrade = FALSE); \
  if (!requireNamespace('ETLSyntheaBuilder', quietly = TRUE)) stop('ETLSyntheaBuilder failed'); \
"

## Layer 9 — FinnGen SP1: ROMOPAPI + HadesExtras + CO2AnalysisModules.
## Depends on HADES stack (CohortGenerator, FeatureExtraction, CohortIncidence, etc.).
## CO2AnalysisModules: load via CO2AnalysisModules::execute_* only — never library()
## (its Shiny transitive deps pollute the runtime). SP4 replaces the CO2 Shiny UI
## with native React; SP1 uses only its execute_CodeWAS / execute_CohortOverlaps /
## execute_DBProfile functions.
## See docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md
## Commits pinned 2026-04-12 — bump refs after validating upstream changes.
RUN R -e " \
  options(repos = c( \
    OHDSI = 'https://ohdsi.r-universe.dev', \
    CRAN  = 'https://cloud.r-project.org' \
  )); \
  remotes::install_github('FINNGEN/ROMOPAPI',           ref = '49b67615e20e06119a8b54bb65606e90d3acaa67', upgrade = FALSE, dependencies = TRUE); \
  remotes::install_github('FINNGEN/HadesExtras',        ref = '2b5dd3f9f3de0777a1a1e497225f5b0bfb5ef152', upgrade = FALSE, dependencies = TRUE); \
  remotes::install_github('FINNGEN/CO2AnalysisModules', ref = '8555f45715af94b4a8988e1e96380a6b4f3dcff5', upgrade = FALSE, dependencies = TRUE); \
  if (!requireNamespace('ROMOPAPI',           quietly = TRUE)) stop('ROMOPAPI failed'); \
  if (!requireNamespace('HadesExtras',        quietly = TRUE)) stop('HadesExtras failed'); \
  if (!requireNamespace('CO2AnalysisModules', quietly = TRUE)) stop('CO2AnalysisModules failed'); \
  cat('[BUILD] FinnGen packages installed: ROMOPAPI, HadesExtras, CO2AnalysisModules\n'); \
"

# pandoc is a runtime dep for ROMOPAPI::createReport (R Markdown → HTML).
# Installed as a LATE layer so future apt changes don't invalidate the R-package
# cache above (adding pandoc alone: ~30s; invalidating the apt base layer: ~30-60min).
RUN apt-get update && apt-get install -y --no-install-recommends pandoc \
    && rm -rf /var/lib/apt/lists/*

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

COPY darkstar/ .
RUN chown -R ruser:ruser /app

# s6-overlay service registration
COPY darkstar/s6/plumber/ /etc/s6-overlay/s6-rc.d/plumber/
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/plumber

# FinnGen artifact-volume cont-init (oneshot) — sets /opt/finngen-artifacts
# ownership to ruser:ruser with setgid dirs BEFORE plumber starts.
# plumber depends on this via darkstar/s6/plumber/dependencies.d/finngen-artifacts-init
COPY darkstar/s6/finngen-artifacts-init/ /etc/s6-overlay/s6-rc.d/finngen-artifacts-init/
COPY darkstar/s6/scripts/finngen-artifacts-init.sh /etc/s6-overlay/scripts/finngen-artifacts-init.sh
RUN chmod +x /etc/s6-overlay/scripts/finngen-artifacts-init.sh && \
    touch /etc/s6-overlay/s6-rc.d/user/contents.d/finngen-artifacts-init

# Ensure JDBC driver directory is readable by ruser
RUN chown -R ruser:ruser /opt/jdbc

EXPOSE 8787

# s6-overlay as PID 1 — manages Valve which manages Plumber processes
# s6 runs as root for init, plumber service should use S6_USER to drop privileges
ENV S6_VERBOSITY=1
ENTRYPOINT ["/init"]
