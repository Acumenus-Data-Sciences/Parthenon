"""Publish Study Designer agent events to Reverb over the Pusher HTTP protocol.

Reverb is Pusher-compatible, so we use the official ``pusher`` client pointed at
the internal ``reverb`` container. Publishing is fail-open: a transport error must
never break an in-flight agent turn (the Laravel snapshot endpoint is the
authoritative source of final state).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import pusher

from app.config import settings

logger = logging.getLogger(__name__)

_CHANNEL_PREFIX = "private-study-design.session."


def channel_for_session(session_id: int) -> str:
    """Return the private Reverb channel name for a design session."""
    return f"{_CHANNEL_PREFIX}{session_id}"


def _build_default_client() -> pusher.Pusher:
    return pusher.Pusher(
        app_id=settings.reverb_app_id,
        key=settings.reverb_app_key,
        secret=settings.reverb_app_secret,
        host=settings.reverb_host,
        port=settings.reverb_port,
        ssl=settings.reverb_scheme == "https",
    )


class ReverbPublisher:
    """Thin wrapper around a Pusher client for agent event fan-out."""

    def __init__(self, client: Optional[pusher.Pusher] = None) -> None:
        self._client = client or _build_default_client()

    def publish(self, *, session_id: int, event: str, data: dict[str, Any]) -> None:
        channel = channel_for_session(session_id)
        try:
            self._client.trigger(channel, event, data)
        except Exception as exc:  # noqa: BLE001 — fail-open by design
            logger.warning("Reverb publish failed (%s on %s): %s", event, channel, exc)
