#!/usr/bin/env python3
"""
Generate a synthetic PANCREAS PGEN fixture for GWAS smoke testing.

Produces a deterministic (seed-pinned) PGEN / PVAR / PSAM triple that matches
the real pancreas.person roster (361 subjects) with 10,000 synthetic SNPs
under Hardy-Weinberg equilibrium. Intended for Phase 14 Wave 6 smoke testing
when real PANCREAS VCFs are unavailable (RESEARCH Open Question Q1).

Key properties
--------------
* Deterministic: same --seed always produces byte-identical PGEN.
* Subjects: queries `SELECT person_id FROM pancreas.person ORDER BY person_id`
  (expects exactly 361 rows per RESEARCH.md verification; D-05).
* FID = IID = "person_{person_id}" — matches RESEARCH Pitfall 3 solution for
  .psam sample-ID conventions.
* Variants: 10,000 SNPs distributed across chromosomes 1–22, MAF ~ Beta(2, 10)
  clamped to [0.05, 0.5], REF/ALT drawn with 2:1 ti/tv bias.

Limitations
-----------
* Single-ancestry synthetic: no linkage disequilibrium structure.
* Genotypes sampled under strict HWE per-site: not suitable for LD-sensitive
  analyses (e.g. fine-mapping, genotype imputation benchmarking).
* Good for: smoke testing regenie step-1/step-2, prepare-source-variants,
  PLINK2 VCF→PGEN conversion, and cache-key plumbing.

Security
--------
* Read-only against pancreas.person (HIGHSEC §3.2 — CDM schema is read-only).
* Connects via claude_dev role against host PG17 (global CLAUDE.md: DB
  Operation Safety #1 RULE — never Docker PG).
* Writes only to the configurable --out-dir; no other filesystem mutation.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable, List, Tuple

try:
    import numpy as np
except ImportError:  # pragma: no cover
    print(
        "[gen-synthetic-pgen] FATAL: numpy is required. "
        "Install via: pip install --break-system-packages numpy psycopg2-binary",
        file=sys.stderr,
    )
    sys.exit(3)


# Subjects are queried from pancreas.person; this is the expected row count
# per RESEARCH.md (D-05 PANCREAS is the fixture source, 361 patients).
EXPECTED_PANCREAS_SUBJECTS = 361

ACGT = ("A", "C", "G", "T")
# Transitions: A<->G, C<->T. All other pairs are transversions.
TRANSITION_MAP = {"A": "G", "G": "A", "C": "T", "T": "C"}


def parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate a synthetic PANCREAS PGEN fixture for Phase 14 smoke testing.",
    )
    p.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Deterministic seed for numpy RNG. Same seed -> byte-identical PGEN.",
    )
    p.add_argument(
        "--variants",
        type=int,
        default=10_000,
        help="Number of SNPs to generate (distributed across chr1..chr22).",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=Path("/opt/finngen-artifacts/variants/pancreas"),
        help="Output directory. Will receive genotypes.pgen, .pvar, .psam.",
    )
    p.add_argument(
        "--plink2",
        type=Path,
        default=Path("/opt/plink2/plink2"),
        help="Path to the plink2 binary (required for --make-pgen).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate inputs + generate variants in memory only; no files written.",
    )
    return p.parse_args(argv)


def validate_inputs(args: argparse.Namespace) -> None:
    if args.seed < 0:
        raise SystemExit(f"[gen-synthetic-pgen] --seed must be >= 0 (got {args.seed})")
    if args.variants <= 0:
        raise SystemExit(f"[gen-synthetic-pgen] --variants must be > 0 (got {args.variants})")
    if not args.dry_run:
        if not args.plink2.exists():
            raise SystemExit(
                f"[gen-synthetic-pgen] plink2 binary not found at {args.plink2}. "
                "Hint: run inside Darkstar once Phase 14 Wave 4 lands the binary, "
                "or override via --plink2."
            )
        out_parent = args.out_dir.parent
        if not out_parent.exists():
            raise SystemExit(
                f"[gen-synthetic-pgen] --out-dir parent does not exist: {out_parent}"
            )
        if not os.access(out_parent, os.W_OK):
            raise SystemExit(
                f"[gen-synthetic-pgen] --out-dir parent is not writable: {out_parent}"
            )


def fetch_pancreas_person_ids() -> List[int]:
    """Return person_id values for every row in pancreas.person, ordered.

    Uses the claude_dev role on host PG17 via the UNIX socket first, then
    falls back to TCP localhost:5432. Hard-asserts the row count matches
    EXPECTED_PANCREAS_SUBJECTS — the smoke test relies on real person_ids
    landing in the .psam so prepare-source-variants can match them back.
    """

    try:
        import psycopg2  # type: ignore
    except ImportError:  # pragma: no cover
        raise SystemExit(
            "[gen-synthetic-pgen] psycopg2 not installed. "
            "Install via: pip install --break-system-packages psycopg2-binary"
        )

    dsns = [
        "host=/var/run/postgresql dbname=parthenon user=claude_dev options=-csearch_path=pancreas,public",
        "host=localhost port=5432 dbname=parthenon user=claude_dev options=-csearch_path=pancreas,public",
    ]

    last_error: Exception | None = None
    for dsn in dsns:
        sanitized = dsn.replace("user=claude_dev", "user=<redacted>")
        try:
            print(f"[gen-synthetic-pgen] connecting: {sanitized}", file=sys.stderr)
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT person_id FROM pancreas.person ORDER BY person_id"
                    )
                    rows = [int(r[0]) for r in cur.fetchall()]
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(
                f"[gen-synthetic-pgen] connection attempt failed: {type(exc).__name__}: {exc}",
                file=sys.stderr,
            )
    else:  # pragma: no cover
        raise SystemExit(
            f"[gen-synthetic-pgen] unable to connect to any configured DSN; last error: {last_error}"
        )

    if len(rows) != EXPECTED_PANCREAS_SUBJECTS:
        raise SystemExit(
            f"[gen-synthetic-pgen] pancreas.person returned {len(rows)} rows; "
            f"expected {EXPECTED_PANCREAS_SUBJECTS}. D-05 locked PANCREAS as the "
            "Phase 14 fixture source; not falling back to a fake subject list."
        )
    return rows


def generate_variants(
    rng: np.random.Generator, n_variants: int
) -> List[Tuple[int, int, str, str, str, float]]:
    """Return list of (chrom, pos, snp_id, ref, alt, maf).

    Positions are monotonic within each chromosome, spaced ~250kb apart on
    average and clamped to [10_000_000, 250_000_000].
    """

    n_chrom = 22
    per_chrom = max(1, n_variants // n_chrom)
    # Distribute remainder across the first (n_variants % n_chrom) chromosomes.
    remainder = n_variants - per_chrom * n_chrom

    mafs = rng.beta(a=2.0, b=10.0, size=n_variants)
    mafs = np.clip(mafs, 0.05, 0.5)

    # REF bases uniform over ACGT.
    ref_idx = rng.integers(0, 4, size=n_variants)
    # For ALT, draw transitions twice as often as transversions (ti/tv=2).
    # Decide per-site whether it is a transition (p=2/3) or transversion (p=1/3).
    is_transition = rng.random(size=n_variants) < 2.0 / 3.0

    variants: List[Tuple[int, int, str, str, str, float]] = []
    variant_cursor = 0
    for chrom in range(1, n_chrom + 1):
        n_here = per_chrom + (1 if chrom <= remainder else 0)
        # Sorted positions, clamped to a realistic autosome range.
        raw = rng.integers(10_000_000, 250_000_000, size=n_here)
        positions = sorted(set(raw.tolist()))
        # Pad back to n_here if dedup removed any (rare at 10k/22).
        while len(positions) < n_here:
            extra = int(rng.integers(10_000_000, 250_000_000))
            if extra not in positions:
                positions.append(extra)
        positions = sorted(positions)

        for k in range(n_here):
            pos = positions[k]
            ref = ACGT[ref_idx[variant_cursor]]
            if is_transition[variant_cursor]:
                alt = TRANSITION_MAP[ref]
            else:
                choices = [b for b in ACGT if b != ref and b != TRANSITION_MAP[ref]]
                alt = choices[int(rng.integers(0, len(choices)))]
            snp_id = f"rs_synth_{chrom}_{pos}"
            variants.append((chrom, pos, snp_id, ref, alt, float(mafs[variant_cursor])))
            variant_cursor += 1

    return variants


def emit_vcf_gz(
    path: Path,
    subjects: List[int],
    variants: List[Tuple[int, int, str, str, str, float]],
    rng: np.random.Generator,
) -> None:
    """Write a minimal VCFv4.2 to path (gzipped). Each subject genotype is
    Binomial(2, MAF) per site (Hardy-Weinberg equilibrium).
    """

    sample_names = [str(pid) for pid in subjects]
    header = (
        "##fileformat=VCFv4.2\n"
        "##source=generate_synthetic_pancreas_pgen.py\n"
        "##FORMAT=<ID=GT,Number=1,Type=String,Description=\"Genotype\">\n"
    )
    for chrom in range(1, 23):
        header += f"##contig=<ID={chrom}>\n"
    columns = ["#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO", "FORMAT"]
    columns.extend(sample_names)
    header += "\t".join(columns) + "\n"

    n_subjects = len(subjects)
    with gzip.open(path, "wt") as gz:
        gz.write(header)
        for (chrom, pos, snp_id, ref, alt, maf) in variants:
            dosages = rng.binomial(2, maf, size=n_subjects)
            gt_fields = [
                "0/0" if d == 0 else ("0/1" if d == 1 else "1/1") for d in dosages
            ]
            row = [
                str(chrom),
                str(pos),
                snp_id,
                ref,
                alt,
                ".",
                "PASS",
                ".",
                "GT",
            ]
            row.extend(gt_fields)
            gz.write("\t".join(row) + "\n")


def write_sample_map(path: Path, subjects: List[int]) -> None:
    """Map VCF sample name -> FID / IID = person_{person_id}.

    plink2 --update-ids syntax: OLD_FID OLD_IID NEW_FID NEW_IID.
    When loading a VCF, plink2 assigns OLD_FID="0" (literal zero) and
    OLD_IID=<vcf-sample-name>; the integer is NOT used as FID. The
    update-ids file therefore pairs OLD_FID="0" with OLD_IID=<integer>
    to match the loaded sample identity. Fix post-Wave-1 (the earlier
    version paired OLD_FID=<integer> and saw "0 samples updated" from
    plink2 alpha 6.33).
    """

    with path.open("w") as fh:
        for pid in subjects:
            old_iid = str(pid)
            new = f"person_{pid}"
            fh.write(f"0\t{old_iid}\t{new}\t{new}\n")


def run_plink2_make_pgen(
    plink2_bin: Path,
    vcf_path: Path,
    sample_map: Path,
    out_prefix: Path,
) -> None:
    cmd = [
        str(plink2_bin),
        "--vcf",
        str(vcf_path),
        "--make-pgen",
        "--update-ids",
        str(sample_map),
        "--out",
        str(out_prefix),
    ]
    print(f"[gen-synthetic-pgen] exec: {' '.join(cmd)}", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(
            f"[gen-synthetic-pgen] plink2 --make-pgen exit={result.returncode}"
        )


def assert_outputs_valid(out_prefix: Path, subjects: List[int]) -> None:
    for ext in (".pgen", ".pvar", ".psam"):
        p = out_prefix.with_suffix(ext)
        if not p.exists():
            raise SystemExit(f"[gen-synthetic-pgen] expected output missing: {p}")

    psam = out_prefix.with_suffix(".psam")
    # PSAM files may start with "#FID\tIID..." or "#IID..." depending on
    # the plink2 build. Count rows excluding lines starting with "#".
    data_lines = [
        line
        for line in psam.read_text().splitlines()
        if line and not line.startswith("#")
    ]
    if len(data_lines) != len(subjects):
        raise SystemExit(
            f"[gen-synthetic-pgen] .psam row count {len(data_lines)} != "
            f"expected {len(subjects)} subjects"
        )

    valid_fids = {f"person_{pid}" for pid in subjects}
    for line in data_lines:
        first = line.split("\t", 1)[0]
        if first not in valid_fids:
            raise SystemExit(
                f"[gen-synthetic-pgen] unexpected FID in .psam: {first!r} "
                "(expected person_{int})"
            )


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dry_run_plan(args: argparse.Namespace, variants_sample: Iterable) -> None:
    plan = {
        "dry_run": True,
        "seed": args.seed,
        "variants": args.variants,
        "out_dir": str(args.out_dir),
        "plink2": str(args.plink2),
        "expected_subjects": EXPECTED_PANCREAS_SUBJECTS,
        "variant_sample_count": sum(1 for _ in variants_sample),
    }
    print(json.dumps(plan, indent=2))


def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv)
    validate_inputs(args)

    rng = np.random.default_rng(args.seed)
    variants = generate_variants(rng, args.variants)

    if args.dry_run:
        # Do not hit the DB or touch the filesystem in dry-run mode.
        dry_run_plan(args, variants)
        return 0

    subjects = fetch_pancreas_person_ids()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    # Re-seed the RNG so the genotype sampling stream is independent of
    # the variant-positions sampling stream. Same seed ultimately drives both.
    gt_rng = np.random.default_rng(args.seed + 1)

    with tempfile.TemporaryDirectory(prefix="synth_pgen_") as tmp:
        tmp_path = Path(tmp)
        vcf_path = tmp_path / "genotypes.vcf.gz"
        sample_map = tmp_path / "sample_map.tsv"
        emit_vcf_gz(vcf_path, subjects, variants, gt_rng)
        write_sample_map(sample_map, subjects)

        out_prefix = args.out_dir / "genotypes"
        run_plink2_make_pgen(args.plink2, vcf_path, sample_map, out_prefix)
        assert_outputs_valid(out_prefix, subjects)

        # Also copy the source VCF alongside the PGEN, for debugging and for
        # the Wave 6 smoke test that wants to re-derive the PGEN.
        shutil.copy2(vcf_path, args.out_dir / "genotypes.vcf.gz")

    pgen_path = args.out_dir / "genotypes.pgen"
    summary = {
        "dry_run": False,
        "variants": len(variants),
        "subjects": len(subjects),
        "out_dir": str(args.out_dir),
        "seed": args.seed,
        "sha256_of_pgen": sha256_of_file(pgen_path),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
