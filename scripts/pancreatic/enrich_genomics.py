#!/usr/bin/env python3
"""
Add genomic mutation profiles to all patients in the pancreas CDM.

TCGA-PAAD patients (care_site_id=3): Parse real somatic mutations from MAF files.
Original patients (care_site_id 1 or 2): Assign synthetic mutations based on
published PDAC frequencies.

Both store results as pancreas.measurement records.

Run: python3 scripts/pancreatic/enrich_genomics.py
"""

import gzip
import random
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ── OMOP concept IDs ──────────────────────────────────────────────────────────

MEASUREMENT_TYPE_EHR = 32817
VALUE_PRESENT = 4181412   # Present
VALUE_ABSENT = 4132135    # Absent

TARGET_GENES = ["KRAS", "TP53", "SMAD4", "CDKN2A"]

GENE_CONCEPT: dict[str, int] = {
    "KRAS":   3012200,
    "TP53":   3009106,
    "SMAD4":  1988360,
    "CDKN2A": 3026497,
}

# Variant classifications to skip (non-functional / intronic / UTR)
SKIP_CLASSIFICATIONS = {
    "Silent", "Intron", "3'UTR", "5'UTR", "3'Flank", "5'Flank",
}

# ── Synthetic mutation frequencies (PDAC literature) ─────────────────────────

# (gene, frequency, [(variant_hgvs, weight), ...])
SYNTHETIC_PROFILES: list[tuple[str, float, list[tuple[str, float]]]] = [
    ("KRAS", 0.93, [
        ("p.G12D", 0.41),
        ("p.G12V", 0.32),
        ("p.G12R", 0.16),
        ("p.Q61H", 0.05),
        ("p.G12C", 0.03),
        ("p.G12A", 0.03),
    ]),
    ("TP53", 0.72, [
        ("p.R175H", 0.10),
        ("p.R248W", 0.08),
        ("p.R273H", 0.07),
        ("p.G245S", 0.05),
        ("p.R282W", 0.05),
        ("p.other",  0.65),
    ]),
    ("SMAD4", 0.32, [
        ("p.R361H",   0.15),
        ("p.R361C",   0.10),
        ("deletion",  0.40),
        ("p.other_LOF", 0.35),
    ]),
    ("CDKN2A", 0.30, [
        ("deletion", 0.70),
        ("p.R58*",   0.10),
        ("p.other",  0.20),
    ]),
]

# ── Database connection ───────────────────────────────────────────────────────

DB_CONN_ARGS = ["-h", "localhost", "-U", "claude_dev", "-d", "parthenon"]
MAF_ROOT = Path("/mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD")


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class PatientInfo:
    person_id: int
    person_source_value: str
    care_site_id: int
    first_visit_id: int
    measurement_date: str  # ISO date string


@dataclass
class MutationRecord:
    """One gene × patient measurement row."""
    person_id: int
    measurement_concept_id: int
    measurement_date: str
    visit_occurrence_id: int
    value_as_concept_id: int
    measurement_source_value: str  # "{gene} somatic mutation analysis"
    value_source_value: str        # HGVS or "wild-type"


# ── Database helpers ──────────────────────────────────────────────────────────

def run_sql(sql: str) -> str:
    """Run a SQL statement and return stdout."""
    result = subprocess.run(
        ["psql", *DB_CONN_ARGS, "-t", "-A", "-c", sql],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")
    return result.stdout.strip()


def run_sql_file(path: Path) -> None:
    """Execute a SQL file."""
    result = subprocess.run(
        ["psql", *DB_CONN_ARGS, "-f", str(path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")


def fetch_patients() -> list[PatientInfo]:
    """
    Fetch all patients with their first visit and specimen/visit date for
    use as the measurement date.

    Priority: specimen_date → first visit_start_date
    """
    sql = """
SELECT
    p.person_id,
    p.person_source_value,
    p.care_site_id,
    MIN(v.visit_occurrence_id) AS first_visit_id,
    COALESCE(
        MIN(s.specimen_date),
        MIN(v.visit_start_date)
    )::text AS measurement_date
FROM pancreas.person p
JOIN pancreas.visit_occurrence v ON v.person_id = p.person_id
LEFT JOIN pancreas.specimen s ON s.person_id = p.person_id
GROUP BY p.person_id, p.person_source_value, p.care_site_id
ORDER BY p.person_id;
"""
    result = subprocess.run(
        ["psql", *DB_CONN_ARGS, "-t", "-A", "-F", "\t", "-c", sql],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")

    patients: list[PatientInfo] = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        patients.append(PatientInfo(
            person_id=int(parts[0]),
            person_source_value=parts[1],
            care_site_id=int(parts[2]),
            first_visit_id=int(parts[3]),
            measurement_date=parts[4],
        ))
    return patients


# ── MAF parsing ───────────────────────────────────────────────────────────────

def parse_maf_files() -> dict[str, dict[str, str]]:
    """
    Parse all TCGA-PAAD MAF files and return:
        {tcga_barcode_12: {gene: hgvs_short}}

    Only target genes with non-silent classifications are recorded.
    If multiple mutations exist for a gene, the first non-silent one is kept.
    """
    maf_files = list(MAF_ROOT.rglob("*.wxs.aliquot_ensemble_masked.maf.gz"))
    print(f"  Found {len(maf_files)} MAF files")

    # {barcode: {gene: hgvs}}
    mutations: dict[str, dict[str, str]] = {}

    for maf_path in maf_files:
        try:
            with gzip.open(maf_path, "rt", encoding="utf-8", errors="replace") as fh:
                header_cols: list[str] | None = None
                col_idx: dict[str, int] = {}

                for raw_line in fh:
                    line = raw_line.rstrip("\n")
                    if line.startswith("#"):
                        continue

                    if header_cols is None:
                        # First non-comment line is the header
                        header_cols = line.split("\t")
                        col_idx = {c: i for i, c in enumerate(header_cols)}
                        continue

                    parts = line.split("\t")
                    if len(parts) < 37:
                        continue

                    # Use positional indices as spec'd (0-indexed)
                    gene = parts[0]                # Hugo_Symbol
                    if gene not in TARGET_GENES:
                        continue

                    classification = parts[8]      # Variant_Classification
                    if classification in SKIP_CLASSIFICATIONS:
                        continue

                    barcode_full = parts[15]        # Tumor_Sample_Barcode
                    barcode = barcode_full[:12]     # First 12 chars

                    hgvs = parts[36] if len(parts) > 36 else ""  # HGVSp_Short
                    if not hgvs or hgvs == ".":
                        hgvs = classification  # Fall back to classification label

                    if barcode not in mutations:
                        mutations[barcode] = {}
                    # Keep first recorded mutation per gene
                    if gene not in mutations[barcode]:
                        mutations[barcode][gene] = hgvs

        except Exception as exc:
            print(f"  Warning: could not parse {maf_path.name}: {exc}")

    print(f"  Parsed mutations for {len(mutations)} TCGA barcodes")
    return mutations


# ── Synthetic assignment ───────────────────────────────────────────────────────

def pick_weighted(rng: random.Random, choices: list[tuple[str, float]]) -> str:
    """Pick a variant using weighted random selection."""
    labels = [c[0] for c in choices]
    weights = [c[1] for c in choices]
    return rng.choices(labels, weights=weights, k=1)[0]


def assign_synthetic_mutations(person_id: int) -> dict[str, str]:
    """
    Deterministically assign synthetic mutations for a non-TCGA patient.

    Returns {gene: hgvs_short_or_wild_type}
    """
    rng = random.Random(person_id * 61 + 103)
    result: dict[str, str] = {}

    for gene, freq, variants in SYNTHETIC_PROFILES:
        if rng.random() < freq:
            result[gene] = pick_weighted(rng, variants)
        else:
            result[gene] = "wild-type"

    return result


# ── Record building ───────────────────────────────────────────────────────────

def build_records_for_patient(
    patient: PatientInfo,
    tcga_mutations: dict[str, dict[str, str]],
) -> list[MutationRecord]:
    """Build 4 MutationRecord rows (one per target gene) for a patient."""
    records: list[MutationRecord] = []

    if patient.care_site_id == 3:
        # TCGA-PAAD — use parsed MAF data
        gene_map = tcga_mutations.get(patient.person_source_value, {})
    else:
        # Synthetic assignment for PANCREAS-CT / CPTAC-PDA
        gene_map = assign_synthetic_mutations(patient.person_id)

    for gene in TARGET_GENES:
        hgvs = gene_map.get(gene, "wild-type")
        is_mutated = hgvs != "wild-type"

        records.append(MutationRecord(
            person_id=patient.person_id,
            measurement_concept_id=GENE_CONCEPT[gene],
            measurement_date=patient.measurement_date,
            visit_occurrence_id=patient.first_visit_id,
            value_as_concept_id=VALUE_PRESENT if is_mutated else VALUE_ABSENT,
            measurement_source_value=f"{gene} somatic mutation analysis",
            value_source_value=hgvs if is_mutated else "wild-type",
        ))

    return records


# ── SQL generation and execution ──────────────────────────────────────────────

def generate_insert_sql(records: list[MutationRecord], start_id: int) -> str:
    """
    Generate INSERT SQL for all measurement records.

    Column order (23 columns):
        measurement_id, person_id, measurement_concept_id, measurement_date,
        measurement_datetime, measurement_time, measurement_type_concept_id,
        operator_concept_id, value_as_number, value_as_concept_id,
        unit_concept_id, range_low, range_high, provider_id,
        visit_occurrence_id, visit_detail_id, measurement_source_value,
        measurement_source_concept_id, unit_source_value, unit_source_concept_id,
        value_source_value, measurement_event_id, meas_event_field_concept_id
    """
    rows: list[str] = []

    for idx, rec in enumerate(records):
        mid = start_id + idx
        mdate = rec.measurement_date
        # Escape single quotes in source value strings
        msv = rec.measurement_source_value.replace("'", "''")
        vsv = rec.value_source_value.replace("'", "''")

        rows.append(
            f"({mid}, {rec.person_id}, {rec.measurement_concept_id}, "
            f"'{mdate}', '{mdate} 09:00:00', NULL, "
            f"{MEASUREMENT_TYPE_EHR}, NULL, NULL, "
            f"{rec.value_as_concept_id}, "
            f"NULL, NULL, NULL, NULL, "
            f"{rec.visit_occurrence_id}, NULL, "
            f"'{msv}', NULL, NULL, NULL, "
            f"'{vsv}', NULL, NULL)"
        )

    lines = [
        "BEGIN;",
        "",
        "-- Clear existing genomic measurements",
        "DELETE FROM pancreas.measurement",
        "WHERE measurement_concept_id IN (3012200, 3009106, 1988360, 3026497);",
        "",
        "-- Insert genomic mutation profiles",
        "INSERT INTO pancreas.measurement VALUES",
        ",\n".join(rows) + ";",
        "",
        "COMMIT;",
    ]
    return "\n".join(lines)


# ── Summary / verification ────────────────────────────────────────────────────

def print_summary(records: list[MutationRecord], n_tcga: int, n_synthetic: int) -> None:
    """Print mutation rate summary per gene."""
    total = len(records)
    n_patients = total // len(TARGET_GENES)

    print(f"\n{'─' * 60}")
    print(f"  Total measurement records inserted: {total}")
    print(f"  Patients:  {n_patients} total  ({n_tcga} TCGA-PAAD + {n_synthetic} synthetic)")
    print(f"{'─' * 60}")
    print(f"  {'Gene':<10}  {'Mutated':>7}  {'Wild-type':>10}  {'Rate':>7}")
    print(f"  {'────':<10}  {'───────':>7}  {'─────────':>10}  {'────':>7}")

    for gene in TARGET_GENES:
        gene_concept = GENE_CONCEPT[gene]
        mutated = sum(
            1 for r in records
            if r.measurement_concept_id == gene_concept
            and r.value_as_concept_id == VALUE_PRESENT
        )
        wt = sum(
            1 for r in records
            if r.measurement_concept_id == gene_concept
            and r.value_as_concept_id == VALUE_ABSENT
        )
        rate = mutated / (mutated + wt) * 100 if (mutated + wt) > 0 else 0.0
        print(f"  {gene:<10}  {mutated:>7}  {wt:>10}  {rate:>6.1f}%")

    print(f"{'─' * 60}\n")


def verify_db() -> None:
    """Confirm each patient has exactly 4 genomic measurements."""
    sql = """
SELECT
    count(*) FILTER (WHERE cnt = 4) AS patients_with_4,
    count(*) FILTER (WHERE cnt != 4) AS patients_with_wrong_count,
    count(*) AS total_patients
FROM (
    SELECT person_id, count(*) AS cnt
    FROM pancreas.measurement
    WHERE measurement_concept_id IN (3012200, 3009106, 1988360, 3026497)
    GROUP BY person_id
) sub;
"""
    result = subprocess.run(
        ["psql", *DB_CONN_ARGS, "-c", sql],
        capture_output=True,
        text=True,
    )
    print("Database verification:")
    print(result.stdout)

    # Also show per-gene counts from DB
    sql2 = """
SELECT
    CASE measurement_concept_id
        WHEN 3012200 THEN 'KRAS'
        WHEN 3009106 THEN 'TP53'
        WHEN 1988360 THEN 'SMAD4'
        WHEN 3026497 THEN 'CDKN2A'
    END AS gene,
    sum(CASE WHEN value_as_concept_id = 4181412 THEN 1 ELSE 0 END) AS mutated,
    sum(CASE WHEN value_as_concept_id = 4132135 THEN 1 ELSE 0 END) AS wild_type,
    round(
        100.0 * sum(CASE WHEN value_as_concept_id = 4181412 THEN 1 ELSE 0 END)
        / count(*), 1
    ) AS mutation_rate_pct
FROM pancreas.measurement
WHERE measurement_concept_id IN (3012200, 3009106, 1988360, 3026497)
GROUP BY measurement_concept_id
ORDER BY gene;
"""
    result2 = subprocess.run(
        ["psql", *DB_CONN_ARGS, "-c", sql2],
        capture_output=True,
        text=True,
    )
    print("Per-gene mutation rates (from DB):")
    print(result2.stdout)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=== Pancreatic CDM — Genomics Enrichment ===\n")

    # 1. Fetch all patients
    print("Fetching patients...")
    patients = fetch_patients()
    print(f"  {len(patients)} patients loaded")

    tcga_patients = [p for p in patients if p.care_site_id == 3]
    synthetic_patients = [p for p in patients if p.care_site_id in (1, 2)]
    print(f"  {len(tcga_patients)} TCGA-PAAD (care_site_id=3)")
    print(f"  {len(synthetic_patients)} PANCREAS-CT/CPTAC-PDA (care_site_id 1 or 2)")

    # 2. Parse MAF files for TCGA patients
    print("\nParsing TCGA-PAAD MAF files...")
    tcga_mutations = parse_maf_files()

    # 3. Build measurement records for all patients
    print("\nBuilding measurement records...")
    all_records: list[MutationRecord] = []

    for patient in patients:
        recs = build_records_for_patient(patient, tcga_mutations)
        all_records.extend(recs)

    print(f"  {len(all_records)} total records ({len(patients)} patients × {len(TARGET_GENES)} genes)")

    # 4. Get starting measurement_id
    max_id_str = run_sql("SELECT COALESCE(MAX(measurement_id), 0) FROM pancreas.measurement;")
    # After the DELETE in the transaction the non-genomic records remain; we
    # need the max of ALL current records so we don't collide with them.
    # We'll re-query after the DELETE inside the transaction by simply using
    # a high enough start.  But since we'll DELETE genomic rows first and then
    # INSERT, we just need the max of non-genomic rows.
    non_genomic_max_sql = (
        "SELECT COALESCE(MAX(measurement_id), 0) FROM pancreas.measurement "
        "WHERE measurement_concept_id NOT IN (3012200, 3009106, 1988360, 3026497);"
    )
    non_genomic_max_str = run_sql(non_genomic_max_sql)
    start_id = int(non_genomic_max_str) + 1
    print(f"  Starting measurement_id: {start_id}")

    # 5. Generate and execute SQL
    print("\nGenerating SQL...")
    sql = generate_insert_sql(all_records, start_id)

    sql_path = Path(__file__).parent / "enrich_genomics.sql"
    sql_path.write_text(sql)
    print(f"  Written to {sql_path}")

    print("Executing SQL...")
    run_sql_file(sql_path)
    print("  Done.")

    # 6. Print in-memory summary
    print_summary(all_records, len(tcga_patients), len(synthetic_patients))

    # 7. Verify against DB
    verify_db()

    print("Genomics enrichment complete.")


if __name__ == "__main__":
    main()
