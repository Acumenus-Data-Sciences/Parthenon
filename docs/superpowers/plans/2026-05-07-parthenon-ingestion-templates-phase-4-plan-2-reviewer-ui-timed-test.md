# Parthenon Ingestion Templates — Phase 4, Plan 2: Reviewer-UI seed harness + timed user test

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

> **GATE — qualitative**: Closes Phase 3 Plan 7 Task 12 (T-024B acceptance gate). Single in-house reviewer, target **<30 min** for 200 mappings.

**Goal:** Seed `app.parthenon_mapping_review_queue` with 200 realistic-shape rows so a domain expert can run the timed acceptance test that Phase 3 Plan 7 deferred. Closes the last open gate from Phase 3.

**Architecture:**

- **Seed source (Q5):** Synthesize from anonymized customer LIS exports — same shape as Plan 5 unmapped queue (source_code + source_text + 5 candidates with similarities), zero PHI. Customer files live outside the repo; the seeder reads from `--input` path and writes to the queue.
- **Artisan command:** `php artisan harmonia:seed-review-queue --rows=200 --vocabs=ICD10CM,NDC,LOCAL_LIS --input=/path/to/anonymized.csv` (no input file → use built-in synthetic generator).
- **Reviewer protocol:** Dr. Udoshi (Q6) opens `/admin/mapping-review`, starts a timer at the first row, decides each row (approve / reject / escalate / next), stops the timer at row 200. Records wall-clock + per-row decision distribution.
- **Acceptance:** wall-clock ≤30 min OR documented friction points if >30 min (R3 mitigation: 60 min is a soft gate).

**Tech Stack:** Laravel 11 Artisan command, Faker for synthetic generator, the existing reviewer UI from Plan 7.

**Depends on:** Phase 3 closed (Plan 7 reviewer UI on main).

**Unblocks:** Phase 4 closeout artifact.

---

## Conventions

- Backend conventions same as prior plans.
- Branch: `feature/phase-4-plan-2-reviewer-ui-timed-test`.
- Type names: `SeedReviewQueueCommand`, `ReviewerSyntheticRowFactory`.

---

## Task index (6 tasks)

1. **Artisan command** — `app/Console/Commands/Harmonia/SeedReviewQueueCommand.php`. Signature `harmonia:seed-review-queue {--rows=200} {--vocabs=*} {--input=}`. Reads input file or invokes synthetic generator. Inserts via `MappingReviewQueueItem::factory()->create([...])`.
2. **Synthetic row factory** — `ReviewerSyntheticRowFactory` mixes hand-curated realistic source codes (e.g. `GLUC-FASTING`, `FERR-SER`, common ICD10 stems) with Faker-generated decoys. Each row gets 5 candidate concept_ids drawn from `vocab.concept` with descending similarity.
3. **Anonymizer pre-pass** — if `--input` is given, run the customer file through `tools/anonymize_lis_export.py` (strips MRN, DOB, names; verifies output is PHI-free via a smoke check on the output sample).
4. **Devlog + reviewer brief** — `docs/devlog/modules/2026-XX-XX-harmonia-timed-user-test.md` describes how to run the test, the gate, and where to record results. Brief is sent to Dr. Udoshi before the session.
5. **Run the timed test** — single in-house reviewer session. Record wall-clock + decision histogram (approves vs rejects vs escalates) + screenshot of the queue at end. Target: **≤30 min**.
6. **ADR 0019 + Plan 7 closeout** — amend ADR 0019 with verdict; update `docs/superpowers/plans/2026-05-06-...-plan-7-...md` Task 12 from "Deferred" to "Done — Plan 4 Plan 2". If verdict misses 30 min, document UX friction points + Phase 5+ candidate work items.

---

## Done

After Task 6: timed-test verdict on the file, ADR 0019 amended, Plan 7 Task 12 closed.

**Pre-PR check-in:** the live wall-clock number from Task 5 MUST appear in the PR description before merge.
