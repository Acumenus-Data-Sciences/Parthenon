from fastapi import FastAPI

from app.routers import health

app = FastAPI(
    title="Morpheus Ingest",
    description="EHR data ingestion and OMOP CDM mapping for Parthenon",
    version="0.1.0",
)

app.include_router(health.router)
