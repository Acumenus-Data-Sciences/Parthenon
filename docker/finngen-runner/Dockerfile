FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    build-essential \
    gfortran \
    default-jdk-headless \
    ca-certificates \
    git \
    curl \
    cmake \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libgit2-dev \
    libsodium-dev \
    libfontconfig1-dev \
    libcairo2-dev \
    libfribidi-dev \
    libharfbuzz-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    libxt-dev \
    libicu-dev \
    zlib1g-dev \
    libbz2-dev \
    liblzma-dev \
    libreadline-dev \
    libpcre2-dev \
    libpq-dev \
    libglpk-dev \
    r-cran-backports \
    r-cran-checkmate \
    r-cran-cli \
    r-cran-curl \
    r-cran-dbi \
    r-cran-dbplyr \
    r-cran-digest \
    r-cran-dplyr \
    r-cran-dt \
    r-cran-forcats \
    r-cran-ggplot2 \
    r-cran-glue \
    r-cran-gtable \
    r-cran-htmltools \
    r-cran-htmlwidgets \
    r-cran-httr \
    r-cran-jsonlite \
    r-cran-knitr \
    r-cran-lifecycle \
    r-cran-lubridate \
    r-cran-magrittr \
    r-cran-memoise \
    r-cran-pillar \
    r-cran-pkgconfig \
    r-cran-plotly \
    r-cran-plumber \
    r-cran-purrr \
    r-cran-r6 \
    r-cran-ragg \
    r-cran-rcolorbrewer \
    r-cran-rjava \
    r-cran-rlang \
    r-cran-rmarkdown \
    r-cran-scales \
    r-cran-shiny \
    r-cran-shinydashboard \
    r-cran-shinyjs \
    r-cran-stringi \
    r-cran-stringr \
    r-cran-tibble \
    r-cran-tidyr \
    r-cran-tidyselect \
    r-cran-tzdb \
    r-cran-utf8 \
    r-cran-vctrs \
    r-cran-withr \
    r-cran-yaml \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY finngen-runner/server.py /app/server.py
COPY finngen-runner/install_deps.R /app/install_deps.R
COPY docker/finngen-runner/entrypoint.sh /usr/local/bin/finngen-runner-entrypoint.sh

RUN chmod +x /usr/local/bin/finngen-runner-entrypoint.sh

EXPOSE 8786

ENTRYPOINT ["/usr/local/bin/finngen-runner-entrypoint.sh"]
