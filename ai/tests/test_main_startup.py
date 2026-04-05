"""Tests for startup background tasks."""
import asyncio
from unittest.mock import MagicMock, patch


def test_startup_ingest_docs_skips_by_default() -> None:
    """Doc ingestion is opt-in and should not run on normal service boot."""
    from app import main

    with patch.object(main.settings, "startup_ingest_docs", False), \
         patch("app.main.os.getenv", return_value=""), \
         patch("app.main._logger") as mock_logger:
        asyncio.run(main._startup_ingest_docs())

        mock_logger.info.assert_called_once_with(
            "Skipping startup doc ingestion because startup_ingest_docs is disabled"
        )


def test_startup_ingest_docs_schedules_when_enabled() -> None:
    """Doc ingestion is still available when explicitly enabled."""
    from app import main

    mock_loop = MagicMock()
    with patch.object(main.settings, "startup_ingest_docs", True), \
         patch("app.main.os.getenv", return_value=""), \
         patch("app.routers.chroma.DOCS_DIR", "/tmp/docs"), \
         patch("app.chroma.ingestion.ingest_docs_directory") as mock_ingest, \
         patch("asyncio.get_event_loop", return_value=mock_loop):
        asyncio.run(main._startup_ingest_docs())

        mock_loop.run_in_executor.assert_called_once_with(None, mock_ingest, "/tmp/docs")
