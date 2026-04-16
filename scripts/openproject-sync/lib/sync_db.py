"""
sync_db.py — psycopg2 client for sync.entity_map and sync.sync_log tables.

All writes use autocommit=True. Reads use DictCursor for dict-style row access.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import psycopg2
import psycopg2.extras


@dataclass
class EntityMapping:
    entity_type: str
    id: Optional[int] = None
    gsd_path: Optional[str] = None
    op_project_id: Optional[int] = None
    op_work_package_id: Optional[int] = None
    op_version_id: Optional[int] = None
    github_issue_number: Optional[int] = None
    github_milestone_number: Optional[int] = None
    op_updated_at: Optional[datetime] = None
    gh_updated_at: Optional[datetime] = None
    gsd_updated_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    sync_hash: Optional[str] = None


def _row_to_mapping(row: psycopg2.extras.DictRow) -> EntityMapping:
    """Convert a DictCursor row into an EntityMapping dataclass."""
    return EntityMapping(
        id=row["id"],
        entity_type=row["entity_type"],
        gsd_path=row["gsd_path"],
        op_project_id=row["op_project_id"],
        op_work_package_id=row["op_work_package_id"],
        op_version_id=row["op_version_id"],
        github_issue_number=row["github_issue_number"],
        github_milestone_number=row["github_milestone_number"],
        op_updated_at=row["op_updated_at"],
        gh_updated_at=row["gh_updated_at"],
        gsd_updated_at=row["gsd_updated_at"],
        last_synced_at=row["last_synced_at"],
        sync_hash=row["sync_hash"],
    )


class SyncDb:
    """
    Thin psycopg2 wrapper for the sync schema.

    Connection is lazy — opened on first access via the `conn` property.
    autocommit=True is used throughout so callers never need explicit commits.
    """

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._conn: Optional[psycopg2.extensions.connection] = None

    @property
    def conn(self) -> psycopg2.extensions.connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self._dsn)
            self._conn.autocommit = True
        return self._conn

    def execute(
        self,
        sql: str,
        params: Optional[tuple[Any, ...]] = None,
    ) -> psycopg2.extensions.cursor:
        """Execute *sql* with optional *params* and return the cursor."""
        cur = self.conn.cursor()
        cur.execute(sql, params)
        return cur

    # ------------------------------------------------------------------
    # entity_map CRUD
    # ------------------------------------------------------------------

    def upsert_mapping(self, m: EntityMapping) -> int:
        """
        INSERT or UPDATE a row in sync.entity_map keyed on gsd_path.

        When a conflict occurs on gsd_path, each nullable column is updated
        only when the incoming value is non-NULL (COALESCE preserves existing
        non-null values so partial updates don't erase good data).

        Returns the row's id.
        """
        sql = """
            INSERT INTO sync.entity_map (
                entity_type,
                gsd_path,
                op_project_id,
                op_work_package_id,
                op_version_id,
                github_issue_number,
                github_milestone_number,
                op_updated_at,
                gh_updated_at,
                gsd_updated_at,
                last_synced_at,
                sync_hash
            ) VALUES (
                %(entity_type)s,
                %(gsd_path)s,
                %(op_project_id)s,
                %(op_work_package_id)s,
                %(op_version_id)s,
                %(github_issue_number)s,
                %(github_milestone_number)s,
                %(op_updated_at)s,
                %(gh_updated_at)s,
                %(gsd_updated_at)s,
                COALESCE(%(last_synced_at)s, now()),
                %(sync_hash)s
            )
            ON CONFLICT (gsd_path) WHERE gsd_path IS NOT NULL
            DO UPDATE SET
                entity_type             = EXCLUDED.entity_type,
                op_project_id           = COALESCE(EXCLUDED.op_project_id,           sync.entity_map.op_project_id),
                op_work_package_id      = COALESCE(EXCLUDED.op_work_package_id,      sync.entity_map.op_work_package_id),
                op_version_id           = COALESCE(EXCLUDED.op_version_id,           sync.entity_map.op_version_id),
                github_issue_number     = COALESCE(EXCLUDED.github_issue_number,     sync.entity_map.github_issue_number),
                github_milestone_number = COALESCE(EXCLUDED.github_milestone_number, sync.entity_map.github_milestone_number),
                op_updated_at           = COALESCE(EXCLUDED.op_updated_at,           sync.entity_map.op_updated_at),
                gh_updated_at           = COALESCE(EXCLUDED.gh_updated_at,           sync.entity_map.gh_updated_at),
                gsd_updated_at          = COALESCE(EXCLUDED.gsd_updated_at,          sync.entity_map.gsd_updated_at),
                last_synced_at          = COALESCE(EXCLUDED.last_synced_at,          now()),
                sync_hash               = COALESCE(EXCLUDED.sync_hash,               sync.entity_map.sync_hash)
            RETURNING id
        """
        params = {
            "entity_type": m.entity_type,
            "gsd_path": m.gsd_path,
            "op_project_id": m.op_project_id,
            "op_work_package_id": m.op_work_package_id,
            "op_version_id": m.op_version_id,
            "github_issue_number": m.github_issue_number,
            "github_milestone_number": m.github_milestone_number,
            "op_updated_at": m.op_updated_at,
            "gh_updated_at": m.gh_updated_at,
            "gsd_updated_at": m.gsd_updated_at,
            "last_synced_at": m.last_synced_at,
            "sync_hash": m.sync_hash,
        }
        cur = self.conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        return row[0]  # type: ignore[index]

    def _fetch_one(self, sql: str, params: tuple[Any, ...]) -> Optional[EntityMapping]:
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        return _row_to_mapping(row) if row else None

    def find_by_gsd_path(self, path: str) -> Optional[EntityMapping]:
        return self._fetch_one(
            "SELECT * FROM sync.entity_map WHERE gsd_path = %s",
            (path,),
        )

    def find_by_op_wp(self, wp_id: int) -> Optional[EntityMapping]:
        return self._fetch_one(
            "SELECT * FROM sync.entity_map WHERE op_work_package_id = %s",
            (wp_id,),
        )

    def find_by_gh_issue(self, issue_number: int) -> Optional[EntityMapping]:
        return self._fetch_one(
            "SELECT * FROM sync.entity_map WHERE github_issue_number = %s",
            (issue_number,),
        )

    def find_all(self) -> list[EntityMapping]:
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM sync.entity_map ORDER BY id")
        return [_row_to_mapping(row) for row in cur.fetchall()]

    # ------------------------------------------------------------------
    # sync_log
    # ------------------------------------------------------------------

    def log_action(
        self,
        workflow: str,
        direction: str,
        entity_map_id: Optional[int],
        action: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """Append a row to sync.sync_log."""
        self.execute(
            """
            INSERT INTO sync.sync_log (workflow, direction, entity_map_id, action, details)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                workflow,
                direction,
                entity_map_id,
                action,
                json.dumps(details or {}),
            ),
        )

    # ------------------------------------------------------------------
    # health
    # ------------------------------------------------------------------

    def get_health(self) -> dict[str, Any]:
        """Return the sync.health view as a plain dict."""
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT * FROM sync.health")
        row = cur.fetchone()
        return dict(row) if row else {}

    # ------------------------------------------------------------------
    # lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
            self._conn = None
