ARG PARTHENON_DARKSTAR_IMAGE=ghcr.io/sudoshi/parthenon-darkstar:latest
FROM ${PARTHENON_DARKSTAR_IMAGE}

USER root

RUN mkdir -p /srv/parthenon-shiny/app /srv/parthenon-shiny/launches \
    && chown -R ruser:ruser /srv/parthenon-shiny

COPY docker/shiny-ohdsi/app.R /srv/parthenon-shiny/app/app.R
RUN chown ruser:ruser /srv/parthenon-shiny/app/app.R

USER ruser

EXPOSE 3838

ENTRYPOINT []
CMD ["Rscript", "/srv/parthenon-shiny/app/app.R"]
