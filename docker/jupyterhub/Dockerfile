FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini nodejs npm \
    && npm install -g configurable-http-proxy \
    && rm -rf /var/lib/apt/lists/* /root/.npm

RUN pip install --no-cache-dir \
    jupyterhub==5.2.1 \
    dockerspawner==13.0.0 \
    jupyterhub-idle-culler==1.4.0 \
    "docker>=7.0.0" \
    PyJWT==2.9.0 \
    requests==2.32.3

# Non-root hub user with Docker group access
RUN groupadd -g 999 docker && \
    useradd -m -s /bin/bash -G docker jupyterhub

COPY docker/jupyterhub/jupyterhub_config.py /srv/jupyterhub/jupyterhub_config.py
COPY docker/jupyterhub/parthenon_auth.py /srv/jupyterhub/parthenon_auth.py

RUN mkdir -p /srv/jupyterhub/data && \
    chown -R jupyterhub:jupyterhub /srv/jupyterhub

WORKDIR /srv/jupyterhub
USER jupyterhub

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["jupyterhub", "--config", "/srv/jupyterhub/jupyterhub_config.py"]
