#!/usr/bin/env python3
"""
Bulk-import GIAB NISTv4.2.1 VCF files into Parthenon genomic_variants table.

Uses PostgreSQL COPY protocol via psycopg2 for high-throughput ingestion
(~100k+ rows/sec vs ~100 rows/sec with row-by-row Eloquent inserts).

Usage:
    python3 scripts/import-giab-vcf.py [--vcf-dir /path/to/vcf/giab_NISTv4.2.1]

Defaults:
    --vcf-dir: ./vcf/giab_NISTv4.2.1
    DB: localhost:5480/parthenon (Docker PG)
    Source: Acumenus CDM (id=2)
    Created by: admin@acumenus.net (id=36)
"""

import argparse
import glob
import io
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

DB_CONFIG = {
    "host": "pgsql.acumenus.net",
    "port": 5432,
    "dbname": "ohdsi",
    "user": "smudoshi",
    "password": "acumenus",
}

# Schema prefix for all tables (Laravel uses app schema via search_path)
SCHEMA = "app"

SOURCE_ID = 2       # Acumenus CDM
CREATED_BY = 36     # admin@acumenus.net
GENOME_BUILD = "GRCh38"
BATCH_SIZE = 50_000  # rows per COPY batch


def connect():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(f"SET search_path TO {SCHEMA}, public")
    conn.commit()
    return conn


def create_upload_record(conn, filename: str, file_size: int, sample_id: str) -> int:
    """Insert a genomic_uploads row and return its ID."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO app.genomic_uploads
                (source_id, created_by, filename, file_format, file_size_bytes,
                 status, genome_build, sample_id, total_variants, mapped_variants,
                 review_required, storage_path, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s, %s, %s)
            RETURNING id
            """,
            (
                SOURCE_ID,
                CREATED_BY,
                filename,
                "vcf",
                file_size,
                "parsing",
                GENOME_BUILD,
                sample_id,
                f"genomics/uploads/giab/{filename}",
                now,
                now,
            ),
        )
        upload_id = cur.fetchone()[0]
    conn.commit()
    return upload_id


def update_upload_status(conn, upload_id: int, total_variants: int, status: str = "mapped"):
    """Update upload record with final counts and status."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE app.genomic_uploads
            SET status = %s, total_variants = %s, parsed_at = %s, updated_at = %s
            WHERE id = %s
            """,
            (status, total_variants, now, now, upload_id),
        )
    conn.commit()


def parse_genotype(format_str: str, sample_str: str):
    """Extract zygosity, allele_frequency, read_depth from FORMAT/SAMPLE columns."""
    if not format_str or not sample_str:
        return None, None, None

    fields = format_str.split(":")
    values = sample_str.split(":")
    data = dict(zip(fields, values))

    # Zygosity from GT
    zygosity = None
    gt = data.get("GT", "")
    if gt:
        alleles = re.split(r"[/|]", gt)
        alleles = [a for a in alleles if a != "."]
        if alleles:
            zygosity = "homozygous" if len(set(alleles)) == 1 else "heterozygous"

    # Allele frequency from AD
    af = None
    ad = data.get("AD", "")
    if ad:
        parts = ad.split(",")
        if len(parts) >= 2:
            try:
                ref_d, alt_d = int(parts[0]), int(parts[1])
                total = ref_d + alt_d
                if total > 0:
                    af = round(alt_d / total, 6)
            except ValueError:
                pass

    # Read depth
    dp = None
    dp_str = data.get("DP", "")
    if dp_str and dp_str != ".":
        try:
            dp = int(dp_str)
        except ValueError:
            pass

    return zygosity, af, dp


def infer_variant_type(ref: str, alt: str) -> str:
    if len(ref) == len(alt):
        return "SNP" if len(ref) == 1 else "MNP"
    return "INS" if len(ref) < len(alt) else "DEL"


def escape_copy_value(val):
    """Escape a value for PostgreSQL COPY TSV format."""
    if val is None:
        return "\\N"
    s = str(val)
    # Escape backslashes, tabs, newlines
    s = s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")
    return s


# COPY column order (must match the COPY statement)
COPY_COLUMNS = (
    "upload_id", "source_id", "person_id", "sample_id",
    "chromosome", "position", "reference_allele", "alternate_allele",
    "genome_build", "gene_symbol", "hgvs_c", "hgvs_p",
    "variant_type", "variant_class", "consequence",
    "quality", "filter_status", "zygosity",
    "allele_frequency", "read_depth",
    "clinvar_id", "clinvar_significance", "cosmic_id",
    "tmb_contribution", "is_msi_marker",
    "measurement_concept_id", "measurement_source_value",
    "value_as_concept_id", "mapping_status", "omop_measurement_id",
    "raw_info", "created_at", "updated_at",
)


def build_copy_row(fields: list, sample_id: str, upload_id: int, now_str: str) -> str | None:
    """Parse a VCF data line and return a COPY-format TSV row."""
    if len(fields) < 5:
        return None

    chrom = fields[0].lstrip("chr")
    pos = fields[1]
    ref = fields[3]
    alt = fields[4]
    qual = fields[5] if len(fields) > 5 and fields[5] != "." else None
    filt = fields[6] if len(fields) > 6 else None
    info_str = fields[7] if len(fields) > 7 else ""
    format_str = fields[8] if len(fields) > 8 else ""
    sample_str = fields[9] if len(fields) > 9 else ""

    # Parse genotype
    zygosity, af, dp = parse_genotype(format_str, sample_str)

    # Parse a few useful INFO keys (platforms count for raw_info)
    info_subset = {}
    for part in info_str.split(";")[:10]:
        if "=" in part:
            k, v = part.split("=", 1)
            info_subset[k.strip()] = v.strip()

    variant_type = infer_variant_type(ref, alt)
    source_value = f"{chrom}:{pos}:{ref}>{alt}"

    # Build row values in COPY_COLUMNS order
    vals = [
        upload_id,            # upload_id
        SOURCE_ID,            # source_id
        None,                 # person_id
        sample_id,            # sample_id
        chrom,                # chromosome
        pos,                  # position
        ref,                  # reference_allele
        alt,                  # alternate_allele
        GENOME_BUILD,         # genome_build
        None,                 # gene_symbol
        None,                 # hgvs_c
        None,                 # hgvs_p
        variant_type,         # variant_type
        None,                 # variant_class
        None,                 # consequence
        qual,                 # quality
        filt,                 # filter_status
        zygosity,             # zygosity
        af,                   # allele_frequency
        dp,                   # read_depth
        None,                 # clinvar_id
        None,                 # clinvar_significance
        None,                 # cosmic_id
        None,                 # tmb_contribution
        "f",                  # is_msi_marker (boolean)
        0,                    # measurement_concept_id
        source_value,         # measurement_source_value
        None,                 # value_as_concept_id
        "unmapped",           # mapping_status
        None,                 # omop_measurement_id
        json.dumps(info_subset) if info_subset else "{}",  # raw_info
        now_str,              # created_at
        now_str,              # updated_at
    ]

    return "\t".join(escape_copy_value(v) for v in vals)


def import_vcf_file(conn, filepath: str) -> int:
    """Import a single VCF file using COPY protocol. Returns variant count."""
    filename = os.path.basename(filepath)
    file_size = os.path.getsize(filepath)

    # Extract sample ID from filename (e.g., HG001)
    match = re.match(r"(HG\d+)", filename)
    sample_id = match.group(1) if match else filename.split("_")[0]

    print(f"\n{'='*70}")
    print(f"  Importing: {filename}")
    print(f"  Sample: {sample_id}  |  Size: {file_size / (1024**3):.2f} GB")
    print(f"{'='*70}")

    # Create upload record
    upload_id = create_upload_record(conn, filename, file_size, sample_id)
    print(f"  Upload record created: id={upload_id}")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total = 0
    errors = 0
    start = time.time()
    last_report = start

    copy_sql = f"""
        COPY app.genomic_variants ({", ".join(COPY_COLUMNS)})
        FROM STDIN WITH (FORMAT text, NULL '\\N')
    """

    buf = io.StringIO()
    buf_rows = 0

    def flush_buffer():
        nonlocal buf, buf_rows
        if buf_rows == 0:
            return
        buf.seek(0)
        with conn.cursor() as cur:
            cur.copy_expert(copy_sql, buf)
        conn.commit()
        buf = io.StringIO()
        buf_rows = 0

    with open(filepath, "r") as fh:
        for line in fh:
            line = line.rstrip("\r\n")

            # Skip meta/header lines
            if line.startswith("#"):
                continue

            fields = line.split("\t")
            try:
                row = build_copy_row(fields, sample_id, upload_id, now_str)
                if row:
                    buf.write(row + "\n")
                    buf_rows += 1
                    total += 1
                else:
                    errors += 1
            except Exception:
                errors += 1
                continue

            # Flush batch
            if buf_rows >= BATCH_SIZE:
                flush_buffer()

                # Progress report every 10 seconds
                now = time.time()
                if now - last_report >= 10:
                    elapsed = now - start
                    rate = total / elapsed
                    print(f"  ... {total:>10,} variants  |  {rate:>8,.0f}/sec  |  {elapsed:.0f}s elapsed")
                    last_report = now

    # Final flush
    flush_buffer()

    elapsed = time.time() - start
    rate = total / elapsed if elapsed > 0 else 0

    # Update upload record
    status = "mapped" if errors == 0 else "review"
    update_upload_status(conn, upload_id, total, status)

    print(f"  DONE: {total:,} variants imported in {elapsed:.1f}s ({rate:,.0f}/sec)")
    if errors > 0:
        print(f"  Errors: {errors:,}")

    return total


def main():
    parser = argparse.ArgumentParser(description="Import GIAB VCF files into Parthenon")
    parser.add_argument(
        "--vcf-dir",
        default="vcf/giab_NISTv4.2.1",
        help="Directory containing GIAB VCF files",
    )
    args = parser.parse_args()

    vcf_dir = Path(args.vcf_dir)
    if not vcf_dir.exists():
        print(f"ERROR: Directory not found: {vcf_dir}")
        sys.exit(1)

    vcf_files = sorted(glob.glob(str(vcf_dir / "*.vcf")))
    if not vcf_files:
        print(f"ERROR: No .vcf files found in {vcf_dir}")
        sys.exit(1)

    print(f"GIAB NISTv4.2.1 Bulk VCF Import")
    print(f"Found {len(vcf_files)} VCF files in {vcf_dir}")
    print(f"Target DB: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}")

    conn = connect()
    print("Connected to PostgreSQL")

    # Drop indexes temporarily for faster bulk insert
    print("\nDroping non-PK indexes for faster bulk insert...")
    indexes_to_drop = [
        "app.genomic_variants_source_id_gene_symbol_index",
        "app.genomic_variants_source_id_person_id_index",
        "app.genomic_variants_upload_id_mapping_status_index",
        "app.genomic_variants_clinvar_significance_index",
    ]
    with conn.cursor() as cur:
        for idx in indexes_to_drop:
            cur.execute(f"DROP INDEX IF EXISTS {idx}")
    conn.commit()

    grand_total = 0
    grand_start = time.time()

    try:
        for vcf_path in vcf_files:
            count = import_vcf_file(conn, vcf_path)
            grand_total += count
    except KeyboardInterrupt:
        print("\n\nInterrupted! Rebuilding indexes on imported data...")
    except Exception as e:
        print(f"\nERROR: {e}")
        conn.rollback()
        raise
    finally:
        # Rebuild indexes
        print("\nRebuilding indexes...")
        with conn.cursor() as cur:
            cur.execute(
                "CREATE INDEX IF NOT EXISTS genomic_variants_source_id_gene_symbol_index "
                "ON app.genomic_variants (source_id, gene_symbol)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS genomic_variants_source_id_person_id_index "
                "ON app.genomic_variants (source_id, person_id)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS genomic_variants_upload_id_mapping_status_index "
                "ON app.genomic_variants (upload_id, mapping_status)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS genomic_variants_clinvar_significance_index "
                "ON app.genomic_variants (clinvar_significance)"
            )
        conn.commit()
        print("Indexes rebuilt.")

    grand_elapsed = time.time() - grand_start
    print(f"\n{'='*70}")
    print(f"  COMPLETE: {grand_total:,} total variants across {len(vcf_files)} files")
    print(f"  Total time: {grand_elapsed / 60:.1f} minutes")
    print(f"{'='*70}")

    conn.close()


if __name__ == "__main__":
    main()
