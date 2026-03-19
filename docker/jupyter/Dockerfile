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

EXPOSE 8888

ENTRYPOINT ["tini", "--", "/usr/local/bin/parthenon-jupyter-start"]
