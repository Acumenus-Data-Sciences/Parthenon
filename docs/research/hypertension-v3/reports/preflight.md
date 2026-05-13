# Phase 1 — Preflight & Discovery

**Run:** 2026-05-12, local environment (`beastmode`)
**Operator:** claude-code

---

## Stack health

- Docker Compose: 25/25 services up; all relevant services (`php`, `postgres`, `redis`, `solr`, `r-runtime`, `python-ai`, `horizon`, `node`) healthy.
- Local API health (`http://localhost:8082/api/health`): **200 OK**
  - database=ok · redis=ok · ai=ok · darkstar=ok
  - Solr cores all healthy (vocabulary 7.2M docs, cohorts 5,398, analyses 190).

## Migrations

- 141 applied. **1 pending** (unrelated to v3 study; do NOT apply blindly):
  - `2026_05_11_220000_mark_superseded_finngen_studyagent_migrations`

## Database topology (important correction)

The Docker `postgres` container is Orthanc's DB (DICOM tables only). Parthenon's Laravel `pgsql` connection points to **host PostgreSQL 17** via `~/.pgpass` (user `claude_dev`). Schemas present in host PG17:

```
finngen · gis · hades_scratch · hello_cdm_demo · hello_cdm_demo2 ·
inpatient_ext · irsf · irsf_results · mimiciv · omop · pancreas ·
pancreas_co2_results · pancreas_gwas_results · pancreas_results ·
poseidon_dagster · public · results · sync · synpuf ·
synpuf_co2_results · synpuf_results · synthetic_ehr · vocab
```

Vocab + OMOP load:
- `vocab.concept_ancestor`: 78,649,271 rows
- `vocab.concept` (standard='S'): 2,966,698
- `omop.person`: 1,005,788

## Source binding — correction to plan

The execution plan assumed `source_key='omop'`. **Actual source is `source_key='ACUMENUS'`**, ID 47:

```
id: 47
source_key: ACUMENUS
source_name: OHDSI Acumenus CDM
source_dialect: postgresql
daimons:
  - cdm        → omop
  - results    → results
  - vocabulary → vocab
```

`EXECUTION_PLAN.md` and the run script will use `SOURCE_ID=47` and `SOURCE_KEY=ACUMENUS`.

## Target study state

- **Study:** `app.studies` id=114, slug=`hypertension-study-v3-2`, title="Hypertension Study (V3)", status=`draft`
- **Session:** id=10, source_mode=`protocol_upload`, status=`reviewing`, active_version_id=6
- **Active version:** id=6, version_number=1, status=`draft`, intent_json (800 chars), normalized_spec_json (12.6 KB)
- **Provenance:** uploaded `Hypertension study (v3).docx` (sha256 544c64...) on 2026-04-26T23:03Z. The protocol-import service extracted PICO scaffolding plus initial drafts.

### Existing assets on version 6 (20 total)

| asset_type | status | verification_status | count |
|---|---|---|---|
| `design_critique` | needs_review | verified | 9 |
| `cohort_draft` | needs_review | unverified | 7 |
| `analysis_plan` | needs_review | unverified | 4 |

This means the protocol upload already produced **7 draft cohorts and 4 draft analysis plans**. No `concept_set` drafts exist — §5 (concept sets) needs fresh drafting. §6 (cohorts) and §8 (analysis plans) have existing drafts that should be reviewed/edited rather than recreated from scratch.

## Intent state (version 6)

The protocol-extracted intent has the title and a comparator stub, but PICO fields are mostly empty:

```
study_title: "Hypertension Study (V3)"
research_question: "Imported from protocol upload."  (placeholder)
primary_objective: "Imported from protocol upload."  (placeholder)
pico:
  population: ""              ← needs fill
  intervention: ""            ← needs fill
  comparator: "Patients with timely HTN diagnosis and/or age- and gender-matched non-hypertensive controls (for outcomes comparisons)."
  outcome: ""                 ← needs fill
  time_at_risk: ""            ← needs fill
analysis_family: "characterization"
known_gaps: ["Protocol-derived fields require ratification before downstream materialization."]
```

The deterministic critique service already flagged the missing PICO fields (9 critique assets, three each for population/intervention/outcome).

## Plan adjustments arising from preflight

1. **Source key** → use `ACUMENUS` not `omop` throughout.
2. **Concept-set phase still needed** (§5 unchanged).
3. **Cohort phase becomes edit-then-verify** for the 7 existing drafts (rather than draft-fresh). Inspect them first; reconcile against the protocol's 6 target cohorts (T, C, S1, S2, O1, O2). Some may be duplicates of, gaps in, or supersets of what the protocol calls for.
4. **Analysis-plan phase** has 4 existing drafts to inspect; the protocol calls for 12 analyses (A–L). Likely need to draft 8 additional and reconcile labels.
5. **Intent PICO must be filled** before phenotypes/concept-sets/cohorts can advance through readiness gates.

## Blocker checks

- [x] Stack healthy
- [x] Vocab loaded
- [x] OMOP CDM populated (1M persons)
- [x] Solr vocabulary core warm
- [x] Acumenus source + daimons configured
- [x] Study + session + version exist
- [ ] Auth credential for HTTP API path (pending user direction)
- [ ] Environment choice: local API vs production (pending user direction)

## Recommended next action

Open **Phase 2: Intent (IntentReviewPanel)** to fill in PICO and accept the version, then **Phase 3: Phenotype recommendations** to generate concept-set seeds before drafting the §5 concept sets. The protocol-import critique already flagged the gaps that need closing.

End of preflight.
