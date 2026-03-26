"""In-memory store for active scans and their results."""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field

from app.config import settings
from app.models import ProgressEvent, ScanResult


@dataclass
class ScanState:
    scan_id: str
    created_at: float
    status: str = "running"  # running | completed | error
    result: ScanResult | None = None
    events: list[ProgressEvent] = field(default_factory=list)
    subscribers: list[asyncio.Queue[ProgressEvent | None]] = field(default_factory=list)

    def publish(self, event: ProgressEvent) -> None:
        self.events.append(event)
        for q in self.subscribers:
            q.put_nowait(event)

    def complete(self, result: ScanResult) -> None:
        self.status = "completed"
        self.result = result
        for q in self.subscribers:
            q.put_nowait(None)  # Signal end of stream

    def fail(self, message: str) -> None:
        self.status = "error"
        self.result = ScanResult(status="error", tables=[], errors=[{"message": message}])
        for q in self.subscribers:
            q.put_nowait(None)

    def subscribe(self) -> asyncio.Queue[ProgressEvent | None]:
        q: asyncio.Queue[ProgressEvent | None] = asyncio.Queue()
        # Replay existing events
        for e in self.events:
            q.put_nowait(e)
        if self.status != "running":
            q.put_nowait(None)
        else:
            self.subscribers.append(q)
        return q


class ScanStore:
    def __init__(self) -> None:
        self._scans: dict[str, ScanState] = {}

    def create(self) -> ScanState:
        scan_id = uuid.uuid4().hex[:12]
        state = ScanState(scan_id=scan_id, created_at=time.time())
        self._scans[scan_id] = state
        self._evict_expired()
        return state

    def get(self, scan_id: str) -> ScanState | None:
        return self._scans.get(scan_id)

    def _evict_expired(self) -> None:
        cutoff = time.time() - settings.result_ttl_seconds
        expired = [k for k, v in self._scans.items() if v.created_at < cutoff and v.status != "running"]
        for k in expired:
            del self._scans[k]


scan_store = ScanStore()
