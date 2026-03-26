import platform

from fastapi import APIRouter

from app.engine.connection import ConnectionFactory
from app.models import HealthResponse, DialectInfo

router = APIRouter()


@router.get("/health")
def health() -> HealthResponse:
    dialects = ConnectionFactory.available_dialects()
    available = sum(1 for d in dialects if d.installed)
    return HealthResponse(
        status="ok",
        python_version=platform.python_version(),
        dialects_available=available,
    )


@router.get("/dialects")
def dialects() -> list[DialectInfo]:
    return ConnectionFactory.available_dialects()
