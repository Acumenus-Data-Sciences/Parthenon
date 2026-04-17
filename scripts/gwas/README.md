# scripts/gwas — GWAS fixture and helper scripts

## Purpose

Tooling that unblocks Phase 14 smoke testing when real PANCREAS VCFs are not
available (RESEARCH.md Open Question Q1). The Phase 14 GWAS pipeline expects a
PGEN/PVAR/PSAM triple per source (`/opt/finngen-artifacts/variants/<source>/`);
for real sources these come from the source's VCFs, but for smoke testing we
synthesize a deterministic fixture against PANCREAS (D-05 — 361 subjects is a
tractable fixture size).

## Scripts

### `generate_synthetic_pancreas_pgen.py`

Emits a deterministic synthetic PGEN fixture (10,000 SNPs × 361 subjects)
matching the real `pancreas.person` roster. Uses PLINK2 under the hood for
VCF→PGEN conversion.

Invocation:

```bash
python3 scripts/gwas/generate_synthetic_pancreas_pgen.py \
    --seed 42 \
    --variants 10000 \
    --out-dir /opt/finngen-artifacts/variants/pancreas \
    --plink2 /opt/plink2/plink2
```

Flags:

* `--seed INT` (default 42) — numpy RNG seed. Byte-identical PGEN for the
  same seed + variant count + subject roster.
* `--variants INT` (default 10000) — total SNP count; distributed across
  chromosomes 1–22 with per-chrom position sorting and MAF ~ Beta(2,10)
  clamped to [0.05, 0.5].
* `--out-dir PATH` — where to write `genotypes.{pgen,pvar,psam,vcf.gz}`.
* `--plink2 PATH` — path to the plink2 binary. Required for non-dry-run mode;
  default `/opt/plink2/plink2` matches the Darkstar consumption path once
  Phase 14 Wave 4 lands the `COPY --from=parthenon-regenie` layer.
* `--dry-run` — validate inputs, generate variants in memory, print a JSON
  plan, and exit 0 without touching the DB or filesystem.

### Reproducibility contract

* Same `--seed` + same `--variants` + same pancreas.person roster → same
  PGEN SHA-256 on every invocation. The final JSON summary printed to stdout
  includes `sha256_of_pgen`; Phase 14 Wave 6 smoke test compares this value
  between runs to detect drift.
* Subject roster is queried live (`SELECT person_id FROM pancreas.person
  ORDER BY person_id`) — if PANCREAS changes, expect a new SHA-256. The
  script hard-asserts 361 subjects per D-05; any other count aborts.

### Expected runtime

~30s for 10k variants × 361 subjects (variant generation ~1s, VCF emit ~5s,
plink2 --make-pgen ~10s, post-checks ~1s). CI-friendly.

### Known limitations

* Single-ancestry synthetic; no linkage disequilibrium structure. Good for
  smoke testing GWAS infrastructure plumbing (step-1/step-2, cache keys,
  dispatch, schema provisioning). **NOT suitable** for LD-sensitive analyses
  (fine-mapping, imputation benchmarking).
* Binomial(2, MAF) genotype sampling assumes Hardy-Weinberg equilibrium at
  every site — a smoke-test idealization.

## Security posture

* Read-only against `pancreas.person` (HIGHSEC §3.2 — CDM schema is read-only).
* Uses claude_dev role on host PG17 via `~/.pgpass` (global CLAUDE.md DB
  Operation Safety #1 RULE — never Docker PG).
* Writes only to `--out-dir`; no other filesystem mutation.
* Exits non-zero with a clear error on: missing plink2 binary, wrong
  pancreas.person row count, unwritable output directory, or plink2 failure.
