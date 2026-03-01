FROM rocker/r-ver:4.4

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libsodium-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages(c('plumber', 'jsonlite', 'DBI', 'RPostgres', 'httr2'), repos='https://cloud.r-project.org/')" \
    && R -e "if (!requireNamespace('plumber', quietly=TRUE)) stop('plumber failed to install')"

WORKDIR /app

COPY r-runtime/ .

EXPOSE 8787
CMD ["Rscript", "plumber_api.R"]
