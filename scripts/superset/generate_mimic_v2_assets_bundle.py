#!/usr/bin/env python3
"""Generate a full Superset asset bundle for the MIMIC v2 dashboard."""

from __future__ import annotations

import importlib.util
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import yaml


HERE = Path(__file__).resolve()
REPO_ROOT = HERE.parents[2] if len(HERE.parents) > 2 else Path.cwd()
SUPSET_DIR = REPO_ROOT / "scripts" / "superset"
DATASET_GENERATOR = SUPSET_DIR / "generate_mimic_v2_dataset_bundle.py"
OUTPUT_ROOT = SUPSET_DIR / "generated" / "mimic_v2_assets_bundle"
ZIP_PATH = SUPSET_DIR / "generated" / "mimic_v2_assets_bundle.zip"
ROOT_FOLDER = "mimic_v2_assets_bundle"
DASHBOARD_UUID = "c066e2a4-e8a5-53ad-85ad-57e827e5ec53"


def load_dataset_module():
    spec = importlib.util.spec_from_file_location("mimic_dataset_bundle", DATASET_GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load dataset bundle generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def chart_uuid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"parthenon.mimic_v2.chart.{name}"))


def filter_id(name: str) -> str:
    token = uuid.uuid5(uuid.NAMESPACE_URL, f"parthenon.mimic_v2.filter.{name}")
    return f"NATIVE_FILTER-{str(token)[:18]}"


def sql_metric(sql: str, label: str) -> dict:
    return {"expressionType": "SQL", "sqlExpression": sql, "label": label}


def simple_metric(column: str, aggregate: str, label: str | None = None) -> dict:
    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": column},
        "aggregate": aggregate,
    }
    if label:
        metric["label"] = label
    return metric


CHARTS: list[dict] = [
    {
        "key": "icu_admissions",
        "slice_name": "MIMIC v2: ICU Admissions",
        "dataset": "icu_episode_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric("COUNT(*)", "ICU Admissions"),
            "subheader": "ICU stays",
            "y_axis_format": ",d",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "unique_icu_patients",
        "slice_name": "MIMIC v2: Unique ICU Patients",
        "dataset": "icu_episode_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric("COUNT(DISTINCT subject_id)", "Unique ICU Patients"),
            "subheader": "Distinct patients",
            "y_axis_format": ",d",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "hospital_mortality_pct",
        "slice_name": "MIMIC v2: In-Hospital Mortality %",
        "dataset": "icu_episode_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric(
                "ROUND(100.0 * SUM(died_in_hospital) / NULLIF(COUNT(*), 0), 1)",
                "In-Hospital Mortality %",
            ),
            "subheader": "Stay-level denominator",
            "y_axis_format": ",.1f",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "median_icu_los",
        "slice_name": "MIMIC v2: Median ICU LOS",
        "dataset": "icu_episode_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric(
                "ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY icu_los_days)::numeric, 1)",
                "Median ICU LOS (days)",
            ),
            "subheader": "Median stay length",
            "y_axis_format": ",.1f",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "readmit_7d_pct",
        "slice_name": "MIMIC v2: 7-Day Readmission %",
        "dataset": "admission_readmission_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric(
                "ROUND(100.0 * SUM(readmit_7d) / NULLIF(COUNT(*), 0), 1)",
                "7-Day Readmission %",
            ),
            "subheader": "Admission-level denominator",
            "y_axis_format": ",.1f",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "readmit_30d_pct",
        "slice_name": "MIMIC v2: 30-Day Readmission %",
        "dataset": "admission_readmission_fact",
        "viz_type": "big_number_total",
        "params": {
            "viz_type": "big_number_total",
            "metric": sql_metric(
                "ROUND(100.0 * SUM(readmit_30d) / NULLIF(COUNT(*), 0), 1)",
                "30-Day Readmission %",
            ),
            "subheader": "Admission-level denominator",
            "y_axis_format": ",.1f",
        },
        "width": 4,
        "height": 22,
    },
    {
        "key": "daily_icu_census_by_unit",
        "slice_name": "MIMIC v2: Daily ICU Census by Unit",
        "dataset": "unit_daily_census",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": ["icu_unit"],
            "metrics": [sql_metric("SUM(active_stays)", "Active Stays")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "daily_new_icu_stays",
        "slice_name": "MIMIC v2: Daily New ICU Stays",
        "dataset": "unit_daily_census",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": [],
            "metrics": [sql_metric("SUM(new_stays)", "New Stays")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "icu_los_by_unit",
        "slice_name": "MIMIC v2: ICU LOS by Unit",
        "dataset": "icu_episode_fact",
        "viz_type": "box_plot",
        "params": {
            "viz_type": "box_plot",
            "columns": ["icu_unit"],
            "metrics": [simple_metric("icu_los_days", "AVG")],
            "groupby": [],
            "color_scheme": "supersetColors",
            "whisker_options": "Tukey",
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "mortality_by_icu_unit",
        "slice_name": "MIMIC v2: Mortality by ICU Unit",
        "dataset": "icu_episode_fact",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["icu_unit"],
            "metrics": [
                sql_metric(
                    "ROUND(100.0 * SUM(died_in_hospital) / NULLIF(COUNT(*), 0), 1)",
                    "Mortality Rate %",
                )
            ],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "ICU Unit",
            "y_axis_label": "Mortality Rate (%)",
            "y_axis_format": ",.1f",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "mortality_age_drg_heatmap",
        "slice_name": "MIMIC v2: Mortality by Age Group and DRG Severity",
        "dataset": "icu_episode_fact",
        "viz_type": "heatmap_v2",
        "params": {
            "viz_type": "heatmap",
            "all_columns_x": "age_group",
            "all_columns_y": "drg_severity",
            "metric": sql_metric(
                "ROUND(100.0 * SUM(died_in_hospital) / NULLIF(COUNT(*), 0), 1)",
                "Mortality %",
            ),
            "linear_color_scheme": "superset_seq_1",
            "show_legend": True,
            "show_values": True,
            "normalize_across": "heatmap",
            "row_limit": 200,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "top_primary_diagnoses",
        "slice_name": "MIMIC v2: Top Primary Diagnoses",
        "dataset": "admission_diagnosis_summary",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["primary_diagnosis"],
            "metrics": [sql_metric("COUNT(*)", "Admissions")],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Primary Diagnosis",
            "y_axis_label": "Admissions",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "mortality_by_primary_diagnosis",
        "slice_name": "MIMIC v2: Mortality by Primary Diagnosis",
        "dataset": "admission_diagnosis_summary",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["primary_diagnosis"],
            "metrics": [
                sql_metric(
                    "ROUND(100.0 * SUM(died_in_hospital) / NULLIF(COUNT(*), 0), 1)",
                    "Mortality %",
                )
            ],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Primary Diagnosis",
            "y_axis_label": "Mortality (%)",
            "y_axis_format": ",.1f",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "top_services",
        "slice_name": "MIMIC v2: Top Services by ICU Admissions",
        "dataset": "icu_episode_fact",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["service"],
            "metrics": [sql_metric("COUNT(*)", "ICU Stays")],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Service",
            "y_axis_label": "ICU Stays",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "discharge_outcome_table",
        "slice_name": "MIMIC v2: Discharge Outcome Table",
        "dataset": "discharge_outcome_summary",
        "viz_type": "table",
        "params": {
            "viz_type": "table",
            "all_columns": [
                "discharge_location",
                "service",
                "icu_unit",
                "admission_count",
                "death_count",
                "mortality_pct",
                "readmit_30d_pct",
            ],
            "row_limit": 200,
        },
        "width": 12,
        "height": 52,
    },
    {
        "key": "readmission_by_discharge_location",
        "slice_name": "MIMIC v2: Readmission by Discharge Location",
        "dataset": "discharge_outcome_summary",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["discharge_location"],
            "metrics": [sql_metric("MAX(readmit_30d_pct)", "30-Day Readmission %")],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Discharge Location",
            "y_axis_label": "30-Day Readmission (%)",
            "y_axis_format": ",.1f",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "readmission_status_distribution",
        "slice_name": "MIMIC v2: Readmission Status Distribution",
        "dataset": "admission_readmission_fact",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["readmission_status"],
            "metrics": [sql_metric("COUNT(*)", "Admissions")],
            "row_limit": 10,
            "show_bar_value": True,
            "x_axis_label": "Readmission Status",
            "y_axis_label": "Admissions",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "infusion_event_count",
        "slice_name": "MIMIC v2: Infusion Category Event Count",
        "dataset": "infusion_category_summary",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["category"],
            "metrics": [sql_metric("SUM(event_count)", "Events")],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Infusion Category",
            "y_axis_label": "Events",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "infusion_total_amount",
        "slice_name": "MIMIC v2: Infusion Category Total Amount",
        "dataset": "infusion_category_summary",
        "viz_type": "dist_bar",
        "params": {
            "viz_type": "dist_bar",
            "color_scheme": "supersetColors",
            "groupby": ["category"],
            "metrics": [sql_metric("ROUND(SUM(total_amount)::numeric, 1)", "Total Amount")],
            "row_limit": 20,
            "show_bar_value": True,
            "x_axis_label": "Infusion Category",
            "y_axis_label": "Total Amount",
            "order_desc": True,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "resistance_heatmap",
        "slice_name": "MIMIC v2: Antibiotic Resistance Heatmap",
        "dataset": "micro_resistance_summary",
        "viz_type": "heatmap_v2",
        "params": {
            "viz_type": "heatmap",
            "all_columns_x": "antibiotic",
            "all_columns_y": "organism",
            "metric": sql_metric("MAX(resistance_pct)", "Resistance %"),
            "linear_color_scheme": "superset_seq_1",
            "show_legend": True,
            "show_values": True,
            "normalize_across": "heatmap",
            "row_limit": 500,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "resistance_table",
        "slice_name": "MIMIC v2: Antibiotic Resistance Table",
        "dataset": "micro_resistance_summary",
        "viz_type": "table",
        "params": {
            "viz_type": "table",
            "all_columns": [
                "organism",
                "antibiotic",
                "test_count",
                "resistant_count",
                "susceptible_count",
                "resistance_pct",
                "patient_count",
            ],
            "row_limit": 200,
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "creatinine_trend",
        "slice_name": "MIMIC v2: Creatinine Daily Trend",
        "dataset": "lab_daily_summary",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": [],
            "metrics": [simple_metric("median_value", "AVG", "Avg Daily Median Value")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "Creatinine",
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "lab_test",
                }
            ],
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "lactate_trend",
        "slice_name": "MIMIC v2: Lactate Daily Trend",
        "dataset": "lab_daily_summary",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": [],
            "metrics": [simple_metric("median_value", "AVG", "Avg Daily Median Value")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "Lactate",
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "lab_test",
                }
            ],
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "wbc_trend",
        "slice_name": "MIMIC v2: White Blood Cells Daily Trend",
        "dataset": "lab_daily_summary",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": [],
            "metrics": [simple_metric("median_value", "AVG", "Avg Daily Median Value")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "White Blood Cells",
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "lab_test",
                }
            ],
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "vital_sign_trend",
        "slice_name": "MIMIC v2: Vital Signs Daily Trend",
        "dataset": "vital_daily_summary",
        "viz_type": "echarts_timeseries_line",
        "params": {
            "viz_type": "echarts_timeseries_line",
            "color_scheme": "supersetColors",
            "groupby": ["vital_sign"],
            "metrics": [simple_metric("median_value", "AVG", "Avg Daily Median Value")],
            "row_limit": 10000,
            "x_axis": "calendar_day",
        },
        "width": 6,
        "height": 48,
    },
    {
        "key": "data_quality_table",
        "slice_name": "MIMIC v2: Semantic Layer Data Quality",
        "dataset": "data_quality_summary",
        "viz_type": "table",
        "params": {
            "viz_type": "table",
            "all_columns": [
                "source_object",
                "row_count",
                "null_subject_id_count",
                "null_hadm_id_count",
                "min_time",
                "max_time",
                "orphan_rate_pct",
                "notes",
            ],
            "row_limit": 50,
        },
        "width": 12,
        "height": 52,
    },
]

ROWS = [
    ["icu_admissions", "unique_icu_patients", "hospital_mortality_pct"],
    ["median_icu_los", "readmit_7d_pct", "readmit_30d_pct"],
    ["daily_icu_census_by_unit", "daily_new_icu_stays"],
    ["icu_los_by_unit", "mortality_by_icu_unit"],
    ["mortality_age_drg_heatmap", "top_primary_diagnoses"],
    ["mortality_by_primary_diagnosis", "top_services"],
    ["discharge_outcome_table"],
    ["readmission_by_discharge_location", "readmission_status_distribution"],
    ["infusion_event_count", "infusion_total_amount"],
    ["resistance_heatmap", "resistance_table"],
    ["creatinine_trend", "lactate_trend"],
    ["wbc_trend", "vital_sign_trend"],
    ["data_quality_table"],
]

FILTERS = [
    {
        "name": "ICU Unit",
        "id": filter_id("icu_unit"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "icu_unit"}, "datasetUuid": None},  # filled later
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Service",
        "id": filter_id("service"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "service"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Age Group",
        "id": filter_id("age_group"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "age_group"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Outcome Group",
        "id": filter_id("outcome_group"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "outcome_group"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Discharge Location",
        "id": filter_id("discharge_location"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "discharge_location"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Lab Test",
        "id": filter_id("lab_test"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "lab_test"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Organism",
        "id": filter_id("organism"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "organism"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
    {
        "name": "Infusion Category",
        "id": filter_id("infusion_category"),
        "filterType": "filter_select",
        "targets": [
            {"column": {"name": "category"}, "datasetUuid": None},
        ],
        "controlValues": {
            "enableEmptyFilter": False,
            "defaultToFirstItem": False,
            "multiSelect": True,
            "searchAllOptions": False,
            "inverseSelection": False,
        },
    },
]

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


def write_yaml(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=False), encoding="utf-8")


def build_dashboard(dataset_module, asset_root: Path) -> None:
    dataset_uuid = dataset_module.dataset_uuid
    chart_lookup = {chart["key"]: chart for chart in CHARTS}
    dataset_chart_ids: dict[str, list[int]] = {}
    chart_nodes = {}
    rows = {}
    chart_id_seed = 1001
    chart_ids = []

    for row_index, row_keys in enumerate(ROWS):
        row_id = f"ROW-v2-{row_index}"
        rows[row_id] = {
            "type": "ROW",
            "id": row_id,
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }
        for key in row_keys:
            chart = chart_lookup[key]
            node_id = f"CHART-v2-{chart_id_seed}"
            chart_ids.append(chart_id_seed)
            dataset_chart_ids.setdefault(chart["dataset"], []).append(chart_id_seed)
            rows[row_id]["children"].append(node_id)
            chart_nodes[node_id] = {
                "type": "CHART",
                "id": node_id,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID", row_id],
                "meta": {
                    "chartId": chart_id_seed,
                    "height": chart["height"],
                    "sliceName": chart["slice_name"],
                    "uuid": chart_uuid(chart["key"]),
                    "width": chart["width"],
                },
            }
            chart_id_seed += 1

    filters = []
    for item in FILTERS:
        config = {
            "id": item["id"],
            "name": item["name"],
            "filterType": item["filterType"],
            "targets": [],
            "defaultDataMask": {
                "extraFormData": {},
                "filterState": {},
                "ownState": {},
            },
            "cascadeParentIds": [],
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "type": "NATIVE_FILTER",
            "description": "",
            "controlValues": item["controlValues"],
            "chartsInScope": chart_ids,
        }
        for target in item["targets"]:
            target = target.copy()
            if "column" not in target:
                config["targets"].append(target)
            elif target.get("datasetUuid") is None:
                column_name = target["column"]["name"]
                if column_name == "icu_unit":
                    config["targets"] = [
                        {"column": {"name": "icu_unit"}, "datasetUuid": dataset_uuid("icu_episode_fact")},
                        {"column": {"name": "icu_unit"}, "datasetUuid": dataset_uuid("infusion_category_summary")},
                        {"column": {"name": "icu_unit"}, "datasetUuid": dataset_uuid("unit_daily_census")},
                        {"column": {"name": "icu_unit"}, "datasetUuid": dataset_uuid("discharge_outcome_summary")},
                    ]
                elif column_name == "service":
                    config["targets"] = [
                        {"column": {"name": "service"}, "datasetUuid": dataset_uuid("icu_episode_fact")},
                        {"column": {"name": "service"}, "datasetUuid": dataset_uuid("admission_diagnosis_summary")},
                        {"column": {"name": "service"}, "datasetUuid": dataset_uuid("discharge_outcome_summary")},
                    ]
                elif column_name == "age_group":
                    config["targets"] = [
                        {"column": {"name": "age_group"}, "datasetUuid": dataset_uuid("icu_episode_fact")},
                        {"column": {"name": "age_group"}, "datasetUuid": dataset_uuid("admission_readmission_fact")},
                        {"column": {"name": "age_group"}, "datasetUuid": dataset_uuid("admission_diagnosis_summary")},
                        {"column": {"name": "age_group"}, "datasetUuid": dataset_uuid("discharge_outcome_summary")},
                    ]
                elif column_name == "outcome_group":
                    config["targets"] = [
                        {"column": {"name": "outcome_group"}, "datasetUuid": dataset_uuid("icu_episode_fact")},
                    ]
                elif column_name == "discharge_location":
                    config["targets"] = [
                        {"column": {"name": "discharge_location"}, "datasetUuid": dataset_uuid("admission_readmission_fact")},
                        {"column": {"name": "discharge_location"}, "datasetUuid": dataset_uuid("discharge_outcome_summary")},
                    ]
                elif column_name == "lab_test":
                    config["targets"] = [
                        {"column": {"name": "lab_test"}, "datasetUuid": dataset_uuid("lab_daily_summary")},
                    ]
                elif column_name == "organism":
                    config["targets"] = [
                        {"column": {"name": "organism"}, "datasetUuid": dataset_uuid("micro_resistance_summary")},
                    ]
                elif column_name == "category":
                    config["targets"] = [
                        {"column": {"name": "category"}, "datasetUuid": dataset_uuid("infusion_category_summary")},
                    ]
                else:
                    raise ValueError(f"Unhandled filter target column {column_name}")
            else:
                config["targets"].append(target)
        scoped_chart_ids: list[int] = []
        for dataset_name in FILTER_DATASET_MAP[item["name"]]:
            scoped_chart_ids.extend(dataset_chart_ids.get(dataset_name, []))
        config["chartsInScope"] = sorted(set(scoped_chart_ids))
        filters.append(config)

    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "parents": ["ROOT_ID"],
            "children": list(rows.keys()),
        },
    }
    position.update(rows)
    position.update(chart_nodes)

    dashboard = {
        "dashboard_title": "MIMIC-IV ICU Clinical Analytics v2",
        "description": "Encounter-grain ICU analytics built from the superset_mimic semantic layer.",
        "css": "",
        "slug": "mimic-iv-icu-clinical-analytics-v2",
        "uuid": DASHBOARD_UUID,
        "position": position,
        "metadata": {
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "refresh_frequency": 0,
            "color_scheme": "supersetColors",
            "label_colors": {},
            "shared_label_colors": {},
            "cross_filters_enabled": True,
            "native_filter_configuration": filters,
        },
        "version": "1.0.0",
        "published": True,
        "certified_by": None,
        "certification_details": None,
    }
    write_yaml(
        asset_root / ROOT_FOLDER / "dashboards" / "MIMIC-IV_ICU_Clinical_Analytics_v2.yaml",
        dashboard,
    )


def build_charts(dataset_module, asset_root: Path) -> None:
    dataset_uuid = dataset_module.dataset_uuid
    for index, chart in enumerate(CHARTS, start=1):
        payload = {
            "slice_name": chart["slice_name"],
            "description": None,
            "certified_by": None,
            "certification_details": None,
            "viz_type": chart["viz_type"],
            "params": chart["params"],
            "query_context": None,
            "cache_timeout": None,
            "uuid": chart_uuid(chart["key"]),
            "version": "1.0.0",
            "dataset_uuid": dataset_uuid(chart["dataset"]),
        }
        file_name = f"{index:02d}_{chart['key']}.yaml"
        write_yaml(asset_root / ROOT_FOLDER / "charts" / file_name, payload)


def build_assets() -> tuple[Path, Path]:
    dataset_module = load_dataset_module()
    dataset_module.build_bundle()

    dataset_root = dataset_module.OUTPUT_ROOT / dataset_module.ROOT_FOLDER
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    asset_root = OUTPUT_ROOT
    full_root = asset_root / ROOT_FOLDER
    full_root.mkdir(parents=True, exist_ok=True)

    shutil.copytree(dataset_root / "datasets", full_root / "datasets")

    metadata = {
        "version": "1.0.0",
        "type": "assets",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    write_yaml(full_root / "metadata.yaml", metadata)
    build_charts(dataset_module, asset_root)
    build_dashboard(dataset_module, asset_root)

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(full_root.rglob("*")):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(asset_root))
    return full_root, ZIP_PATH


def main() -> None:
    directory, bundle = build_assets()
    print(f"asset_dir={directory}")
    print(f"asset_zip={bundle}")


if __name__ == "__main__":
    main()
