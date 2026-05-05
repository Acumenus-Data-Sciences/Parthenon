"""Plan 6 Task 4: SdtmDomainNode XPT reader."""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
import pyreadstat
import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.sdtm_domain import SdtmDomainNode
from runtime.sdtm.exceptions import XptReadError


def _ctx(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="r1",
        node_id="n1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name_is_sdtm_domain() -> None:
    assert SdtmDomainNode.type_name == "sdtm_domain"


def test_node_reads_dm_xpt(tmp_path: Path) -> None:
    df = pd.DataFrame(
        {
            "STUDYID": ["LZZT", "LZZT"],
            "USUBJID": ["LZZT-01-001", "LZZT-01-002"],
            "SUBJID": ["001", "002"],
            "AGE": [55.0, 47.0],
            "AGEU": ["YEARS", "YEARS"],
            "SEX": ["M", "F"],
            "RACE": ["WHITE", "BLACK OR AFRICAN AMERICAN"],
        }
    )
    xpt_path = tmp_path / "dm.xpt"
    pyreadstat.write_xport(df, str(xpt_path), table_name="DM")

    node = SdtmDomainNode()
    out = node.run(
        _ctx(tmp_path),
        {"domain": "DM", "xpt_path": str(xpt_path)},
    )
    assert out.status == NodeStatus.SUCCESS
    assert out.outputs["domain"] == "DM"
    assert out.outputs["row_count"] == 2
    assert "USUBJID" in out.outputs["columns"]
    assert (tmp_path / "sdtm_DM_summary.json").is_file()


def test_node_rejects_unknown_domain(tmp_path: Path) -> None:
    node = SdtmDomainNode()
    out = node.run(_ctx(tmp_path), {"domain": "ZZ", "xpt_path": "/nonexistent"})
    assert out.status == NodeStatus.FAILED
    assert "DM,AE,CM,VS,LB" in (out.error_message or "")


def test_node_fails_on_missing_path(tmp_path: Path) -> None:
    node = SdtmDomainNode()
    out = node.run(_ctx(tmp_path), {"domain": "DM", "xpt_path": "/does/not/exist"})
    assert out.status == NodeStatus.FAILED
    assert "xpt_path" in (out.error_message or "")


def test_node_raises_xpt_read_error_on_bad_file(tmp_path: Path) -> None:
    bogus = tmp_path / "bogus.xpt"
    bogus.write_bytes(b"not an xpt")
    node = SdtmDomainNode()
    with pytest.raises(XptReadError):
        node.run(_ctx(tmp_path), {"domain": "DM", "xpt_path": str(bogus)})
