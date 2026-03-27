#!/usr/bin/env python3
"""
Scrape OHDSI CDM v5.4 documentation and generate PHP config file.

Usage:
    python3 scripts/scrape-cdm-docs.py

Generates: backend/config/cdm-schema-v54.php
"""

import os
import re
import sys

import requests
from bs4 import BeautifulSoup

CDM_URL = "https://ohdsi.github.io/CommonDataModel/cdm54.html"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "backend", "config", "cdm-schema-v54.php")
TS_OUTPUT_PATH = os.path.join(PROJECT_ROOT, "frontend", "src", "features", "etl", "lib", "cdm-schema-v54.ts")

# Domain mapping for each CDM table. Derived from the existing config and OHDSI conventions.
# Tables not listed here default to 'Other'.
TABLE_DOMAIN_MAP = {
    "person": "Person",
    "observation_period": "Observation",
    "visit_occurrence": "Visit",
    "visit_detail": "Visit",
    "condition_occurrence": "Condition",
    "drug_exposure": "Drug",
    "procedure_occurrence": "Procedure",
    "device_exposure": "Device",
    "measurement": "Measurement",
    "observation": "Observation",
    "death": "Death",
    "note": "Note",
    "note_nlp": "Note",
    "specimen": "Specimen",
    "fact_relationship": "Other",
    "location": "Location",
    "care_site": "Location",
    "provider": "Location",
    "payer_plan_period": "Cost",
    "cost": "Cost",
    "drug_era": "Drug",
    "dose_era": "Drug",
    "condition_era": "Condition",
    "episode": "Other",
    "episode_event": "Other",
    "metadata": "Other",
    "cdm_source": "Other",
    "concept": "Vocabulary",
    "vocabulary": "Vocabulary",
    "domain": "Vocabulary",
    "concept_class": "Vocabulary",
    "concept_relationship": "Vocabulary",
    "relationship": "Vocabulary",
    "concept_synonym": "Vocabulary",
    "concept_ancestor": "Vocabulary",
    "source_to_concept_map": "Other",
    "drug_strength": "Drug",
    "cohort": "Cohort",
    "cohort_definition": "Cohort",
}

# Datatype normalization: map OHDSI datatypes to simplified PHP config types
DATATYPE_MAP = {
    "integer": "integer",
    "bigint": "bigint",
    "float": "float",
    "numeric": "numeric",
    "varchar(max)": "text",
    "varchar(50)": "varchar",
    "varchar(20)": "varchar",
    "varchar(25)": "varchar",
    "varchar(10)": "varchar",
    "varchar(1)": "varchar",
    "varchar(2000)": "varchar",
    "varchar(255)": "varchar",
    "varchar(1000)": "varchar",
    "varchar(2)": "varchar",
    "varchar(3)": "varchar",
    "varchar(80)": "varchar",
    "varchar(9)": "varchar",
    "date": "date",
    "datetime": "datetime",
}


def normalize_datatype(raw: str) -> str:
    """Normalize a datatype string from the HTML to a simplified type."""
    raw_lower = raw.strip().lower()
    if raw_lower in DATATYPE_MAP:
        return DATATYPE_MAP[raw_lower]
    if raw_lower.startswith("varchar"):
        return "varchar"
    if raw_lower.startswith("integer"):
        return "integer"
    return raw_lower if raw_lower else "varchar"


def escape_php_string(s: str) -> str:
    """Escape a string for use inside PHP single-quoted strings."""
    return s.replace("\\", "\\\\").replace("'", "\\'")


def fetch_and_parse() -> list[dict]:
    """Fetch the CDM v5.4 page and parse all table definitions."""
    print(f"Fetching {CDM_URL} ...")
    resp = requests.get(CDM_URL, timeout=30)
    resp.raise_for_status()
    print(f"  Received {len(resp.text)} bytes")

    soup = BeautifulSoup(resp.text, "html.parser")
    html_tables = soup.find_all("table")
    print(f"  Found {len(html_tables)} HTML tables")

    cdm_tables = []

    for html_table in html_tables:
        # Check if this is a CDM field table (has 'CDM Field' header)
        headers = [th.get_text(strip=True) for th in html_table.find_all("th")]
        if "CDM Field" not in headers:
            continue

        # Get table name from parent div id
        parent_div = html_table.find_parent("div", class_="section")
        table_name = parent_div.get("id", "") if parent_div else ""
        if not table_name:
            # Fallback: get from preceding heading
            heading = html_table.find_previous(["h1", "h2", "h3", "h4", "h5"])
            table_name = heading.get_text(strip=True) if heading else "unknown"

        domain = TABLE_DOMAIN_MAP.get(table_name, "Other")

        # Build column index map from headers
        col_idx = {}
        for i, h in enumerate(headers):
            col_idx[h] = i

        columns = []
        rows = html_table.find_all("tr")
        for row in rows[1:]:  # skip header row
            cells = row.find_all("td")
            if len(cells) < len(headers):
                continue

            # Normalize whitespace: collapse newlines/tabs/multiple spaces into single space
            cell_texts = [
                re.sub(r"\s+", " ", td.get_text(strip=True)) for td in cells
            ]

            field_name = cell_texts[col_idx.get("CDM Field", 0)]
            user_guide = cell_texts[col_idx.get("User Guide", 1)]
            etl_conventions = cell_texts[col_idx.get("ETL Conventions", 2)]
            datatype_raw = cell_texts[col_idx.get("Datatype", 3)]
            required_raw = cell_texts[col_idx.get("Required", 4)]
            pk_raw = cell_texts[col_idx.get("Primary Key", 5)]
            fk_raw = cell_texts[col_idx.get("Foreign Key", 6)]
            fk_table = cell_texts[col_idx.get("FK Table", 7)]
            fk_domain = cell_texts[col_idx.get("FK Domain", 8)]

            columns.append(
                {
                    "name": field_name.lower(),
                    "type": normalize_datatype(datatype_raw),
                    "required": required_raw.strip().lower() == "yes",
                    "description": user_guide,
                    "etl_conventions": etl_conventions,
                    "is_primary_key": pk_raw.strip().lower() == "yes",
                    "is_foreign_key": fk_raw.strip().lower() == "yes",
                    "fk_table": fk_table if fk_table else None,
                    "fk_domain": fk_domain if fk_domain else None,
                }
            )

        if columns:
            cdm_tables.append(
                {
                    "name": table_name,
                    "domain": domain,
                    "columns": columns,
                }
            )
            print(f"  Parsed table: {table_name} ({len(columns)} columns)")

    return cdm_tables


def generate_php(tables: list[dict]) -> str:
    """Generate the PHP config file content."""
    lines = []
    lines.append("<?php")
    lines.append("")
    lines.append("// GENERATED — do not edit manually. Run scripts/scrape-cdm-docs.py")
    lines.append("")
    lines.append("return [")

    for table in tables:
        lines.append("    [")
        lines.append(f"        'name' => '{escape_php_string(table['name'])}',")
        lines.append(f"        'domain' => '{escape_php_string(table['domain'])}',")
        lines.append("        'columns' => [")

        for col in table["columns"]:
            lines.append("            [")
            lines.append(
                f"                'name' => '{escape_php_string(col['name'])}',")
            lines.append(
                f"                'type' => '{escape_php_string(col['type'])}',")
            lines.append(
                f"                'required' => {'true' if col['required'] else 'false'},")
            lines.append(
                f"                'description' => '{escape_php_string(col['description'])}',")
            lines.append(
                f"                'etl_conventions' => '{escape_php_string(col['etl_conventions'])}',")
            lines.append(
                f"                'is_primary_key' => {'true' if col['is_primary_key'] else 'false'},")
            lines.append(
                f"                'is_foreign_key' => {'true' if col['is_foreign_key'] else 'false'},")

            if col["fk_table"] is not None:
                lines.append(
                    f"                'fk_table' => '{escape_php_string(col['fk_table'])}',")
            else:
                lines.append("                'fk_table' => null,")

            if col["fk_domain"] is not None:
                lines.append(
                    f"                'fk_domain' => '{escape_php_string(col['fk_domain'])}',")
            else:
                lines.append("                'fk_domain' => null,")

            lines.append("            ],")

        lines.append("        ],")
        lines.append("    ],")

    lines.append("];")
    lines.append("")

    return "\n".join(lines)


def escape_ts_string(s: str) -> str:
    """Escape a string for use inside TypeScript double-quoted strings."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def generate_ts(tables: list[dict]) -> str:
    """Generate the TypeScript CDM schema file."""
    lines = []
    lines.append("// GENERATED — do not edit manually. Run scripts/scrape-cdm-docs.py")
    lines.append("")
    lines.append("export interface CdmColumn {")
    lines.append("  name: string;")
    lines.append("  type: string;")
    lines.append("  required: boolean;")
    lines.append("  description: string;")
    lines.append("  etl_conventions: string;")
    lines.append("  is_primary_key: boolean;")
    lines.append("  is_foreign_key: boolean;")
    lines.append("  fk_table: string | null;")
    lines.append("  fk_domain: string | null;")
    lines.append("}")
    lines.append("")
    lines.append("export interface CdmTable {")
    lines.append("  name: string;")
    lines.append("  domain: string;")
    lines.append("  columns: CdmColumn[];")
    lines.append("}")
    lines.append("")
    lines.append("export const CDM_SCHEMA_V54: CdmTable[] = [")

    for table in tables:
        lines.append("  {")
        lines.append(f'    name: "{escape_ts_string(table["name"])}",')
        lines.append(f'    domain: "{escape_ts_string(table["domain"])}",')
        lines.append("    columns: [")

        for col in table["columns"]:
            fk_t = f'"{escape_ts_string(col["fk_table"])}"' if col["fk_table"] else "null"
            fk_d = f'"{escape_ts_string(col["fk_domain"])}"' if col["fk_domain"] else "null"
            lines.append(
                f'      {{ name: "{escape_ts_string(col["name"])}", '
                f'type: "{escape_ts_string(col["type"])}", '
                f'required: {"true" if col["required"] else "false"}, '
                f'description: "{escape_ts_string(col["description"])}", '
                f'etl_conventions: "{escape_ts_string(col["etl_conventions"])}", '
                f'is_primary_key: {"true" if col["is_primary_key"] else "false"}, '
                f'is_foreign_key: {"true" if col["is_foreign_key"] else "false"}, '
                f"fk_table: {fk_t}, "
                f"fk_domain: {fk_d} }},"
            )

        lines.append("    ],")
        lines.append("  },")

    lines.append("];")
    lines.append("")

    return "\n".join(lines)


def main():
    tables = fetch_and_parse()

    if not tables:
        print("ERROR: No CDM tables found!", file=sys.stderr)
        sys.exit(1)

    print(f"\nTotal: {len(tables)} tables, "
          f"{sum(len(t['columns']) for t in tables)} columns")

    php_content = generate_php(tables)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(php_content)
    print(f"\nWrote PHP: {OUTPUT_PATH}")

    ts_content = generate_ts(tables)
    with open(TS_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"Wrote TS:  {TS_OUTPUT_PATH}")


if __name__ == "__main__":
    main()
