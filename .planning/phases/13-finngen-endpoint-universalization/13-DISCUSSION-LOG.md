# Phase 13: FinnGen Endpoint Universalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 13-finngen-endpoint-universalization
**Areas discussed:** Scope framing, Cross-walk strategy, Success threshold, Finland-only UX, Re-import scope

---

## Scope framing (user-initiated pivot)

Original Phase 13 framing from ROADMAP.md: "Finnish OMOP Vocabulary Load" — load ICD-8, Finnish ICD-9, ICDO3, NOMESCO, KELA_REIMB as custom OMOP vocabularies (concept_id ≥ 2B).

**Claude's initial gray areas (asked, not resolved — user redirected):**
- Catalog sourcing (THL direct vs FinnGen bundled vs Athena-first hybrid)
- Cross-walk aggressiveness (pure custom vs best-effort ICD10CM vs SNOMED dual)
- Re-import scope (auto vs staging vs incremental)
- ICD10-FI scope (in-scope vs deferred)

**User's direction (verbatim):** *"We should defer. The purpose of the build is to make the FinnGen tools, more universal and standardized for global researchers. What are your recommendations?"*

**Claude's recommendation (accepted by user):**
Reframe Phase 13 from "custom vocab load" to "universalization via standard-first resolver":
1. No custom vocab registration (no concept_id ≥ 2B rows).
2. Rewrite resolver to prefer OHDSI standard concepts via `concept_relationship` "Maps to".
3. Ship a curated FinnGen-authored `source_to_concept_map` cross-walk for codes without standard parents.
4. Add `coverage_profile` metadata per endpoint (universal / partial / finland_only).
5. Flag Finland-only endpoints in the browser, don't hide them.
6. Defer the full Finnish vocab registration to a new Phase 18.5 (Finnish CDM Enablement), triggered only when a Finnish CDM is attached.
7. Split REQUIREMENTS.md GENOMICS-12 → GENOMICS-12a (this phase) + GENOMICS-12b (deferred).

**User's acceptance (verbatim):** *"I like your suggestions very much. Please proceed."*

---

## Cross-walk strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, FinnGen-authored | Ship a curated `source_to_concept_map` covering ICD-8 → ICD10CM/SNOMED, NOMESCO → SNOMED Procedure, KELA_REIMB → RxNorm class. Sourced from FinnGen's own mapping docs where they exist, filled in with OHDSI Phoebe/Athena. No new vocab rows. | ✓ |
| No cross-walk | Pure resolver upgrade only. Unresolvable Finnish codes drop. Simpler, lower coverage lift. | |
| Hybrid: Athena-only fills | Use OHDSI Phoebe/Athena cross-walks for ICDO3/ICD9 but do not author FinnGen-specific mappings. Zero authoring burden but leaves ICD-8 and KELA_REIMB with no lift. | |

**User's choice:** Yes, FinnGen-authored (recommended option).
**Notes:** Authoring burden is justified by the 3,983 unmapped ICD-8 rows that have no standard parent in OMOP today. Provenance per cross-walk row should be recorded (FinnGen-authored vs Phoebe vs manual).

---

## Success threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Empirical baseline first | Run the upgraded standard-first resolver against all 5,161 endpoints in dry-run mode, report actual coverage percentage, then lock the success criterion. | ✓ |
| Lock at ≥87% upfront | Use 4,500 of 5,161 as the target from the start. Faster kickoff, risks arbitrary pass/fail. | |
| No percentage target | Binary criteria only: UNMAPPED < 100 AND every resolution is standard-concept-only. | |

**User's choice:** Empirical baseline first (recommended option).
**Notes:** Hard invariants stay locked (UNMAPPED < 100; no `vocab.vocabulary` insertions; `coverage_profile` on every endpoint; ≥1 previously-UNMAPPED endpoint generates on PANCREAS). Only the percentage-style target is negotiated after baseline measurement.

---

## Finland-only endpoint UX

| Option | Description | Selected |
|--------|-------------|----------|
| Visible + flagged | All 5,161 endpoints show in the browser. Finland-only ones get a "Requires Finnish CDM" pill; Generate CTA is disabled with tooltip on non-Finnish sources. | ✓ |
| Hidden by default | Catalog filters out Finland-only endpoints unless a Finnish source is registered. | |
| Separate tab | Split browser into "Universal" (default) and "Finland-only" tabs. | |

**User's choice:** Visible + flagged (recommended option).
**Notes:** Preserves discoverability for Phase 18.5 (Finnish CDM Enablement). Pill styling can mirror the existing per-source confidence indicator.

---

## Re-import trigger

| Option | Description | Selected |
|--------|-------------|----------|
| One-shot on phase merge | Phase 13's final task re-runs `finngen:import-endpoints --release=df14 --overwrite` in a single TXN. Rollback snapshot table preserves pre-migration state. | ✓ |
| Staging + diff + manual promote | Write new expressions to `app.finngen_endpoint_staging`, diff report, separate operator-driven promote command. | |
| Lazy on next import | Ship resolver upgrade, leave existing expressions untouched until the next scheduled DF release. | |

**User's choice:** One-shot on phase merge (recommended option).
**Notes:** Rollback snapshot table `app.finngen_endpoint_expressions_pre_phase13` preserves pre-migration expressions for at least one milestone. Old `app.finngen_endpoint_generations` rows remain valid for auditing.

---

## Claude's Discretion

- Cross-walk manifest file layout (per-vocab CSV vs JSON vs inline SQL literals) — planner picks.
- `coverage_profile` storage location (typed column vs JSONB metadata field) — planner picks based on existing schema.
- Rollback snapshot table naming (`...pre_phase13` vs reusable `...snapshots` with `taken_at`) — planner picks.
- R worker update assessment — researcher confirms whether resolver output is transparent to the R worker or needs changes.

## Deferred Ideas

- **Phase 18.5: Finnish CDM Enablement** — Custom Finnish vocab load with concept_id ≥ 2B, runs only when Finnish CDM attached (GENOMICS-12b).
- Auto-translation of Finnish concept_name to English — belongs to Phase 18.5.
- HPO integration as additional cross-walk target — belongs to a future rare-disease phase.
- Phoebe integration for auto-suggesting cross-walk targets — belongs to a tooling phase.
