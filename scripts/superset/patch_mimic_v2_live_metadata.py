#!/usr/bin/env python3
"""Patch live Superset MIMIC v2 chart metadata after asset import.

This script is intentionally instance-specific. It resolves the current
Superset dataset IDs for the `superset_mimic` semantic layer, finds the
imported v2 slices by stable UUID, backfills `query_context`, fixes the
categorical bar viz types, and narrows dashboard-native filter scopes.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from superset.app import create_app


DEREF = Path(__file__).resolve()
SIBLING_GENERATOR = DEREF.with_name("generate_mimic_v2_assets_bundle.py")
if SIBLING_GENERATOR.exists():
    ASSET_GENERATOR = SIBLING_GENERATOR
else:
    ASSET_GENERATOR = DEREF.parents[2] / "scripts" / "superset" / "generate_mimic_v2_assets_bundle.py"
DASHBOARD_ID = 4

FILTER_DATASET_MAP = {
    "ICU Unit": [
        "icu_episode_fact",
        "infusion_category_summary",
        "unit_daily_census",
        "discharge_outcome_summary",
    ],
    "Service": [
        "icu_episode_fact",
        "admission_diagnosis_summary",
        "discharge_outcome_summary",
    ],
    "Age Group": [
        "icu_episode_fact",
        "admission_readmission_fact",
        "admission_diagnosis_summary",
        "discharge_outcome_summary",
    ],
    "Outcome Group": ["icu_episode_fact"],
    "Discharge Location": [
        "admission_readmission_fact",
        "discharge_outcome_summary",
    ],
    "Lab Test": ["lab_daily_summary"],
    "Organism": ["micro_resistance_summary"],
    "Infusion Category": ["infusion_category_summary"],
}


def load_assets_module():
    spec = importlib.util.spec_from_file_location("mimic_v2_assets", ASSET_GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load asset generator module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _clone_metric(metric: dict) -> dict:
    return json.loads(json.dumps(metric))


def _filter_from_adhoc(adhoc: dict) -> dict:
    return {
        "col": adhoc["subject"],
        "op": adhoc["operator"],
        "val": adhoc["comparator"],
    }


def _base_form_data(chart: dict, slice_id: int, datasource_id: int) -> dict:
    form_data = json.loads(json.dumps(chart["params"]))
    form_data["slice_id"] = slice_id
    form_data["datasource"] = f"{datasource_id}__table"
    return form_data


def _base_query_context(chart: dict, datasource_id: int, slice_id: int) -> dict:
    return {
        "datasource": {"id": datasource_id, "type": "table"},
        "queries": [],
        "form_data": _base_form_data(chart, slice_id, datasource_id),
        "result_format": "json",
        "result_type": "full",
    }


def build_query_context(chart: dict, datasource_id: int, slice_id: int) -> dict:
    key = chart["key"]
    params = chart["params"]
    query = {
        "filters": [],
        "extras": {},
        "orderby": [],
        "row_limit": params.get("row_limit", 1000),
        "is_timeseries": False,
    }
    context = _base_query_context(chart, datasource_id, slice_id)

    if key in {
        "icu_admissions",
        "unique_icu_patients",
        "hospital_mortality_pct",
        "median_icu_los",
        "readmit_7d_pct",
        "readmit_30d_pct",
    }:
        query["metrics"] = [_clone_metric(params["metric"])]
        query["columns"] = []

    elif key in {
        "daily_icu_census_by_unit",
        "daily_new_icu_stays",
        "creatinine_trend",
        "lactate_trend",
        "wbc_trend",
        "vital_sign_trend",
    }:
        query["metrics"] = [_clone_metric(params["metrics"][0])]
        query["columns"] = list(params.get("groupby", []))
        query["granularity"] = params["x_axis"]
        query["is_timeseries"] = True
        for adhoc in params.get("adhoc_filters", []):
            query["filters"].append(_filter_from_adhoc(adhoc))

    elif key == "icu_los_by_unit":
        metric = {
            "expressionType": "SIMPLE",
            "column": {"column_name": "icu_los_days"},
            "aggregate": "AVG",
            "label": "AVG(icu_los_days)",
        }
        query["metrics"] = [metric]
        query["columns"] = ["icu_unit"]
        query["row_limit"] = 10000
        query["post_processing"] = [
            {
                "operation": "boxplot",
                "options": {
                    "groupby": ["icu_unit"],
                    "metrics": ["AVG(icu_los_days)"],
                    "whisker_type": "tukey",
                },
            }
        ]

    elif key in {
        "mortality_by_icu_unit",
        "top_primary_diagnoses",
        "mortality_by_primary_diagnosis",
        "top_services",
        "readmission_by_discharge_location",
        "readmission_status_distribution",
        "infusion_event_count",
        "infusion_total_amount",
    }:
        query["metrics"] = [_clone_metric(params["metrics"][0])]
        query["columns"] = [params["groupby"][0]]
        query["orderby"] = [[_clone_metric(params["metrics"][0]), False]]

    elif key == "mortality_age_drg_heatmap":
        query["metrics"] = [_clone_metric(params["metric"])]
        query["columns"] = [params["all_columns_x"], params["all_columns_y"]]
        query["row_limit"] = params.get("row_limit", 200)

    elif key == "resistance_heatmap":
        query["metrics"] = [_clone_metric(params["metric"])]
        query["columns"] = [params["all_columns_x"], params["all_columns_y"]]
        query["row_limit"] = params.get("row_limit", 500)

    elif key in {"discharge_outcome_table", "resistance_table", "data_quality_table"}:
        query["columns"] = list(params["all_columns"])

    else:
        raise ValueError(f"Unhandled chart key: {key}")

    context["queries"] = [query]
    return context


def main() -> None:
    module = load_assets_module()
    app = create_app()
    with app.app_context():
        from superset.extensions import db
        from superset.models.core import Database
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice
        from superset.connectors.sqla.models import SqlaTable

        # Fix the live Parthenon datasource through the ORM so the encrypted
        # password column matches the URI.
        database = db.session.get(Database, 1)
        if database is not None:
            database.sqlalchemy_uri = (
                "postgresql://parthenon:secret@host.docker.internal:5480/parthenon"
            )
            database.password = "secret"

        datasets = {
            dataset.table_name: dataset.id
            for dataset in (
                db.session.query(SqlaTable)
                .filter(SqlaTable.schema == "superset_mimic")
                .all()
            )
        }

        chart_ids_by_dataset: dict[str, list[int]] = {}
        for chart in module.CHARTS:
            chart_uuid = module.chart_uuid(chart["key"])
            slice_ = (
                db.session.query(Slice).filter(Slice.uuid == chart_uuid).one_or_none()
            )
            if slice_ is None:
                raise RuntimeError(f"Missing slice for {chart['slice_name']}")
            datasource_id = datasets[chart["dataset"]]
            slice_.datasource_id = datasource_id
            slice_.datasource_type = "table"
            slice_.datasource_name = chart["dataset"]
            slice_.viz_type = chart["viz_type"]
            params = json.loads(slice_.params)
            params["viz_type"] = chart["params"]["viz_type"]
            slice_.params = json.dumps(params)
            slice_.query_context = json.dumps(
                build_query_context(chart, datasource_id, slice_.id)
            )
            chart_ids_by_dataset.setdefault(chart["dataset"], []).append(slice_.id)

        dashboard = db.session.get(Dashboard, DASHBOARD_ID)
        if dashboard is None:
            raise RuntimeError(f"Missing dashboard {DASHBOARD_ID}")
        metadata = json.loads(dashboard.json_metadata or "{}")
        filters = metadata.get("native_filter_configuration", [])
        filters = [f for f in filters if f.get("name") != "Admission Time"]
        for filter_config in filters:
            dataset_names = FILTER_DATASET_MAP.get(filter_config["name"], [])
            chart_ids: list[int] = []
            for dataset_name in dataset_names:
                chart_ids.extend(chart_ids_by_dataset.get(dataset_name, []))
            filter_config["chartsInScope"] = sorted(set(chart_ids))
        metadata["native_filter_configuration"] = filters
        dashboard.json_metadata = json.dumps(metadata)

        db.session.commit()
        print("Patched live MIMIC v2 metadata")


if __name__ == "__main__":
    main()
