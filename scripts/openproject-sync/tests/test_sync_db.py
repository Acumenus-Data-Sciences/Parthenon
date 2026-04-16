"""
Integration tests for SyncDb — require live parthenon database on localhost.

Run:
    cd /home/smudoshi/Github/Parthenon/scripts/openproject-sync
    python -m pytest tests/test_sync_db.py -v
"""

import sys
import os

# Ensure lib/ is importable when running from any working directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))

import pytest
from sync_db import EntityMapping, SyncDb

DSN = "dbname=parthenon user=claude_dev host=localhost"


@pytest.fixture
def db() -> SyncDb:  # type: ignore[misc]
    """Open a SyncDb connection and clean up test rows after each test."""
    client = SyncDb(DSN)
    yield client
    # Teardown — sync_log FK references entity_map, so delete child rows first.
    client.execute(
        "DELETE FROM sync.sync_log WHERE workflow = %s",
        ("test",),
    )
    client.execute(
        "DELETE FROM sync.entity_map WHERE gsd_path LIKE %s",
        ("test/%",),
    )
    client.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_upsert_and_lookup_by_gsd(db: SyncDb) -> None:
    """Insert a mapping then retrieve it by gsd_path."""
    mapping = EntityMapping(
        entity_type="phase",
        gsd_path="test/phases/01-setup",
        op_work_package_id=999,
    )
    row_id = db.upsert_mapping(mapping)
    assert isinstance(row_id, int)
    assert row_id > 0

    result = db.find_by_gsd_path("test/phases/01-setup")
    assert result is not None
    assert result.id == row_id
    assert result.entity_type == "phase"
    assert result.gsd_path == "test/phases/01-setup"
    assert result.op_work_package_id == 999


def test_lookup_by_op_wp(db: SyncDb) -> None:
    """Insert a mapping then retrieve it by op_work_package_id."""
    mapping = EntityMapping(
        entity_type="milestone",
        gsd_path="test/milestones/m1",
        op_work_package_id=12345,
    )
    row_id = db.upsert_mapping(mapping)
    assert row_id > 0

    result = db.find_by_op_wp(12345)
    assert result is not None
    assert result.gsd_path == "test/milestones/m1"
    assert result.op_work_package_id == 12345


def test_log_action(db: SyncDb) -> None:
    """Inserting a log entry should not raise."""
    # Insert a mapping to satisfy the FK (entity_map_id is nullable, but let's
    # exercise the FK path too).
    mapping = EntityMapping(
        entity_type="phase",
        gsd_path="test/phases/log-test",
    )
    map_id = db.upsert_mapping(mapping)

    # This must not raise.
    db.log_action(
        workflow="test",
        direction="gsd->op",
        entity_map_id=map_id,
        action="create",
        details={"note": "integration test"},
    )

    # Verify the row landed.
    cur = db.execute(
        "SELECT action FROM sync.sync_log WHERE workflow = %s AND entity_map_id = %s",
        ("test", map_id),
    )
    row = cur.fetchone()
    assert row is not None
    assert row[0] == "create"


def test_health(db: SyncDb) -> None:
    """get_health() should return a dict with the entities_tracked key."""
    health = db.get_health()
    assert isinstance(health, dict)
    assert "entities_tracked" in health
