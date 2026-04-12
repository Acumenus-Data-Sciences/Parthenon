#!/usr/bin/env python3
"""
Backfill TCGA-PAAD WXS somatic variants into the local OMOP genomics extension.

This is pancreatic-corpus-specific and intentionally separate from the app
genomic upload/FoundationOne path. It preserves source provenance in
app.pancreas_tcga_variant_omop_xref and uses pancreas.person/specimen identity
for the local pancreatic corpus.

Run:
  python3 scripts/pancreatic/backfill_tcga_omop_genomics.py --dry-run
  python3 scripts/pancreatic/backfill_tcga_omop_genomics.py
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras

DB_DSN = "host=localhost dbname=parthenon user=claude_dev"
MAF_ROOT = Path("/mnt/md0/pancreatic-corpus/genomics/TCGA-PAAD")
RUN_LABEL = "pancreatic_tcga_wxs_variants_20260411"
GENOMIC_TEST_NAME = "TCGA-PAAD WXS somatic variant calling"
GENOMIC_PROCEDURE_SOURCE = "TCGA-PAAD WXS somatic variant calling"
GENOMIC_PROCEDURE_CONCEPT_ID = 0
PROCEDURE_TYPE_CONCEPT_ID = 32817

SKIP_CLASSIFICATIONS = {
    "Silent",
    "Intron",
    "3'UTR",
    "5'UTR",
    "3'Flank",
    "5'Flank",
    "IGR",
    "RNA",
    "lincRNA",
}


@dataclass(frozen=True)
class VariantRecord:
    source_variant_key: str
    maf_file: str
    participant_barcode: str
    tumor_sample_barcode: str
    matched_norm_sample_barcode: str | None
    gene_symbol: str
    hgnc_id: str
    hgnc_symbol: str
    chromosome: str | None
    start_position: str | None
    end_position: str | None
    ncbi_build: str | None
    variant_classification: str | None
    variant_type: str | None
    reference_allele: str | None
    alternate_allele: str | None
    dbsnp_rs: str | None
    hgvs_c: str | None
    hgvs_p: str | None
    exon_number: str | None
    t_depth: int | None
    t_alt_count: int | None
    consequence: str | None
    transcript_id: str | None


@dataclass(frozen=True)
class PersonContext:
    person_id: int
    specimen_id: int
    specimen_date: str
    visit_occurrence_id: int | None


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if value in {"", ".", "NA", "None"}:
        return None
    return value


def to_int(value: str | None) -> int | None:
    value = clean(value)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def stable_key(parts: list[str | None]) -> str:
    payload = "\t".join(p or "" for p in parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_mafs(limit: int | None = None) -> list[VariantRecord]:
    records: list[VariantRecord] = []
    for maf_path in sorted(MAF_ROOT.rglob("*.maf.gz")):
        with gzip.open(maf_path, "rt", encoding="utf-8", errors="replace") as fh:
            header: list[str] | None = None
            idx: dict[str, int] = {}
            for raw_line in fh:
                if raw_line.startswith("#"):
                    continue
                line = raw_line.rstrip("\n")
                if header is None:
                    header = line.split("\t")
                    idx = {name: i for i, name in enumerate(header)}
                    continue

                fields = line.split("\t")

                def get(name: str) -> str | None:
                    i = idx.get(name)
                    if i is None or i >= len(fields):
                        return None
                    return clean(fields[i])

                mutation_status = get("Mutation_Status")
                if mutation_status and mutation_status != "Somatic":
                    continue

                variant_classification = get("Variant_Classification")
                if variant_classification in SKIP_CLASSIFICATIONS:
                    continue

                tumor_sample = get("Tumor_Sample_Barcode")
                if not tumor_sample or not tumor_sample.startswith("TCGA-"):
                    continue
                participant = tumor_sample[:12]

                gene = get("Hugo_Symbol")
                if not gene:
                    continue

                hgnc_id = get("HGNC_ID") or f"UNMAPPED:{gene}"[:50]
                hgnc_symbol = get("SYMBOL") or gene
                ref = get("Reference_Allele")
                allele1 = get("Tumor_Seq_Allele1")
                allele2 = get("Tumor_Seq_Allele2")
                alt = allele2 if allele2 and allele2 != ref else allele1

                source_key = stable_key([
                    tumor_sample,
                    get("Matched_Norm_Sample_Barcode"),
                    gene,
                    get("Chromosome"),
                    get("Start_Position"),
                    get("End_Position"),
                    ref,
                    alt,
                    get("HGVSc"),
                    get("HGVSp_Short") or get("HGVSp"),
                ])

                records.append(VariantRecord(
                    source_variant_key=source_key,
                    maf_file=str(maf_path.relative_to(MAF_ROOT)),
                    participant_barcode=participant,
                    tumor_sample_barcode=tumor_sample,
                    matched_norm_sample_barcode=get("Matched_Norm_Sample_Barcode"),
                    gene_symbol=gene,
                    hgnc_id=hgnc_id,
                    hgnc_symbol=hgnc_symbol,
                    chromosome=get("Chromosome"),
                    start_position=get("Start_Position"),
                    end_position=get("End_Position"),
                    ncbi_build=get("NCBI_Build"),
                    variant_classification=variant_classification,
                    variant_type=get("Variant_Type"),
                    reference_allele=ref,
                    alternate_allele=alt,
                    dbsnp_rs=get("dbSNP_RS"),
                    hgvs_c=get("HGVSc"),
                    hgvs_p=get("HGVSp_Short") or get("HGVSp"),
                    exon_number=get("Exon_Number"),
                    t_depth=to_int(get("t_depth")),
                    t_alt_count=to_int(get("t_alt_count")),
                    consequence=get("Consequence") or get("One_Consequence"),
                    transcript_id=get("Transcript_ID"),
                ))
                if limit is not None and len(records) >= limit:
                    return records
    return records


def ensure_objects(cur: psycopg2.extensions.cursor) -> None:
    cur.execute("""
        CREATE SEQUENCE IF NOT EXISTS omop.derived_genomic_procedure_occurrence_seq
            START WITH 910000001
            INCREMENT BY 1
            MINVALUE 1
            NO MAXVALUE
            CACHE 1
    """)
    cur.execute("""
        SELECT setval(
            'omop.derived_genomic_procedure_occurrence_seq',
            greatest(910000000::bigint, coalesce((SELECT max(procedure_occurrence_id)::bigint FROM omop.procedure_occurrence), 0)),
            true
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS app.pancreas_tcga_variant_omop_xref (
            source_variant_key text PRIMARY KEY,
            variant_occurrence_id bigint UNIQUE,
            procedure_occurrence_id bigint,
            specimen_id bigint,
            person_id bigint,
            participant_barcode varchar(20),
            tumor_sample_barcode varchar(100),
            maf_file text,
            target_gene1_id varchar(50),
            target_gene1_symbol varchar(255),
            backfill_run_id bigint,
            mapping_status varchar(30) NOT NULL DEFAULT 'planned',
            notes text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now()
        )
    """)


def ensure_run(cur: psycopg2.extensions.cursor) -> int:
    cur.execute("""
        WITH next_run AS (
            SELECT coalesce(max(id), 0) + 1 AS id
            FROM app.omop_extension_backfill_run
        )
        INSERT INTO app.omop_extension_backfill_run (
            id, extension_name, run_label, status, started_at, notes
        )
        SELECT next_run.id, 'genomics', %s, 'running', now(),
               'Backfill TCGA-PAAD WXS non-silent somatic MAF variants into OMOP genomics extension'
        FROM next_run
        WHERE NOT EXISTS (
            SELECT 1 FROM app.omop_extension_backfill_run
            WHERE extension_name = 'genomics' AND run_label = %s
        )
    """, (RUN_LABEL, RUN_LABEL))
    cur.execute("""
        SELECT id FROM app.omop_extension_backfill_run
        WHERE extension_name = 'genomics' AND run_label = %s
        ORDER BY id
        LIMIT 1
    """, (RUN_LABEL,))
    return int(cur.fetchone()[0])


def fetch_context(cur: psycopg2.extensions.cursor) -> dict[str, PersonContext]:
    cur.execute("""
        SELECT
            p.person_source_value,
            p.person_id,
            coalesce(
                min(s.specimen_id) FILTER (WHERE s.specimen_source_id = p.person_source_value || '-biopsy'),
                min(s.specimen_id)
            ) AS specimen_id,
            coalesce(
                min(s.specimen_date) FILTER (WHERE s.specimen_source_id = p.person_source_value || '-biopsy'),
                min(s.specimen_date),
                min(v.visit_start_date)
            )::text AS specimen_date,
            min(v.visit_occurrence_id) AS visit_occurrence_id
        FROM pancreas.person p
        LEFT JOIN pancreas.specimen s ON s.person_id = p.person_id
        LEFT JOIN pancreas.visit_occurrence v ON v.person_id = p.person_id
        WHERE p.care_site_id = 3
        GROUP BY p.person_source_value, p.person_id
    """)
    return {
        row[0]: PersonContext(
            person_id=int(row[1]),
            specimen_id=int(row[2]),
            specimen_date=row[3],
            visit_occurrence_id=int(row[4]) if row[4] is not None else None,
        )
        for row in cur.fetchall()
        if row[2] is not None and row[3] is not None
    }


def seed_gene_map(cur: psycopg2.extensions.cursor, records: list[VariantRecord]) -> None:
    genes = sorted({(r.gene_symbol, r.hgnc_id, r.hgnc_symbol) for r in records})
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO app.omop_gene_symbol_map (gene_symbol, hgnc_id, hgnc_symbol, notes)
        VALUES %s
        ON CONFLICT (gene_symbol) DO UPDATE
        SET hgnc_id = EXCLUDED.hgnc_id,
            hgnc_symbol = EXCLUDED.hgnc_symbol,
            notes = EXCLUDED.notes
        """,
        [(g, h, s, "Parsed from TCGA-PAAD GDC MAF HGNC metadata on 2026-04-11") for g, h, s in genes],
        page_size=1000,
    )


def ensure_genomic_test(cur: psycopg2.extensions.cursor) -> int:
    cur.execute("""
        SELECT genomic_test_id
        FROM omop.genomic_test
        WHERE care_site_id = 3
          AND genomic_test_name = %s
        ORDER BY genomic_test_id
        LIMIT 1
    """, (GENOMIC_TEST_NAME,))
    row = cur.fetchone()
    if row:
        return int(row[0])

    cur.execute("""
        INSERT INTO omop.genomic_test (
            care_site_id,
            genomic_test_name,
            genomic_test_version,
            reference_genome,
            sequencing_device,
            library_preparation,
            target_capture,
            read_type,
            read_length,
            quality_control_tools,
            total_reads,
            mean_target_coverage,
            per_target_base_cover_100x,
            alignment_tools,
            variant_calling_tools,
            chromosome_corrdinate,
            annotation_tools,
            annotation_databases
        )
        VALUES (
            3,
            %s,
            'GDC aliquot ensemble masked MAF',
            'GRCh38',
            NULL,
            'WXS',
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            'GDC aliquot ensemble masked somatic variant calls',
            'GRCh38',
            'GDC MAF / VEP annotations',
            'GDC;HGNC;dbSNP'
        )
        RETURNING genomic_test_id
    """, (GENOMIC_TEST_NAME,))
    return int(cur.fetchone()[0])


def ensure_target_genes(cur: psycopg2.extensions.cursor, genomic_test_id: int, records: list[VariantRecord]) -> None:
    genes = sorted({(r.hgnc_id, r.hgnc_symbol) for r in records})
    psycopg2.extras.execute_values(
        cur,
        """
        WITH incoming(genomic_test_id, hgnc_id, hgnc_symbol) AS (VALUES %s)
        INSERT INTO omop.target_gene (genomic_test_id, hgnc_id, hgnc_symbol)
        SELECT i.genomic_test_id, i.hgnc_id, i.hgnc_symbol
        FROM incoming i
        WHERE NOT EXISTS (
            SELECT 1
            FROM omop.target_gene tg
            WHERE tg.genomic_test_id = i.genomic_test_id
              AND tg.hgnc_id = i.hgnc_id
              AND tg.hgnc_symbol = i.hgnc_symbol
        )
        """,
        [(genomic_test_id, hgnc_id, hgnc_symbol) for hgnc_id, hgnc_symbol in genes],
        template="(%s, %s, %s)",
        page_size=1000,
        fetch=False,
    )


def upsert_xref(cur: psycopg2.extensions.cursor, records: list[VariantRecord], context: dict[str, PersonContext], run_id: int) -> None:
    rows: list[tuple[Any, ...]] = []
    for rec in records:
        ctx = context.get(rec.participant_barcode)
        status = "matched" if ctx else "unmatched_person_or_specimen"
        notes = None if ctx else "No matching pancreas.person/specimen context for TCGA participant"
        rows.append((
            rec.source_variant_key,
            ctx.person_id if ctx else None,
            ctx.specimen_id if ctx else None,
            rec.participant_barcode,
            rec.tumor_sample_barcode,
            rec.maf_file,
            rec.hgnc_id,
            rec.hgnc_symbol,
            run_id,
            status,
            notes,
        ))

    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO app.pancreas_tcga_variant_omop_xref (
            source_variant_key,
            person_id,
            specimen_id,
            participant_barcode,
            tumor_sample_barcode,
            maf_file,
            target_gene1_id,
            target_gene1_symbol,
            backfill_run_id,
            mapping_status,
            notes
        )
        VALUES %s
        ON CONFLICT (source_variant_key) DO UPDATE
        SET person_id = EXCLUDED.person_id,
            specimen_id = EXCLUDED.specimen_id,
            participant_barcode = EXCLUDED.participant_barcode,
            tumor_sample_barcode = EXCLUDED.tumor_sample_barcode,
            maf_file = EXCLUDED.maf_file,
            target_gene1_id = EXCLUDED.target_gene1_id,
            target_gene1_symbol = EXCLUDED.target_gene1_symbol,
            backfill_run_id = EXCLUDED.backfill_run_id,
            mapping_status = CASE
                WHEN app.pancreas_tcga_variant_omop_xref.variant_occurrence_id IS NULL THEN EXCLUDED.mapping_status
                ELSE app.pancreas_tcga_variant_omop_xref.mapping_status
            END,
            notes = EXCLUDED.notes,
            updated_at = now()
        """,
        rows,
        page_size=1000,
    )


def ensure_procedures(cur: psycopg2.extensions.cursor, context: dict[str, PersonContext]) -> None:
    for participant, ctx in sorted(context.items()):
        cur.execute("""
            INSERT INTO omop.procedure_occurrence (
                procedure_occurrence_id,
                person_id,
                procedure_concept_id,
                procedure_date,
                procedure_datetime,
                procedure_type_concept_id,
                modifier_concept_id,
                quantity,
                visit_occurrence_id,
                procedure_source_value,
                procedure_source_concept_id,
                modifier_source_value
            )
            SELECT
                nextval('omop.derived_genomic_procedure_occurrence_seq')::integer,
                %s,
                %s,
                %s::date,
                %s::date::timestamp,
                %s,
                0,
                1,
                %s,
                %s,
                0,
                %s
            WHERE NOT EXISTS (
                SELECT 1
                FROM omop.procedure_occurrence po
                WHERE po.person_id = %s
                  AND po.procedure_source_value = %s
                  AND po.modifier_source_value = %s
            )
        """, (
            ctx.person_id,
            GENOMIC_PROCEDURE_CONCEPT_ID,
            ctx.specimen_date,
            ctx.specimen_date,
            PROCEDURE_TYPE_CONCEPT_ID,
            ctx.visit_occurrence_id,
            GENOMIC_PROCEDURE_SOURCE,
            participant,
            ctx.person_id,
            GENOMIC_PROCEDURE_SOURCE,
            participant,
        ))

    cur.execute("""
        UPDATE app.pancreas_tcga_variant_omop_xref x
        SET procedure_occurrence_id = po.procedure_occurrence_id,
            updated_at = now()
        FROM omop.procedure_occurrence po
        WHERE x.mapping_status = 'matched'
          AND x.procedure_occurrence_id IS NULL
          AND po.person_id = x.person_id
          AND po.procedure_source_value = %s
          AND po.modifier_source_value = x.participant_barcode
    """, (GENOMIC_PROCEDURE_SOURCE,))


def insert_variants(cur: psycopg2.extensions.cursor, records_by_key: dict[str, VariantRecord]) -> int:
    cur.execute("""
        SELECT source_variant_key
        FROM app.pancreas_tcga_variant_omop_xref
        WHERE mapping_status = 'matched'
          AND variant_occurrence_id IS NULL
          AND procedure_occurrence_id IS NOT NULL
          AND specimen_id IS NOT NULL
        ORDER BY source_variant_key
    """)
    keys = [row[0] for row in cur.fetchall()]
    if not keys:
        return 0

    cur.execute("SELECT coalesce(max(variant_occurrence_id), 0) FROM omop.variant_occurrence")
    next_id = int(cur.fetchone()[0]) + 1

    rows: list[tuple[Any, ...]] = []
    id_by_key: dict[str, int] = {}
    for offset, key in enumerate(keys):
        rec = records_by_key[key]
        variant_id = next_id + offset
        id_by_key[key] = variant_id
        rows.append((
            variant_id,
            key,
            rec.reference_allele,
            rec.alternate_allele,
            rec.hgvs_c,
            rec.hgvs_p,
            rec.t_depth,
            rec.exon_number,
            rec.variant_classification,
            rec.consequence,
            "somatic",
        ))

    psycopg2.extras.execute_values(
        cur,
        """
        WITH incoming(
            variant_occurrence_id,
            source_variant_key,
            reference_allele,
            alternate_allele,
            hgvs_c,
            hgvs_p,
            variant_read_depth,
            variant_exon_number,
            sequence_alteration,
            variant_feature,
            genetic_origin
        ) AS (VALUES %s)
        INSERT INTO omop.variant_occurrence (
            variant_occurrence_id,
            procedure_occurrence_id,
            specimen_id,
            reference_specimen_id,
            target_gene1_id,
            target_gene1_symbol,
            target_gene2_id,
            target_gene2_symbol,
            reference_sequence,
            rs_id,
            reference_allele,
            alternate_allele,
            hgvs_c,
            hgvs_p,
            variant_read_depth,
            variant_exon_number,
            copy_number,
            cnv_locus,
            fusion_breakpoint,
            fusion_supporting_reads,
            sequence_alteration,
            variant_feature,
            genetic_origin,
            genotype
        )
        SELECT
            i.variant_occurrence_id,
            x.procedure_occurrence_id,
            x.specimen_id,
            NULL,
            x.target_gene1_id,
            x.target_gene1_symbol,
            NULL,
            NULL,
            NULL,
            NULL,
            i.reference_allele,
            i.alternate_allele,
            i.hgvs_c,
            i.hgvs_p,
            i.variant_read_depth,
            NULLIF(regexp_replace(coalesce(i.variant_exon_number, ''), '[^0-9].*$', ''), '')::integer,
            NULL,
            NULL,
            NULL,
            NULL,
            i.sequence_alteration,
            i.variant_feature,
            i.genetic_origin,
            NULL
        FROM incoming i
        JOIN app.pancreas_tcga_variant_omop_xref x
          ON x.source_variant_key = i.source_variant_key
        """,
        rows,
        page_size=1000,
    )

    psycopg2.extras.execute_values(
        cur,
        """
        UPDATE app.pancreas_tcga_variant_omop_xref x
        SET variant_occurrence_id = v.variant_occurrence_id,
            mapping_status = 'loaded',
            updated_at = now()
        FROM (VALUES %s) AS v(source_variant_key, variant_occurrence_id)
        WHERE x.source_variant_key = v.source_variant_key
          AND x.variant_occurrence_id IS NULL
        """,
        [(key, variant_id) for key, variant_id in id_by_key.items()],
        page_size=1000,
    )
    return len(keys)


def insert_annotations(cur: psycopg2.extensions.cursor, records_by_key: dict[str, VariantRecord]) -> int:
    cur.execute("""
        SELECT count(*)
        FROM omop.variant_annotation va
        JOIN app.pancreas_tcga_variant_omop_xref x
          ON x.variant_occurrence_id = va.variant_occurrence_id
    """)
    before_count = int(cur.fetchone()[0])

    cur.execute("""
        SELECT source_variant_key, variant_occurrence_id
        FROM app.pancreas_tcga_variant_omop_xref
        WHERE variant_occurrence_id IS NOT NULL
        ORDER BY source_variant_key
    """)
    variant_rows = [(row[0], int(row[1])) for row in cur.fetchall()]

    cur.execute("SELECT coalesce(max(variant_annotation_id), 0) FROM omop.variant_annotation")
    next_id = int(cur.fetchone()[0]) + 1

    annotation_rows: list[tuple[Any, ...]] = []
    fields = [
        "source_variant_key",
        "maf_file",
        "participant_barcode",
        "tumor_sample_barcode",
        "matched_norm_sample_barcode",
        "ncbi_build",
        "chromosome",
        "start_position",
        "end_position",
        "variant_classification",
        "variant_type",
        "consequence",
        "transcript_id",
        "dbsnp_rs",
        "t_alt_count",
    ]
    annotation_id = next_id
    for key, variant_occurrence_id in variant_rows:
        rec = records_by_key.get(key)
        if rec is None:
            continue
        values = {
            "source_variant_key": rec.source_variant_key,
            "maf_file": rec.maf_file,
            "participant_barcode": rec.participant_barcode,
            "tumor_sample_barcode": rec.tumor_sample_barcode,
            "matched_norm_sample_barcode": rec.matched_norm_sample_barcode,
            "ncbi_build": rec.ncbi_build,
            "chromosome": rec.chromosome,
            "start_position": rec.start_position,
            "end_position": rec.end_position,
            "variant_classification": rec.variant_classification,
            "variant_type": rec.variant_type,
            "consequence": rec.consequence,
            "transcript_id": rec.transcript_id,
            "dbsnp_rs": rec.dbsnp_rs,
            "t_alt_count": rec.t_alt_count,
        }
        for field in fields:
            value = values[field]
            if value is None:
                continue
            annotation_rows.append((
                annotation_id,
                variant_occurrence_id,
                field,
                str(value) if not isinstance(value, int) else None,
                float(value) if isinstance(value, int) else None,
            ))
            annotation_id += 1

    if not annotation_rows:
        return 0

    psycopg2.extras.execute_values(
        cur,
        """
        WITH incoming(
            variant_annotation_id,
            variant_occurrence_id,
            anntation_field,
            value_as_string,
            value_as_number
        ) AS (VALUES %s)
        INSERT INTO omop.variant_annotation (
            variant_annotation_id,
            variant_occurrence_id,
            anntation_field,
            value_as_string,
            value_as_number
        )
        SELECT
            i.variant_annotation_id,
            i.variant_occurrence_id,
            i.anntation_field,
            i.value_as_string,
            i.value_as_number
        FROM incoming i
        WHERE NOT EXISTS (
            SELECT 1
            FROM omop.variant_annotation va
            WHERE va.variant_occurrence_id = i.variant_occurrence_id
              AND va.anntation_field = i.anntation_field
        )
        """,
        annotation_rows,
        page_size=1000,
    )
    cur.execute("""
        SELECT count(*)
        FROM omop.variant_annotation va
        JOIN app.pancreas_tcga_variant_omop_xref x
          ON x.variant_occurrence_id = va.variant_occurrence_id
    """)
    after_count = int(cur.fetchone()[0])
    return after_count - before_count


def print_summary(cur: psycopg2.extensions.cursor) -> None:
    cur.execute("""
        SELECT mapping_status, count(*)
        FROM app.pancreas_tcga_variant_omop_xref
        GROUP BY mapping_status
        ORDER BY mapping_status
    """)
    print("xref status:")
    for status, count in cur.fetchall():
        print(f"  {status}: {count}")

    cur.execute("""
        SELECT count(*) FROM omop.variant_occurrence vo
        JOIN app.pancreas_tcga_variant_omop_xref x
          ON x.variant_occurrence_id = vo.variant_occurrence_id
    """)
    print(f"pancreatic TCGA variant_occurrence rows: {cur.fetchone()[0]}")

    cur.execute("""
        SELECT count(*) FROM omop.variant_annotation va
        JOIN app.pancreas_tcga_variant_omop_xref x
          ON x.variant_occurrence_id = va.variant_occurrence_id
    """)
    print(f"pancreatic TCGA variant_annotation rows: {cur.fetchone()[0]}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Parse and summarize only; do not write to PostgreSQL.")
    parser.add_argument("--limit", type=int, default=None, help="Only parse this many variants.")
    args = parser.parse_args()

    print("Parsing TCGA-PAAD MAF files...")
    records = parse_mafs(limit=args.limit)
    records_by_key = {r.source_variant_key: r for r in records}
    print(f"  parsed variants: {len(records):,}")
    print(f"  unique source keys: {len(records_by_key):,}")
    print(f"  participants: {len({r.participant_barcode for r in records}):,}")
    print(f"  genes: {len({r.gene_symbol for r in records}):,}")

    if args.dry_run:
        return

    with psycopg2.connect(DB_DSN) as conn:
        with conn.cursor() as cur:
            ensure_objects(cur)
            run_id = ensure_run(cur)
            context = fetch_context(cur)
            print(f"  matched participant contexts: {len(context):,}")
            seed_gene_map(cur, records)
            genomic_test_id = ensure_genomic_test(cur)
            ensure_target_genes(cur, genomic_test_id, records)
            upsert_xref(cur, records, context, run_id)
            ensure_procedures(cur, context)
            inserted_variants = insert_variants(cur, records_by_key)
            inserted_annotations = insert_annotations(cur, records_by_key)
            cur.execute("""
                UPDATE app.omop_extension_backfill_run
                SET status = 'completed',
                    finished_at = now(),
                    notes = notes || '; variants inserted this run=' || %s || '; annotation candidates this run=' || %s
                WHERE id = %s
            """, (inserted_variants, inserted_annotations, run_id))
            print(f"  inserted variant_occurrence rows this run: {inserted_variants:,}")
            print(f"  annotation candidates processed this run: {inserted_annotations:,}")
            print_summary(cur)


if __name__ == "__main__":
    main()
