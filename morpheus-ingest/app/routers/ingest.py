from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.orchestrator.batch_runner import run_mimic_batch

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/mimic")
def ingest_mimic(db: Session = Depends(get_db)):
    """Run the full MIMIC-IV → OMOP CDM ingestion pipeline."""
    summary = run_mimic_batch(db)
    db.commit()
    return summary
