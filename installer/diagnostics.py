"""Match installer error streams against the diagnostic knowledge base.

Layer 1 of the spec's Diagnostic Knowledge Engine (Area G). The KB lives in
installer/diagnostics-kb.json. Each entry has a regex `fingerprint`; on match,
the entry produces a user-facing message plus an optional `fix_action`
referencing another contract action that can repair the failure.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

KB_PATH = Path(__file__).resolve().parent / "diagnostics-kb.json"


def load_kb() -> list[dict[str, Any]]:
    """Load and return all KB entries."""
    if not KB_PATH.exists():
        return []
    return json.loads(KB_PATH.read_text())


def match(
    *,
    stdout: str,
    stderr: str,
    exit_code: int,
    phase: str,
    platform: str,
) -> list[dict[str, Any]]:
    """Return matching KB entries, ranked by severity then KB order.

    `platform` should be one of: darwin, linux, windows.
    `fix_args` are rendered from `fix_args_template` using regex captures.
    """
    haystack = f"{stdout}\n{stderr}"
    matches: list[dict[str, Any]] = []

    for entry in load_kb():
        platforms = entry.get("platforms") or ["all"]
        if "all" not in platforms and platform not in platforms:
            continue

        regex = re.compile(entry["fingerprint"], re.MULTILINE)
        m = regex.search(haystack)
        if not m:
            continue

        fix_args = _render_args(entry, m)
        message = _render_message(entry["user_message"], fix_args)

        matches.append(
            {
                "id": entry["id"],
                "category": entry["category"],
                "severity": entry["severity"],
                "fix_action": entry.get("fix_action"),
                "fix_args": fix_args,
                "message": message,
                "learn_more": entry.get("learn_more", ""),
            }
        )

    severity_rank = {"error": 0, "warn": 1}
    matches.sort(key=lambda e: severity_rank.get(e["severity"], 9))
    return matches


def _render_args(entry: dict[str, Any], match_obj: re.Match[str]) -> dict[str, Any]:
    template = entry.get("fix_args_template")
    if template is None:
        return entry.get("fix_args") or {}

    rendered: dict[str, Any] = {}
    for key, value in template.items():
        if isinstance(value, str) and value.startswith("$"):
            try:
                group = int(value[1:])
                captured = match_obj.group(group)
                # Coerce numeric-looking captures to int (e.g. port numbers).
                rendered[key] = int(captured) if captured.isdigit() else captured
            except (ValueError, IndexError):
                rendered[key] = value
        else:
            rendered[key] = value
    return rendered


def _render_message(template: str, args: dict[str, Any]) -> str:
    try:
        return template.format(**args)
    except (KeyError, IndexError):
        return template
