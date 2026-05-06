"""Resolve ``file://<rel-path>`` SQL references inside a manifest directory.

Security posture (ADR 0015):
* Only the ``file://`` scheme is accepted.
* Absolute paths and ``..`` segments that would escape the manifest dir
  are rejected via ``Path.resolve() + is_relative_to``.
* Files are read as UTF-8 text. Any I/O failure becomes :class:`SqlFileReadError`.

Parameter expansion uses the same ``${parameters.NAME}`` token format as the
materializer (see :mod:`runtime.registry.materializer`). Phase 3 Plan 0 Task 4
will extract a shared helper; today the resolver substitutes inline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from runtime.sql_files.exceptions import SqlFileReadError

_PARAM_REF_PATTERN = re.compile(r"\$\{parameters\.([a-zA-Z_][a-zA-Z0-9_]*)\}")
_SUPPORTED_SCHEMES = frozenset({"file"})


@dataclass(frozen=True)
class SqlFileReference:
    """Parsed view of a ``file://<rel-path>`` reference.

    ``relative_path`` is normalized to a forward-slash POSIX path (no leading
    slash) regardless of the host OS, so manifests stay portable.
    """

    scheme: str
    relative_path: str

    @classmethod
    def parse(cls, reference: str) -> SqlFileReference:
        """Parse a string into a SqlFileReference.

        Raises:
            SqlFileReadError: on unknown scheme or malformed URI.
        """
        parsed = urlparse(reference)
        if not parsed.scheme:
            raise SqlFileReadError(f"missing scheme in SQL reference {reference!r}")
        if parsed.scheme not in _SUPPORTED_SCHEMES:
            raise SqlFileReadError(
                f"unsupported scheme {parsed.scheme!r} in SQL reference {reference!r}; "
                f"only 'file://' is allowed"
            )
        # urlparse('file://sql/x.sql') -> netloc='sql', path='/x.sql'
        # urlparse('file:///abs/path') -> netloc='', path='/abs/path'  (absolute)
        # urlparse('file://./sql/x.sql') -> netloc='.', path='/sql/x.sql'
        if parsed.netloc in ("", None):
            # No netloc means the URI started with file:/// — an absolute path.
            raise SqlFileReadError(
                f"absolute paths are not allowed in SQL references: {reference!r}"
            )
        rel = f"{parsed.netloc}{parsed.path}"
        return cls(scheme=parsed.scheme, relative_path=rel)


class SqlFileResolver:
    """Read SQL bodies from disk relative to a manifest directory."""

    def __init__(self, *, manifest_dir: Path) -> None:
        self._manifest_dir = manifest_dir.resolve()

    @property
    def manifest_dir(self) -> Path:
        return self._manifest_dir

    def resolve(self, reference: str, *, parameters: dict[str, Any]) -> str:
        """Read ``reference`` and return its body with parameters expanded.

        Args:
            reference: A ``file://<relative-path>`` URI under the manifest dir.
            parameters: The run's parameter dict; ``${parameters.NAME}``
                placeholders are substituted with the corresponding values.

        Returns:
            The file body as a UTF-8 string with placeholders substituted.
            Unknown placeholders are left in place to match the materializer's
            interpolation behavior.

        Raises:
            SqlFileReadError: on any parse, security, or I/O failure.
        """
        ref = SqlFileReference.parse(reference)
        target = self._safe_resolve(ref.relative_path)
        try:
            body = target.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise SqlFileReadError(
                f"SQL file not found at {ref.relative_path!r} under manifest dir"
            ) from exc
        except PermissionError as exc:
            raise SqlFileReadError(
                f"permission denied reading SQL file {ref.relative_path!r}"
            ) from exc
        except OSError as exc:
            raise SqlFileReadError(f"failed to read SQL file {ref.relative_path!r}: {exc}") from exc
        return _expand_parameters(body, parameters)

    def _safe_resolve(self, relative_path: str) -> Path:
        candidate = Path(relative_path)
        if candidate.is_absolute():
            raise SqlFileReadError(
                f"absolute paths are not allowed in SQL references: {relative_path!r}"
            )
        target = (self._manifest_dir / candidate).resolve()
        try:
            target.relative_to(self._manifest_dir)
        except ValueError as exc:
            raise SqlFileReadError(
                f"resolved SQL path is outside manifest dir: {relative_path!r}"
            ) from exc
        return target


def _expand_parameters(template: str, parameters: dict[str, Any]) -> str:
    """Substitute ``${parameters.NAME}`` placeholders.

    Mirrors the partial-string branch of
    :func:`runtime.registry.materializer._interpolate`. Unknown placeholders
    pass through unchanged.
    """
    return _PARAM_REF_PATTERN.sub(
        lambda m: (str(parameters[m.group(1)]) if m.group(1) in parameters else m.group(0)),
        template,
    )
