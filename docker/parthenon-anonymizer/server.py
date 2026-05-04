"""HTTP shim around the MS FHIR Anonymizer .NET CLI.

POST /anonymize {"config": ..., "resource": ...}  -> 200 anonymized resource
GET  /health                                       -> 200 ok
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException

DOTNET_ASSEMBLY = "/opt/anonymizer/Microsoft.Health.Fhir.Anonymizer.R4.CommandLineTool.dll"

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/anonymize")
def anonymize(payload: dict[str, Any]) -> dict[str, Any]:
    cfg = payload.get("config")
    resource = payload.get("resource")
    if not cfg or not resource:
        raise HTTPException(status_code=400, detail="config and resource required")
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        cfg_path = td_path / "config.json"
        in_dir = td_path / "in"
        out_dir = td_path / "out"
        in_dir.mkdir()
        out_dir.mkdir()
        cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
        (in_dir / "resource.json").write_text(json.dumps(resource), encoding="utf-8")
        proc = subprocess.run(
            [
                "dotnet",
                DOTNET_ASSEMBLY,
                "--inputFolder",
                str(in_dir),
                "--outputFolder",
                str(out_dir),
                "--configFile",
                str(cfg_path),
            ],
            capture_output=True,
            timeout=60,
            check=False,
        )
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"anonymizer CLI failed (rc={proc.returncode}): "
                    f"{proc.stderr.decode()[:500]}"
                ),
            )
        out_path = out_dir / "resource.json"
        if not out_path.exists():
            raise HTTPException(status_code=500, detail="anonymizer produced no output")
        return dict(json.loads(out_path.read_text(encoding="utf-8")))
