"""Exceptions raised by the sql_files resolver."""

from __future__ import annotations


class SqlFileReadError(ValueError):
    """Raised when a ``file://`` SQL reference cannot be safely read.

    Wraps the underlying cause (path traversal attempt, missing file,
    permission error, unknown scheme, etc.) into a single error type the
    SqlNode runtime can branch on without leaking absolute paths into
    error messages bound for clients.
    """
