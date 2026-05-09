ARG PARTHENON_DARKSTAR_IMAGE=ghcr.io/acumenus-data-sciences/parthenon-darkstar:latest
FROM ${PARTHENON_DARKSTAR_IMAGE}

USER root

RUN mkdir -p /srv/parthenon-shiny/app /srv/parthenon-shiny/launches \
    && chown -R ruser:ruser /srv/parthenon-shiny

COPY docker/shiny-ohdsi/app.R /srv/parthenon-shiny/app/app.R
COPY docker/shiny-ohdsi/manifest.R /srv/parthenon-shiny/app/manifest.R
COPY docker/shiny-ohdsi/loaders.R /srv/parthenon-shiny/app/loaders.R
COPY docker/shiny-ohdsi/handoffs.R /srv/parthenon-shiny/app/handoffs.R
RUN chown ruser:ruser /srv/parthenon-shiny/app/app.R /srv/parthenon-shiny/app/manifest.R /srv/parthenon-shiny/app/loaders.R /srv/parthenon-shiny/app/handoffs.R

USER ruser

EXPOSE 3838

ENTRYPOINT []
CMD ["Rscript", "/srv/parthenon-shiny/app/app.R"]
