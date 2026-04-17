# ADR-001: Phase 13 STCM target schema = vocab.source_to_concept_map

**Status:** Accepted (2026-04-18)
**Phase:** 13 — FinnGen Endpoint Universalization
**Decides:** RESEARCH.md §Common Pitfalls 1 + §Open Questions 1
**Locks:** D-01, D-04, C-13, C-14, C-15

## Context

Two physically distinct STCM tables exist in the live `parthenon` database (verified 2026-04-17 via psql -h localhost -U claude_dev):
- `vocab.source_to_concept_map` — 121 rows, all `source_vocabulary_id = 'IRSF-NHS'` (IRSF Phase 6 seed)
- `omop.source_to_concept_map` — 0 rows (created by migration 2026_03_01_150009 via Schema::connection('omop'); never populated)

Both share an identical column shape. The original IRSF migration `2026_03_01_150009_create_vocab_source_to_concept_maps_table.php` filename mentions "vocab" but the migration body uses `Schema::connection('omop')->create('source_to_concept_map', ...)`. Live state shows IRSF rows landed in `vocab.source_to_concept_map` despite the migration text — this is because all CDM connections include `vocab` first in `search_path`, so an unqualified `source_to_concept_map` insert from the IRSF Python loader reached the `vocab` schema.

CONTEXT D-01 and ROADMAP Phase 13 success criteria explicitly say `vocab.source_to_concept_map`. Live state already aligns.

## Decision

1. Phase 13 writes ALL FinnGen cross-walk rows to `vocab.source_to_concept_map` (the schema-qualified table that already has 121 IRSF rows).
2. The Phase 13 seed migration MUST issue `INSERT INTO vocab.source_to_concept_map ...` with the schema literal — never bare `source_to_concept_map`.
3. The resolver's STCM lookup MUST query `vocab.source_to_concept_map` with the schema literal (`FROM vocab.source_to_concept_map`).
4. IRSF's existing 121 rows in `vocab.source_to_concept_map` STAY in place — the FinnGen seed deletes only rows where `source_vocabulary_id IN ('ICD8', 'ICDO3', 'NOMESCO', 'KELA_REIMB', 'ICD10_FIN', 'ICD9_FIN')`. IRSF-NHS rows are out of scope.
5. The empty `omop.source_to_concept_map` table is left untouched. Future cleanup phase may consolidate.
6. HIGHSEC §4.1 grants: the seed migration MUST emit a `DO $grants$ ... END $grants$` block guarded by `pg_roles` existence check, granting `SELECT` to `parthenon_app` on `vocab.source_to_concept_map`.

## Consequences

- Resolver SQL is unambiguous: `FROM vocab.source_to_concept_map`. No schema-search-path surprises.
- Seed migration deletes are scoped to the 6 FinnGen-owned vocabularies; IRSF rows are protected.
- Future Phase 18.5 (Finnish CDM Enablement) inherits the same target.

## References

- RESEARCH.md §Common Pitfalls 1
- RESEARCH.md §Open Questions 1
- CONTEXT.md D-01, D-04
- HIGHSEC.spec.md §4.1
- Live DB verified 2026-04-17
