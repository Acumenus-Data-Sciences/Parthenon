import os
import logging
from importlib import import_module
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health

app = FastAPI(
    title="Parthenon AI Service",
    description="AI/ML service for concept mapping, embeddings, and clinical NLP. Uses Ollama with MedGemma for medical reasoning.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
_logger = logging.getLogger(__name__)

OPTIONAL_ROUTERS: list[tuple[str, dict[str, Any]]] = [
    ("app.routers.embeddings", {"prefix": "/embeddings", "tags": ["embeddings"]}),
    ("app.routers.concept_mapping", {"prefix": "/concept-mapping", "tags": ["concept-mapping"]}),
    ("app.routers.clinical_nlp", {"prefix": "/clinical-nlp", "tags": ["clinical-nlp"]}),
    ("app.routers.profiling", {"prefix": "/profiling", "tags": ["profiling"]}),
    ("app.routers.schema_mapping", {"prefix": "/schema-mapping", "tags": ["schema-mapping"]}),
    ("app.routers.abby", {"prefix": "/abby", "tags": ["abby"]}),
    ("app.routers.chroma", {"prefix": "/chroma", "tags": ["chroma"]}),
    ("app.routers.gis", {"prefix": "/gis", "tags": ["gis"]}),
    ("app.routers.cdm_spatial", {"tags": ["cdm-spatial"]}),
    ("app.routers.gis_analytics", {}),
    ("app.routers.circe", {"prefix": "/circe", "tags": ["circe"]}),
    ("app.routers.study_agent", {"prefix": "/study-agent", "tags": ["study-agent"]}),
    ("app.routers.ariadne", {"prefix": "/ariadne", "tags": ["ariadne"]}),
    ("app.routers.text_to_sql", {"prefix": "/text-to-sql", "tags": ["text-to-sql"]}),
    ("app.routers.gis_import", {}),
]

for module_name, kwargs in OPTIONAL_ROUTERS:
    try:
        module = import_module(module_name)
    except ImportError as exc:
        _logger.warning("Skipping router %s: %s", module_name, exc)
        continue
    app.include_router(module.router, **kwargs)


@app.on_event("startup")
async def startup_ingest_docs() -> None:
    """Auto-ingest documentation on service startup."""
    import asyncio

    if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("PARTHENON_SKIP_STARTUP_INGEST") == "1":
        _logger.info("Skipping startup doc ingestion in test/minimal mode")
        return

    try:
        from app.routers.chroma import DOCS_DIR
        from app.chroma.ingestion import ingest_docs_directory

        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, ingest_docs_directory, DOCS_DIR)
        _logger.info("Documentation ingestion scheduled")
    except ImportError as exc:
        _logger.warning("Startup doc ingestion unavailable: %s", exc)
    except Exception as e:
        _logger.warning("Startup doc ingestion failed (non-fatal): %s", e)
