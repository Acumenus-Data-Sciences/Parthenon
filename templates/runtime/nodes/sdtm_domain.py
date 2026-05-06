"""SdtmDomainNode — read SAS XPT into a typed DataFrame, write to fmt_<domain>.

Phase 2 Plan 6 Task 4 (T-016 part of). Inputs:
- ``params.domain`` — one of DM/AE/CM/VS/LB
- ``params.xpt_path`` — filesystem path to the XPT file
- ``params.target_schema`` — schema for the fmt_<domain> raw table (default sdtm_source)

Outputs:
- DataFrame written into ``sdtm_source.fmt_<lower(domain)>`` via to_sql.
- Artifact ``sdtm_<domain>_summary.json`` with row_count + columns.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pyreadstat
from sqlalchemy import create_engine

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus
from runtime.sdtm.exceptions import XptReadError
from runtime.sdtm.types import SdtmDomain


class SdtmDomainNode(Node):
    type_name = "sdtm_domain"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        try:
            domain = SdtmDomain(params["domain"])
        except (KeyError, ValueError) as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"sdtm_domain requires `domain` in {{DM,AE,CM,VS,LB}}: {exc}",
            )

        xpt_path = Path(params.get("xpt_path", ""))
        if not xpt_path.is_file():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"xpt_path does not exist: {xpt_path}",
            )

        try:
            df, _meta = pyreadstat.read_xport(str(xpt_path))
        except Exception as exc:
            raise XptReadError(f"cannot read XPT at {xpt_path}: {exc}") from exc

        target_schema = params.get("target_schema", "sdtm_source")
        table = f"fmt_{domain.value.lower()}"

        if context.db_dsn:
            engine = create_engine(context.db_dsn)
            df.to_sql(table, engine, schema=target_schema, if_exists="append", index=False)
            row_count = len(df)
        else:
            row_count = len(df)

        out = {
            "domain": domain.value,
            "row_count": int(row_count),
            "columns": list(df.columns),
            "table": f"{target_schema}.{table}",
        }
        context.write_artifact(
            f"sdtm_{domain.value}_summary.json",
            json.dumps(out, indent=2).encode("utf-8"),
        )

        return NodeResult(status=NodeStatus.SUCCESS, outputs=out)
