"""RegimenMatcherNode — drives the ARTEMIS matcher across an input cohort.

Phase 2 Plan 5 Task 6 (T-019b). The node:
1. Loads the version-pinned regimen pattern library.
2. Reads drug_exposure rows from a SQL query against ``${cdm_schema}``.
3. Calls RegimenMatcher.match() to produce RegimenMatch objects.
4. Emits an artifact regimens.json with episode + episode_event row dicts
   for the downstream load step (or for direct INSERT in a follow-up).
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import create_engine, text

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus
from runtime.oncology.cdm import build_episode_event_rows, build_episode_row
from runtime.oncology.matcher import RegimenMatcher, load_pattern_library


class RegimenMatcherNode(Node):
    type_name = "regimen_matcher"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="regimen_matcher requires a db_dsn (cdm_schema query target)",
            )

        cdm_schema = params.get("cdm_schema", "mimic_iv")
        version = params.get("library_version", "v0.1.0")
        window_days = int(params.get("window_days", 7))
        min_coverage = float(params.get("min_coverage", 0.75))

        try:
            patterns = load_pattern_library(version=version)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"failed to load regimen library: {exc}",
            )

        engine = create_engine(context.db_dsn)
        with engine.begin() as conn:
            rows = (
                conn.execute(
                    text(
                        "SELECT drug_exposure_id, person_id, drug_concept_id, "
                        "drug_exposure_start_date "
                        f"FROM {cdm_schema}.drug_exposure "
                        "ORDER BY person_id, drug_exposure_start_date"
                    )
                )
                .mappings()
                .all()
            )

        matcher = RegimenMatcher(
            patterns=patterns, window_days=window_days, min_coverage=min_coverage
        )
        matches = matcher.match([dict(r) for r in rows])

        # Emit episode + episode_event row dicts for the downstream load step.
        out_payload = []
        for m in matches:
            episode_row = build_episode_row(m)
            episode_event_rows = build_episode_event_rows(
                m, episode_id=0
            )  # episode_id assigned at INSERT
            out_payload.append(
                {
                    "match": {
                        "regimen_name": m.regimen_name,
                        "person_id": m.person_id,
                        "episode_start_date": m.episode_start_date.isoformat(),
                        "episode_end_date": m.episode_end_date.isoformat(),
                        "drug_exposure_ids": m.drug_exposure_ids,
                        "coverage": m.coverage,
                    },
                    "episode_row": {
                        **{
                            k: (v.isoformat() if hasattr(v, "isoformat") else v)
                            for k, v in episode_row.items()
                        },
                    },
                    "episode_event_rows": episode_event_rows,
                }
            )

        context.write_artifact(
            "regimens.json",
            json.dumps(out_payload, indent=2).encode("utf-8"),
        )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "regimens_matched": len(matches),
                "patterns_loaded": len(patterns),
            },
        )
