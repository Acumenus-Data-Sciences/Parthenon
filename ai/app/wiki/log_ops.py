"""Workspace activity log helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


LOG_HEADER = """# Wiki Activity Log

| timestamp | action | target | message |
| --- | --- | --- | --- |
"""


@dataclass(slots=True)
class LogEntry:
    timestamp: str
    action: str
    target: str
    message: str


def ensure_log_file(workspace_dir: str | Path) -> Path:
    path = Path(workspace_dir) / "log.md"
    if not path.exists():
        path.write_text(LOG_HEADER, encoding="utf-8")
    return path


def append_log_entry(workspace_dir: str | Path, entry: LogEntry) -> Path:
    path = ensure_log_file(workspace_dir)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(
            f"| {_sanitize(entry.timestamp)} | {_sanitize(entry.action)} | "
            f"{_sanitize(entry.target)} | {_sanitize(entry.message)} |\n"
        )
    return path


def read_log_entries(workspace_dir: str | Path, limit: int | None = None) -> list[LogEntry]:
    path = ensure_log_file(workspace_dir)
    entries: list[LogEntry] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or "timestamp" in stripped or "---" in stripped:
            continue
        columns = [part.strip() for part in stripped.split("|")[1:-1]]
        if len(columns) != 4:
            continue
        entries.append(
            LogEntry(
                timestamp=columns[0],
                action=columns[1],
                target=columns[2],
                message=columns[3],
            )
        )
    entries.reverse()
    if limit is not None:
        return entries[:limit]
    return entries


def _sanitize(value: str) -> str:
    return value.replace("|", "/").strip()

