# SciSpaCy sidecar — preloads en_core_sci_md at build time so the first
# request does not pay the model-load cost. HIPAA-strict per Phase 2
# decision Q3: never reaches out to the internet at runtime; all model
# weights baked into the image.
FROM python:3.12-slim

# Non-root user (HIGHSEC §4.1)
RUN addgroup --system scisvc && adduser --system --ingroup scisvc scisvc

WORKDIR /app

COPY requirements.txt .
# scispacy 0.5.5 ships without v0.5.5 model wheels — the upstream
# README points at v0.5.4 model artifacts (which are compatible).
# Per https://github.com/allenai/scispacy/blob/v0.5.5/README.md.
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir \
      https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_md-0.5.4.tar.gz

# Smoke-load the model so the build fails if the wheel is incompatible
# with the spacy version, not a customer pulling the image.
RUN python -c "import spacy; spacy.load('en_core_sci_md')"

COPY server.py .

USER scisvc

EXPOSE 5101

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5101/health')"

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5101"]
