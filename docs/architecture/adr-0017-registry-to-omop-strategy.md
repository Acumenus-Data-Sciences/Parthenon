# ADR 0017 — `registry_to_omop` strategy: extend OHDSI's NAACCR ETL

**Status:** Accepted (2026-05-06)
**Deciders:** Phase 3 spec Q7.
**Implements:** Phase 3 Plan 4A (T-022A); referenced by Plans 4B (STS) + 4C (NCDR).

## Context

The Parthenon `registry_to_omop` template (T-022) ingests three
clinical registries:

- **NAACCR** — North American Association of Central Cancer Registries.
  700+ data items per patient-tumor record. The OHDSI Oncology subgroup
  has maintained an end-to-end NAACCR ETL at
  `https://github.com/OHDSI/CdmEtlNaaccr` (Apache-2.0) since 2019.
- **STS** — Society of Thoracic Surgeons National Database (Plan 4B).
- **NCDR** — National Cardiovascular Data Registry (Plan 4C).

For NAACCR specifically, **re-implementing 700+ items from scratch is
multi-month work** that buys us nothing — OHDSI's ETL has been validated
on real registry data and tracks the annual NAACCR Layout updates.

Phase 3 spec Q7 chose option (a): **extend** the OHDSI ETL rather than
fork it. This ADR records the extension shape.

## Decision

**Port OHDSI/CdmEtlNaaccr's per-domain SQL into Parthenon's
`sql_file://` stages**, pinned to a specific upstream commit SHA. The
ported SQL is re-targeted from SQL Server syntax (the upstream
default) to PostgreSQL.

What we ported:

- `inst/sql/sql_server/condition_occurrence.sql` →
  `templates/commercial/manifests/registry_to_omop_naaccr/sql/02a_map_condition_occurrence.sql`
- `inst/sql/sql_server/episode.sql` →
  `02b_map_episode.sql`
- `inst/sql/sql_server/episode_event.sql` →
  `02c_map_episode_event.sql`

What we did NOT port:

- The CDMBuilder runtime (Java) — Parthenon's runner replaces it.
- The full 700+ item Layout. v0.1 ships a curated 80-column subset
  via `NAACCRRecord` (Plan 4A Task 2). Phase 4 extends to the full
  dictionary if commercial customers need richer projection.
- SQL Server-specific syntax (TOP, FOR JSON, etc.). The joins and
  per-item logic are preserved; only the dialect is changed.

**Pinning + drift tracking:**

- The upstream commit SHA is recorded in
  `templates/commercial/runtime/commercial/registry/naaccr/ohdsi_pin.txt`.
- The `.github/workflows/ohdsi-naaccr-diff.yml` workflow runs weekly,
  fetches HEAD from the upstream repo, and opens a `vocab-drift` /
  `phase-3` / `commercial` issue if the diff exceeds 50 lines.
- This mirrors the ARTEMIS upstream-diff pattern from Phase 2 ADR 0014.
- The diff workflow is informational — humans triage, re-port if
  needed, and bump the pinned SHA.

**Person identity convention:** v0.1 hashes `patient_id_number` via
`abs(hashtext(...))` for `person_id` allocation. This matches the
NCPDP and claims pipelines. Proper Master Person Index integration
is Phase 4 follow-up.

**HIGHSEC §7 in episode_source_value:** the value is assembled from
canonical ICD-O-3 codes only (`primary_site || '/' || histology`),
never from patient identifiers. The convention is enforced by a
manifest test that greps the SQL for the assembly shape.

## Consequences

- **Correctness for free.** OHDSI's ETL is the canonical reference
  for NAACCR → OMOP projection. We inherit their validated joins.
- **Annual NAACCR releases require explicit work.** When NAACCR
  publishes a new Layout (typically once per year), upstream OHDSI
  refreshes their SQL; the diff workflow will catch it; we re-port,
  bump the pin, and re-run the validation E2E.
- **No CDMBuilder dependency.** Parthenon's `sql_node` runner +
  `sql_file://` reader (Plan 0) replace OHDSI's Java runtime; the
  commercial wheel ships pure-Python.
- **The pattern generalizes.** Plans 4B (STS) and 4C (NCDR) reuse
  the `_partials/registry_base.yaml` shape but ship their own
  column-mapping tables — no upstream OHDSI ETL exists for those
  registries (per the spec); we own correctness end-to-end there.

## Alternatives considered

- **Fork OHDSI's ETL into Parthenon's repo.** Rejected — multi-month
  re-implementation cost; loses OHDSI's annual update cycle.
- **Customer-supplied SQL via a manifest hook.** Rejected — pushes
  ETL maintenance onto every customer; the value of the commercial
  template is "it works out of the box".
- **Use OHDSI's CDMBuilder runtime directly via subprocess.**
  Rejected — Java dep balloons the wheel size + complicates
  packaging; we already have a sql_node runtime that does the job.
- **Skip NAACCR entirely; punt registry to Phase 4.** Rejected —
  cancer registries are a major commercial-customer ask; T-022 needs
  to ship in Phase 3 to justify the price premium per Workstream 4.

## Open follow-ups

1. **Full NAACCR Layout (700+ items).** v0.1 ships a curated 80-item
   subset. Phase 4 extends if commercial customers need richer
   projection (site-specific factors, full address fields, etc.).
2. **Multi-tumor-per-patient handling.** v0.1 assumes one tumor per
   patient (the fixture matches). Real registries have multi-primary
   patients; the v0.1 SQL handles them via the
   `(patient_id_number, tumor_record_number)` UNIQUE constraint, but
   the EPISODE projection treats each tumor as independent. Phase 4
   may need a "MultiPrimaryRule" annotation per OMOP Oncology spec.
3. **In-situ + benign behavior projection.** v0.1 filters to
   behavior 3 + 6 (malignant primary + metastatic). Behavior 0/1/2
   (benign / uncertain / in-situ) routes to OBSERVATION in OMOP; not
   in v0.1 scope.
4. **Annual upstream-diff cadence verification.** Run the workflow
   manually after the ADR lands to confirm the diff comparison API
   works against a known-good SHA. Tracked in PR #287's CI.

## References

- OMOP CDM v5.4 §EPISODE / §EPISODE_EVENT / §CONDITION_OCCURRENCE
- OMOP Oncology Extension working group
- OHDSI/CdmEtlNaaccr (Apache-2.0) — pinned at the SHA in `ohdsi_pin.txt`
- NAACCR Data Dictionary v23
- Phase 3 Plan 4A —
  `docs/superpowers/plans/2026-05-06-parthenon-ingestion-templates-phase-3-plan-4a-naaccr.md`
- Phase 2 ADR 0014 (ARTEMIS upstream-diff pattern, source for the
  weekly cron + issue-open mechanism)
- ADR 0015 (`sql_file://` reader)
- ADR 0016 (claims_to_omop COST projection — sister T-021)
