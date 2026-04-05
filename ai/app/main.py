import os
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from importlib import import_module
from typing import Any

# Force CPU-only mode — prevents meta tensor errors in uvicorn workers.
# torch 2.10+cu128 auto-detects CUDA at import which causes SentenceTransformer
# to use meta tensors during model loading. Disabling CUDA built-in check
# forces pure CPU path, which works correctly in forked workers.
try:
    import torch
    torch.set_default_device("cpu")
    torch.backends.cuda.is_built = lambda: False  # type: ignore[assignment]
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health

if not settings.database_url:
    raise RuntimeError("DATABASE_URL must be set")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup/shutdown lifecycle handler (replaces deprecated on_event)."""
    await _startup_ingest_docs()
    await _startup_warm_embedders()
    await _startup_warm_ollama()
    yield


app = FastAPI(
    title="Parthenon AI Service",
    description="AI/ML service for concept mapping, embeddings, and clinical NLP. Uses Ollama with MedGemma for medical reasoning.",
    version="0.1.0",
    lifespan=lifespan,
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
    ("app.routers.genomics", {}),
    ("app.routers.patient_similarity", {"tags": ["patient-similarity"]}),
]

for module_name, kwargs in OPTIONAL_ROUTERS:
    try:
        module = import_module(module_name)
    except ImportError as exc:
        _logger.warning("Skipping router %s: %s", module_name, exc)
        continue
    app.include_router(module.router, **kwargs)


async def _startup_ingest_docs() -> None:
    """Optionally ingest documentation on service startup."""
    import asyncio

    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    if os.getenv("PARTHENON_SKIP_STARTUP_INGEST") == "1":
        _logger.info("Skipping startup doc ingestion because PARTHENON_SKIP_STARTUP_INGEST=1")
        return

    if not settings.startup_ingest_docs:
        _logger.info("Skipping startup doc ingestion because startup_ingest_docs is disabled")
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


async def _startup_warm_embedders() -> None:
    """Clear stale lru_cache embedder singletons inherited from pre-fork parent,
    then eagerly load fresh instances in this worker process.

    uvicorn --workers=2 forks from a parent that may have loaded models.
    Those forked PyTorch/SentenceTransformer objects are corrupt across
    process boundaries, so we must clear and reload per-worker.
    """
    import asyncio

    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    async def _warm() -> None:
        loop = asyncio.get_event_loop()
        try:
            # PID-aware singletons auto-detect fork and reinitialize
            from app.chroma.embeddings import get_general_embedder, get_clinical_embedder
            await loop.run_in_executor(None, get_general_embedder)
            _logger.info("General embedder (MiniLM) warmed up in worker %d", os.getpid())
            await loop.run_in_executor(None, get_clinical_embedder)
            _logger.info("Clinical embedder (SapBERT) warmed up in worker %d", os.getpid())
        except Exception as e:
            _logger.warning("Embedder warmup failed (non-fatal): %s", e)

    asyncio.create_task(_warm())


async def _startup_warm_ollama() -> None:
    """Pre-load Abby's MedGemma route so the dedicated Ollama stays resident."""
    import asyncio
    import httpx
    from app.config import settings

    if os.getenv("PYTEST_CURRENT_TEST"):
        return

    async def _warm_ollama() -> None:
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                resp = await client.post(
                    f"{settings.abby_llm_base_url}/api/generate",
                    json={
                        "model": settings.abby_llm_model,
                        "prompt": "",
                        "keep_alive": settings.abby_ollama_keep_alive,
                    },
                )
                if resp.status_code == 200:
                    _logger.info(
                        "Abby Ollama model %s warmed up via %s",
                        settings.abby_llm_model,
                        settings.abby_llm_base_url,
                    )
                else:
                    _logger.warning("Ollama warmup returned %d", resp.status_code)
        except Exception as e:
            _logger.warning("Ollama warmup failed (non-fatal): %s", e)

    asyncio.create_task(_warm_ollama())
