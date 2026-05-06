"""SQL file resolution for sql_node — reads bodies from disk with parameter expansion.

Public API:
* :class:`SqlFileResolver` — reads ``file://<rel-path>`` references inside a
  manifest directory, with traversal guard + ``${parameters.NAME}`` expansion.
* :class:`SqlFileReadError` — raised on any I/O or security failure.
"""

from __future__ import annotations

from runtime.sql_files.exceptions import SqlFileReadError
from runtime.sql_files.resolver import SqlFileReference, SqlFileResolver

__all__ = ["SqlFileReadError", "SqlFileReference", "SqlFileResolver"]
