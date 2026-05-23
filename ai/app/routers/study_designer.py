"""Study Designer agent endpoints (called by Laravel, internal-only)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.agents import registry
from app.agents.service import AgentSessionState, ParthenonAgentService
from app.agents.study_design_tools import StudyDesignToolContext

router = APIRouter()
logger = logging.getLogger(__name__)

_service: ParthenonAgentService | None = None


def _get_service() -> ParthenonAgentService:
    global _service
    if _service is None:
        _service = ParthenonAgentService()
    return _service


class CreateSessionRequest(BaseModel):
    profile: str = "study_design"
    agent_session_id: int
    study_slug: str
    design_session_id: int
    version_id: int | None = None
    scoped_token: str
    channel: str


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    idempotency_key: str


@router.post("/sessions")
async def create_session(body: CreateSessionRequest) -> dict:
    ctx = StudyDesignToolContext(
        study_slug=body.study_slug,
        design_session_id=body.design_session_id,
        version_id=body.version_id,
        auth_token=body.scoped_token,
    )
    state = AgentSessionState(
        agent_session_id=body.agent_session_id,
        design_session_id=body.design_session_id,
        profile_name=body.profile,
        tool_context=ctx,
    )
    registry.put(state)
    return {"agent_session_id": body.agent_session_id, "channel": body.channel}


async def _run(agent_session_id: int, text: str) -> None:
    state = registry.get(agent_session_id)
    if state is None:
        return
    async with registry.turn_slot():
        await _get_service().run_turn(state, text)


@router.post("/sessions/{agent_session_id}/turn", status_code=202)
async def turn(agent_session_id: int, body: TurnRequest, background: BackgroundTasks) -> dict:
    if registry.get(agent_session_id) is None:
        raise HTTPException(status_code=404, detail="agent session not found")
    background.add_task(_run, agent_session_id, body.text)
    return {"accepted": True}
