from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse

from app.engine.assembler import ResultAssembler
from app.engine.connection import ConnectionFactory
from app.models import ScanRequest, ScanStartResponse, ScanResult, ProgressEvent
from app.scan_store import scan_store

router = APIRouter()
log = logging.getLogger("blackrabbit.scan")


def _run_scan(scan_id: str, request: ScanRequest) -> None:
    """Synchronous scan execution — runs in background thread."""
    state = scan_store.get(scan_id)
    if not state:
        return

    try:
        engine = ConnectionFactory.create_engine(
            dbms=request.dbms,
            server=request.server,
            port=request.port,
            user=request.user,
            password=request.password,
            schema=request.schema_name,
        )
        assembler = ResultAssembler(
            engine=engine,
            schema=request.schema_name,
            request=request,
            scan_state=state,
        )
        result = assembler.run()
        state.complete(result)
        engine.dispose()

    except Exception as e:
        log.exception("Scan %s failed", scan_id)
        if state:
            state.fail(str(e))


@router.post("/scan")
async def start_scan(request: ScanRequest, background_tasks: BackgroundTasks) -> ScanStartResponse:
    state = scan_store.create()
    background_tasks.add_task(_run_scan, state.scan_id, request)
    return ScanStartResponse(scan_id=state.scan_id)


@router.get("/scan/{scan_id}")
async def scan_progress(scan_id: str) -> StreamingResponse:
    state = scan_store.get(scan_id)
    if not state:
        raise HTTPException(status_code=404, detail="Scan not found")

    queue = state.subscribe()

    async def event_stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event.model_dump(exclude_none=True))}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/scan/{scan_id}/result")
async def scan_result(scan_id: str) -> ScanResult:
    state = scan_store.get(scan_id)
    if not state:
        raise HTTPException(status_code=410, detail="Scan expired or not found")
    if state.status == "running":
        raise HTTPException(status_code=404, detail="Scan still running")
    if not state.result:
        raise HTTPException(status_code=500, detail="Scan completed but no result available")
    return state.result
