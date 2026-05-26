"""Publish agent events to Reverb over the Pusher HTTP protocol.

Reverb is Pusher-compatible, so we use the official ``pusher`` client pointed at
the internal ``reverb`` container. Publishing is fail-open: a transport error must
never break an in-flight agent turn (the Laravel snapshot endpoint is the
authoritative source of final state).

The caller supplies the full channel name (e.g. ``"private-study-design.session.7"``
or ``"private-publish.draft.42"``); this module has no knowledge of domain naming.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import pusher

from app.config import settings

logger = logging.getLogger(__name__)


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
    """Thin wrapper around a Pusher client for agent event fan-out.

    The Pusher client is constructed lazily on first publish so that importing
    this module (and constructing ReverbPublisher()) succeeds even when
    REVERB_APP_ID is not set (e.g. in tests). Publishing is fail-open: a
    transport or configuration error must never break an in-flight agent turn.
    """

    def __init__(self, client: Optional[pusher.Pusher] = None) -> None:
        # If an explicit client is provided, store it eagerly.
        # Otherwise, defer construction until first publish() call.
        self._client: Optional[pusher.Pusher] = client
        self._explicit = client is not None

    def _get_client(self) -> Optional[pusher.Pusher]:
        if self._client is None and not self._explicit:
            try:
                self._client = _build_default_client()
            except Exception as exc:  # noqa: BLE001 — misconfigured in dev/test
                logger.warning("ReverbPublisher: could not build Pusher client: %s", exc)
        return self._client

    def publish(self, *, channel: str, event: str, data: dict[str, Any]) -> None:
        client = self._get_client()
        if client is None:
            logger.debug("ReverbPublisher: no client available, dropping %s on %s", event, channel)
            return
        try:
            client.trigger(channel, event, data)
        except Exception as exc:  # noqa: BLE001 — fail-open by design
            logger.warning("Reverb publish failed (%s on %s): %s", event, channel, exc)
