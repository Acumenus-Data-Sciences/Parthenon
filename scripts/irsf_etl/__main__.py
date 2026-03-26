"""CLI entry point for the IRSF ETL pipeline.

Usage:
    python -m scripts.irsf_etl [command]

Commands:
    profile              Profile source CSV files and generate data quality reports
    visit-derivation     Derive visit_occurrence from study visits and hospitalizations
    measurements         Transform measurement sources into OMOP measurement rows

Run with --help for full usage information.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with all subcommands."""
    parser = argparse.ArgumentParser(
        prog="irsf-etl",
        description="IRSF Natural History Study ETL pipeline for OMOP CDM conversion",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Profile subcommand
    profile_parser = subparsers.add_parser(
        "profile",
        help="Profile source CSV files and generate data quality reports",
    )
    profile_parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Path to source data directory (overrides config)",
    )
    profile_parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Path to output directory for profile report (overrides config)",
    )
    profile_parser.add_argument(
        "--json-only",
        action="store_true",
        default=False,
        help="Suppress console table output; write JSON report only",
    )

    # Demographics subcommand
    subparsers.add_parser(
        "demographics",
        help="Build person roster and death records as OMOP staging CSVs",
    )

    # Visit derivation subcommand
    subparsers.add_parser(
        "visit-derivation",
        help="Derive visit_occurrence from study visits and hospitalizations",
    )

    # Measurements subcommand
    subparsers.add_parser(
        "measurements",
        help="Transform measurement sources into OMOP measurement rows",
    )

    # MBA observations subcommand
    subparsers.add_parser(
        "observation-mba",
        help="Transform MBA scores into OMOP observation rows",
    )

    # Genotype observations subcommand
    subparsers.add_parser(
        "observation-genotype",
        help="Transform genotype boolean columns into OMOP observation rows",
    )

    # Categorical observations subcommand
    subparsers.add_parser(
        "observation-categorical",
        help="Transform categorical clinical data into OMOP observation rows",
    )

    # Medications subcommand
    medications_parser = subparsers.add_parser(
        "medications",
        help="Run medication ETL: RxNorm parsing, vocabulary validation, drug_exposure staging",
    )
    medications_parser.add_argument(
        "--skip-vocab",
        action="store_true",
        default=False,
        help="Skip vocabulary DB validation (offline mode, all concept_ids = 0)",
    )

    # Validate DQD subcommand
    dqd_parser = subparsers.add_parser(
        "validate-dqd",
        help="Run DQD validation: dispatch run, poll, and verify >= 80%% pass rate",
    )
    dqd_parser.add_argument(
        "--source-id",
        type=int,
        default=None,
        help="Parthenon source ID for the IRSF-NHS data source (default: 57)",
    )
    dqd_parser.add_argument(
        "--run-id",
        type=str,
        default=None,
        help="Existing DQD run ID to analyze (skip dispatching)",
    )
    dqd_parser.add_argument(
        "--db-only",
        action="store_true",
        default=False,
        help="Query DQD results directly from database (requires --run-id)",
    )

    # Validate rejections subcommand
    subparsers.add_parser(
        "validate-rejections",
        help="Validate ETL rejection rates: verify < 5%% for high-priority tables",
    )

    return parser


def _run_profile(args: argparse.Namespace) -> int:
    """Execute the profile subcommand."""
    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.profile_sources import profile_all, write_report

    # Build config, optionally overriding source_root and output_dir
    overrides: dict[str, Path] = {}
    if args.source is not None:
        overrides["source_root"] = Path(args.source)

    config = ETLConfig(**overrides)

    output_dir = Path(args.output_dir) if args.output_dir else config.profiles_dir

    profiles = profile_all(config)

    if not profiles:
        print("No CSV files found to profile.")
        return 1

    write_report(profiles, output_dir, json_only=args.json_only)
    return 0


def _run_demographics() -> int:
    """Execute the demographics subcommand — build person.csv and death.csv."""
    import logging

    import pandas as pd

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.lib.csv_utils import read_csv_safe
    from scripts.irsf_etl.lib.death_builder import build_death_records
    from scripts.irsf_etl.lib.id_registry import PersonIdRegistry
    from scripts.irsf_etl.lib.person_builder import build_person_roster
    from scripts.irsf_etl.lib.rejection_log import RejectionLog

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    staging_dir = config.staging_dir
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Load source data
    custom_extracts = config.source_root / "5211_Custom_Extracts" / "csv"
    raw_5211 = config.source_root / "5211" / "csv"

    person_chars = read_csv_safe(custom_extracts / "Person_Characteristics_5201_5211.csv")
    demographics_path = raw_5211 / "Demographics_5211.csv"
    demographics: pd.DataFrame | None = read_csv_safe(demographics_path) if demographics_path.exists() else None

    registry = PersonIdRegistry.from_csv(config.staging_dir / "person_id_map.csv")
    rejection_log = RejectionLog("demographics")

    person_df = build_person_roster(person_chars, demographics, registry, rejection_log)
    person_path = staging_dir / "person.csv"
    person_df.to_csv(person_path, index=False)
    print(f"  person.csv: {len(person_df)} rows -> {person_path}")

    # Death records (in Custom Extracts, not raw 5211)
    death_path_src = custom_extracts / "DeathRecord_5211.csv"
    if death_path_src.exists():
        death_src = read_csv_safe(death_path_src)
        death_rejection = RejectionLog("death")
        death_df = build_death_records(death_src, registry, death_rejection)
        death_path = staging_dir / "death.csv"
        death_df.to_csv(death_path, index=False)
        print(f"  death.csv:  {len(death_df)} rows -> {death_path}")
    else:
        print("  death.csv:  SKIPPED (DeathRecord_5211.csv not found)")

    print(f"\nDemographics Complete")
    print(f"  Gender: {person_df['gender_concept_id'].value_counts().to_dict()}")
    print(f"  Unique persons: {person_df['person_id'].nunique()}")

    return 0


def _run_visit_derivation() -> int:
    """Execute the visit-derivation subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.visit_derivation import derive_visits

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    visit_occ, visit_map = derive_visits(config)

    print(f"\nVisit Derivation Complete")
    print(f"  visit_occurrence.csv: {len(visit_occ)} rows")
    print(f"  visit_id_map.csv:     {len(visit_map)} rows")

    if not visit_occ.empty:
        concept_counts = visit_occ["visit_concept_id"].value_counts()
        print(f"\nVisit type distribution:")
        for concept_id, count in concept_counts.items():
            label = {9201: "Inpatient", 9202: "Outpatient", 9203: "ER"}.get(
                int(concept_id), f"Unknown ({concept_id})"
            )
            print(f"  {label} ({concept_id}): {count}")

        person_count = visit_occ["person_id"].nunique()
        print(f"\nUnique patients with visits: {person_count}")

    return 0


def _run_measurements() -> int:
    """Execute the measurements subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.measurement_etl import transform_measurements

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    measurements = transform_measurements(config)

    print(f"\nMeasurements Complete")
    print(f"  measurement.csv: {len(measurements)} rows")

    if not measurements.empty:
        concept_counts = measurements["measurement_concept_id"].value_counts()
        print(f"\nMeasurement concept distribution:")
        concept_labels = {
            3036277: "Height (cm)",
            3025315: "Weight (kg)",
            3038553: "BMI (kg/m2)",
            3036832: "Head circumference (cm)",
        }
        for concept_id, count in concept_counts.items():
            label = concept_labels.get(int(concept_id), f"Unknown ({concept_id})")
            print(f"  {label} ({concept_id}): {count}")

        person_count = measurements["person_id"].nunique()
        print(f"\nUnique patients with measurements: {person_count}")

        rejection_count = 0
        reports_dir = config.reports_dir
        rejection_path = reports_dir / "measurement_growth_rejections.csv"
        if rejection_path.exists():
            import pandas as pd

            rej_df = pd.read_csv(rejection_path)
            rejection_count = len(rej_df)
        print(f"Rejections: {rejection_count}")

    return 0


def _run_observation_mba() -> int:
    """Execute the observation-mba subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.observation_mba import transform_mba_observations

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    result = transform_mba_observations(config)

    print(f"\nMBA Observations Complete")
    print(f"  observation_mba.csv: {len(result)} rows")

    if not result.empty:
        unique_concepts = result["observation_concept_id"].nunique()
        print(f"  Unique MBA concepts: {unique_concepts}")

        person_count = result["person_id"].nunique()
        print(f"  Unique patients: {person_count}")

        visit_resolved = result["visit_occurrence_id"].notna().sum()
        print(f"  Visit resolved: {visit_resolved}/{len(result)} ({visit_resolved / len(result) * 100:.1f}%)")

        # Show GrandTotal stats
        grand_total = result[result["observation_source_value"] == "GrandTotal"]
        if not grand_total.empty:
            print(f"\n  GrandTotal observations: {len(grand_total)}")
            print(f"  GrandTotal concept_id: {grand_total['observation_concept_id'].iloc[0]}")
            print(f"  GrandTotal score range: {grand_total['value_as_number'].min():.0f} - {grand_total['value_as_number'].max():.0f}")

    return 0


def _run_observation_genotype() -> int:
    """Execute the observation-genotype subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.observation_genotype import transform_genotype_observations

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    result = transform_genotype_observations(config)

    print(f"\nGenotype Observations Complete")
    print(f"  observation_genotype.csv: {len(result)} rows")

    if not result.empty:
        unique_concepts = result["observation_concept_id"].nunique()
        print(f"  Unique mutation concepts: {unique_concepts}")

        person_count = result["person_id"].nunique()
        print(f"  Unique patients with mutations: {person_count}")

        # All visit_occurrence_id should be NULL
        null_visits = result["visit_occurrence_id"].isna().sum()
        print(f"  NULL visit_occurrence_id: {null_visits}/{len(result)}")

        # Show mutations per person distribution
        mutations_per_person = result.groupby("person_id").size()
        print(f"\n  Mutations per person: min={mutations_per_person.min()}, "
              f"median={mutations_per_person.median():.0f}, "
              f"max={mutations_per_person.max()}")

        # Top 5 most common mutations
        print(f"\n  Top 5 most common mutations:")
        top_mutations = result["observation_source_value"].value_counts().head(5)
        for mutation, count in top_mutations.items():
            print(f"    {mutation}: {count}")

    return 0


def _run_observation_categorical() -> int:
    """Execute the observation-categorical subcommand."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.observation_categorical import transform_categorical_observations

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    result = transform_categorical_observations(config)

    print(f"\nCategorical Observations Complete")
    print(f"  observation_categorical.csv: {len(result)} rows")

    if not result.empty:
        # Per-source breakdown
        source_patterns = {
            "Rett Features": "Everoccurred|AtBaseline|At1Y|At2Y|At3Y|At4Y|At5Y",
            "DevHx": "Learned|Lost|Relearned|HowSudden|RegressSameTime",
            "Allergies": "^(?!Nutrition|AbnormalMovement|DysmorphicCB|Dysm|Contractures|Gait|Descript|Alertness|Interaction|CranialNerves|Sitting|Standing|Walking|Ataxia|AxialTone|AppendicTone|OverallHypertonia|Dystonia|Bradykinesia|Chorea|Bruxism|TruncalRocking|VerbLang|RespToSpoken|Duration|NonverbChoice|HandDominance|HandUseImpression|SelfAbusive|Aggressive|OverallReflexes|DegreeHyperreflexia|Hyperactivity|Hypoactivity)",
        }

        person_count = result["person_id"].nunique()
        print(f"  Unique patients: {person_count}")

        # Type distribution
        type_counts = result["observation_type_concept_id"].value_counts()
        type_labels = {32883: "Survey", 32817: "EHR"}
        print(f"\n  Type distribution:")
        for type_id, count in type_counts.items():
            label = type_labels.get(int(type_id), f"Unknown ({type_id})")
            print(f"    {label} ({type_id}): {count}")

        # Source value sample
        print(f"\n  Sample source values (first 10):")
        for sv in result["observation_source_value"].unique()[:10]:
            print(f"    {sv}")

    return 0


def _run_medications(args: argparse.Namespace) -> int:
    """Execute the medications subcommand — run full medication ETL."""
    import logging

    from scripts.irsf_etl.config import ETLConfig
    from scripts.irsf_etl.medication_etl import run_medication_etl

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    config = ETLConfig()
    drug_exposure_df, stats = run_medication_etl(
        config, skip_vocab=args.skip_vocab
    )

    print(f"\nMedication ETL Complete")
    print(f"  Input rows:     {stats.total_input_rows}")
    print(f"  Output rows:    {stats.total_output_rows}")
    print(f"  Mapped:         {stats.mapped_count}")
    print(f"  Unmapped:       {stats.unmapped_count}")
    print(f"  Remapped:       {stats.remapped_count}")
    print(f"  Date fallback:  {stats.date_fallback_count}")
    print(f"  Coverage rate:  {stats.coverage_rate * 100:.1f}%")

    if not drug_exposure_df.empty:
        # Top 10 most common drug concepts
        top_concepts = (
            drug_exposure_df[drug_exposure_df["drug_concept_id"] > 0]
            .groupby("drug_concept_id")
            .agg(
                count=("drug_concept_id", "size"),
                source_value=("drug_source_value", "first"),
            )
            .sort_values("count", ascending=False)
            .head(10)
        )
        if not top_concepts.empty:
            print(f"\n  Top 10 drug concepts:")
            for concept_id, row in top_concepts.iterrows():
                print(f"    {concept_id}: {row['source_value']} ({row['count']} rows)")

        person_count = drug_exposure_df["person_id"].nunique()
        print(f"\n  Unique patients with medications: {person_count}")

    return 0


def _run_validate_dqd(args: argparse.Namespace) -> int:
    """Execute the validate-dqd subcommand."""
    import logging

    from scripts.irsf_etl.validate_dqd import run_validate_dqd

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    source_id = args.source_id
    run_id = args.run_id
    db_only = args.db_only

    if db_only and not run_id:
        print("ERROR: --db-only requires --run-id")
        return 1

    if not source_id and not run_id:
        source_id = 57  # Default IRSF-NHS source ID

    report = run_validate_dqd(
        source_id=source_id,
        run_id=run_id,
        db_only=db_only,
    )

    if report is None:
        print("DQD validation could not complete. See instructions above.")
        return 1

    return 0 if report.target_met else 2


def _run_validate_rejections() -> int:
    """Execute the validate-rejections subcommand."""
    import logging

    from scripts.irsf_etl.validate_rejections import run_validate_rejections

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    report = run_validate_rejections()

    if not report.high_priority_targets_met:
        print("FAIL: High-priority tables exceed 5% rejection rate threshold")
        return 2

    print("PASS: All high-priority tables below 5% rejection rate")
    return 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point for the IRSF ETL CLI."""
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "profile":
        return _run_profile(args)

    if args.command == "demographics":
        return _run_demographics()

    if args.command == "visit-derivation":
        return _run_visit_derivation()

    if args.command == "measurements":
        return _run_measurements()

    if args.command == "observation-mba":
        return _run_observation_mba()

    if args.command == "observation-genotype":
        return _run_observation_genotype()

    if args.command == "observation-categorical":
        return _run_observation_categorical()

    if args.command == "medications":
        return _run_medications(args)

    if args.command == "validate-dqd":
        return _run_validate_dqd(args)

    if args.command == "validate-rejections":
        return _run_validate_rejections()

    return 0


if __name__ == "__main__":
    sys.exit(main())
