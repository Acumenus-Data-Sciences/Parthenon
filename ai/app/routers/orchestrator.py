"""FastAPI router for the protocol-to-publication orchestrator (ADR-0020 Phase 5).

Laravel mints a study-scoped Sanctum token and POSTs here to drive a study
through the gated S1->S7 pipeline. The default is a *dry* walk of the gate ledger
(``execute=false``) — it reads gate state and reports where the study halts
without running any analysis. ``execute=true`` performs the staged live
execution and is gated, server-side, behind the same gate ledger.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agency.api_client import AgencyApiClient
from app.orchestrator.guards import GateBlocked
from app.orchestrator.state_machine import StudyOrchestrator
from app.orchestrator.tools import OrchestratorTools

logger = logging.getLogger(__name__)

router = APIRouter()


class OrchestrateRequest(BaseModel):
    study_ref: str = Field(..., description="Study slug or id (route-model bound by Laravel).")
    scoped_token: str = Field(..., description="Study-scoped Sanctum bearer token (ADR C3).")
    source_id: Optional[int] = Field(None, description="CDM source for the live execute path.")
    execute: bool = Field(False, description="Run the staged live execution; default is a dry ledger walk.")
    channel: Optional[str] = Field(None, description="Reverb private channel for progress streaming.")


def _make_emitter(
    channel: Optional[str],
) -> Optional[Callable[[str, dict[str, Any]], None]]:
    """Best-effort Reverb emitter; no-op if the publisher is unavailable so the
    orchestration never fails on a streaming error."""
    if not channel:
        return None
    try:
        from app.agency.reverb_publisher import ReverbPublisher  # type: ignore

        publisher = ReverbPublisher()
    except Exception:  # pragma: no cover - streaming is optional
        return None

    def emit(event: str, data: dict[str, Any]) -> None:
        try:
            publisher.publish(channel, event, data)  # type: ignore[attr-defined]
        except Exception:  # pragma: no cover
            logger.debug("orchestrator reverb emit failed for %s", event, exc_info=True)

    return emit


@router.post("/run")
async def run_orchestration(req: OrchestrateRequest) -> dict[str, Any]:
    tools = OrchestratorTools(AgencyApiClient(), req.scoped_token, req.study_ref)
    orchestrator = StudyOrchestrator(tools, emit=_make_emitter(req.channel))

    try:
        result = await orchestrator.run(source_id=req.source_id, execute=req.execute)
    except GateBlocked as blocked:
        return {
            "status": "blocked",
            "study": req.study_ref,
            "action": blocked.action,
            "prerequisite": blocked.prerequisite,
            "reasons": blocked.reasons,
            "message": str(blocked),
        }

    return {"status": "ok", **result.to_dict()}
