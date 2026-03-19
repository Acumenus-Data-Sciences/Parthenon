FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    ipykernel \
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

WORKDIR /workspace/notebooks

COPY docker/jupyter/start.sh /usr/local/bin/parthenon-jupyter-start

RUN chmod +x /usr/local/bin/parthenon-jupyter-start

# Default to dark theme to match Parthenon UI — set at both system and user level
RUN JUPYTER_DATA=$(python -c "import jupyter_core.paths; print(jupyter_core.paths.jupyter_data_dir())") && \
    mkdir -p "${JUPYTER_DATA}/lab/settings" && \
    echo '{"@jupyterlab/apputils-extension:themes":{"theme":"JupyterLab Dark"}}' \
      > "${JUPYTER_DATA}/lab/settings/overrides.json" && \
    mkdir -p /root/.jupyter/lab/user-settings/@jupyterlab/apputils-extension && \
    echo '{"theme":"JupyterLab Dark"}' \
      > /root/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/themes.jupyterlab-settings

EXPOSE 8888

ENTRYPOINT ["tini", "--", "/usr/local/bin/parthenon-jupyter-start"]
