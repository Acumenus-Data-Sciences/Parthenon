"""In-memory registry of active agent sessions (single-worker uvicorn)."""

from __future__ import annotations

import asyncio
from typing import Optional

from app.agents.service import AgentSessionState
from app.config import settings

_sessions: dict[int, AgentSessionState] = {}
_turn_semaphore = asyncio.Semaphore(settings.agent_max_concurrent_turns)
_locks: dict[int, asyncio.Lock] = {}


def put(state: AgentSessionState) -> None:
    _sessions[state.agent_session_id] = state


def get(agent_session_id: int) -> Optional[AgentSessionState]:
    return _sessions.get(agent_session_id)


def drop(agent_session_id: int) -> None:
    _sessions.pop(agent_session_id, None)
    _locks.pop(agent_session_id, None)


def session_lock(agent_session_id: int) -> asyncio.Lock:
    lock = _locks.get(agent_session_id)
    if lock is None:
        lock = asyncio.Lock()
        _locks[agent_session_id] = lock
    return lock


def turn_slot() -> asyncio.Semaphore:
    return _turn_semaphore
