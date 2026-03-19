FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    ipykernel \
    jupyterhub==5.2.1 \
    jupyterlab==4.4.1 \
    matplotlib \
    numpy \
    pandas \
    polars \
    pyarrow \
    "psycopg[binary]" \
    requests \
    seaborn \
    sqlalchemy

# Create non-root user
RUN useradd -m -s /bin/bash -N jovyan && \
    mkdir -p /home/jovyan/notebooks /home/jovyan/shared /home/jovyan/parthenon

# Backward-compat symlinks for existing notebooks that reference /workspace/*
RUN mkdir -p /workspace && \
    ln -s /home/jovyan/notebooks /workspace/notebooks && \
    ln -s /home/jovyan/parthenon /workspace/parthenon

# Dark theme — system + user level
RUN JUPYTER_DATA=$(python -c "import jupyter_core.paths; print(jupyter_core.paths.jupyter_data_dir())") && \
    mkdir -p "${JUPYTER_DATA}/lab/settings" && \
    echo '{"@jupyterlab/apputils-extension:themes":{"theme":"JupyterLab Dark"}}' \
      > "${JUPYTER_DATA}/lab/settings/overrides.json" && \
    mkdir -p /home/jovyan/.jupyter/lab/user-settings/@jupyterlab/apputils-extension && \
    echo '{"theme":"JupyterLab Dark"}' \
      > /home/jovyan/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/themes.jupyterlab-settings

# Server config — allow iframe embedding from Parthenon
COPY docker/jupyter-user/jupyter_server_config.py /home/jovyan/.jupyter/jupyter_server_config.py

# Startup script for first-spawn initialization
COPY docker/jupyter-user/start.sh /usr/local/bin/start-singleuser
RUN chmod +x /usr/local/bin/start-singleuser && \
    chown -R jovyan:users /home/jovyan

WORKDIR /home/jovyan/notebooks
USER jovyan

EXPOSE 8888

# tini as init, start.sh does first-spawn setup then execs jupyterhub-singleuser
ENTRYPOINT ["tini", "-g", "--"]
CMD ["start-singleuser"]
