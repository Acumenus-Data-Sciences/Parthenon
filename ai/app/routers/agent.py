"""Generic agent endpoints (called by Laravel, internal-only).

Replaces the profile-specific study_designer.py router. Laravel supplies the
full channel name and ingest_path so this router has no domain knowledge.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.agents import registry
from app.agents.service import AgentSessionState, ParthenonAgentService
from app.agents.tool_base import AgentToolContext

router = APIRouter()
logger = logging.getLogger(__name__)

_service: ParthenonAgentService | None = None


def _get_service() -> ParthenonAgentService:
    global _service
    if _service is None:
        _service = ParthenonAgentService()
    return _service


class CreateSessionRequest(BaseModel):
    profile: str
    agent_session_id: int
    subject_id: int
    channel: str
    ingest_path: str
    scoped_token: str
    context: dict = Field(default_factory=dict)


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    idempotency_key: str


@router.post("/sessions")
async def create_session(body: CreateSessionRequest) -> dict:
    ctx = AgentToolContext(auth_token=body.scoped_token, context=body.context)
    state = AgentSessionState(
        agent_session_id=body.agent_session_id,
        profile_name=body.profile,
        subject_id=body.subject_id,
        channel=body.channel,
        ingest_path=body.ingest_path,
        tool_context=ctx,
    )
    registry.put(state)
    return {"agent_session_id": body.agent_session_id, "channel": body.channel}


async def _run(agent_session_id: int, text: str, idempotency_key: str) -> None:
    state = registry.get(agent_session_id)
    if state is None:
        return
    # Serialize turns per session so a double-submit can't interleave events or
    # race the resume session id. Dedup an identical idempotency key.
    async with registry.session_lock(agent_session_id):
        if idempotency_key and state.last_idempotency_key == idempotency_key:
            return
        state.last_idempotency_key = idempotency_key
        async with registry.turn_slot():
            await _get_service().run_turn(state, text)


@router.post("/sessions/{agent_session_id}/turn", status_code=202)
async def turn(agent_session_id: int, body: TurnRequest, background: BackgroundTasks) -> dict:
    if registry.get(agent_session_id) is None:
        raise HTTPException(status_code=404, detail="agent session not found")
    # Soft backpressure: if all concurrent-turn slots are taken, reject rather
    # than unboundedly queuing background tasks. (Full admission control: Phase 2.)
    if registry.turn_slot().locked():
        raise HTTPException(status_code=429, detail="agent is busy; retry shortly")
    background.add_task(_run, agent_session_id, body.text, body.idempotency_key)
    return {"accepted": True}
