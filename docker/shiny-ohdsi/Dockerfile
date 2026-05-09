ARG PARTHENON_DARKSTAR_IMAGE=ghcr.io/acumenus-data-sciences/parthenon-darkstar:latest
FROM ${PARTHENON_DARKSTAR_IMAGE}

USER root

RUN mkdir -p /opt/parthenon-shiny/app /srv/parthenon-shiny/launches \
    && chown -R ruser:ruser /srv/parthenon-shiny

COPY docker/shiny-ohdsi/app.R /opt/parthenon-shiny/app/app.R
COPY docker/shiny-ohdsi/manifest.R /opt/parthenon-shiny/app/manifest.R
COPY docker/shiny-ohdsi/loaders.R /opt/parthenon-shiny/app/loaders.R
COPY docker/shiny-ohdsi/handoffs.R /opt/parthenon-shiny/app/handoffs.R
RUN chown -R ruser:ruser /opt/parthenon-shiny/app

USER ruser

EXPOSE 3838

ENTRYPOINT []
CMD ["Rscript", "/opt/parthenon-shiny/app/app.R"]
