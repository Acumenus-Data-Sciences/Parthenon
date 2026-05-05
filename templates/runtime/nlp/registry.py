"""Version-pinned prompt registry. Decision Q2: prompts live as
``runtime/nlp/prompts/<version>/<name>.md`` files; manifests pin
``metadata.prompt_version``; the registry returns the pinned body.
"""

from __future__ import annotations

from pathlib import Path

from runtime.nlp.exceptions import PromptVersionError

_PROMPTS_ROOT = Path(__file__).parent / "prompts"


class PromptRegistry:
    """Loads version-pinned prompt files from disk.

    The registry is purely lookup; no caching, since prompt files are tiny
    and read latency is dwarfed by the LLM call. Lookups raise
    ``PromptVersionError`` for any missing prompt or version, so a manifest
    that pins a stale version fails loudly.
    """

    def __init__(self, root: Path | None = None) -> None:
        self._root = root or _PROMPTS_ROOT

    def get(self, name: str, version: str) -> str:
        path = self._root / version / f"{name}.md"
        if not path.is_file():
            raise PromptVersionError(f"prompt {name!r} at version {version!r} not found at {path}")
        return path.read_text(encoding="utf-8")
