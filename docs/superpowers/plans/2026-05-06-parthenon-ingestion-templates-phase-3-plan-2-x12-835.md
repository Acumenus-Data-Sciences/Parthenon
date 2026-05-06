# Parthenon Ingestion Templates — Phase 3, Plan 2: T-021B — X12 835 Remit Reconciliation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Second slice of T-021. Lands the X12 835 (electronic remittance advice) reader and joins it onto Plan 1's 837 claims output via `claim_id` to populate the `paid_amount` and `allowed_amount` columns of the COST projection. Commercial-tier per Phase 3 spec §2 + Q1=(b′). Shares `pyx12` (Q2=(a)) with Plan 1.

**Architecture:** New commercial-tier node `X12_835_Reader` reads 835 transaction sets, normalizes to one `X12_835_RemitItem` per CLP/SVC loop pair, and runs a reconciliation pass that joins on `(payer_id, claim_id)` against the `cost` rows Plan 1 inserted. Updates `cost.paid_amount`, `cost.allowed_amount`, and a new `cost.remit_received_at` timestamp. Reversals (CLP02 = 22 "Reversal of Previous Payment") emit a compensating COST row with negative amounts.

**Tech Stack:** Python 3.12, `pyx12==2.4.5` (already pinned in Plan 1).

**Depends on:** Phase 3 Plan 1 (X12 837 reader + COST projection merged) — this plan reconciles against Plan 1's output.

**Unblocks:**
- Phase 3 Plan 3 (T-021C, NCPDP) — shares the reconciliation helper.
- Plan 6 (T-024A) — the cost-aware concept-mapping ranker can use joined paid/charged ratios as a feature.

---

## Conventions

Same as Plan 1. Branch: `feature/phase-3-plan-2-x12-835`. Type names: `X12_835_Reader`, `X12_835_RemitItem`, `RemitReconciler`, `X12RemitReconciliationError`.

---

## Task index (8 tasks)

1. `X12_835_RemitItem` typed Pydantic model (CLP + SVC + CAS adjustments)
2. `X12_835_Reader` reader core
3. `RemitReconciler` — joins onto `cost` rows via `(payer_id, claim_id, line_number)`
4. Reversal handling — CLP02=22 emits compensating negative-amount COST rows
5. Synthetic 835 fixtures (CMS public examples)
6. Manifest extension — add `02e_load_835.sql` + `02f_reconcile_remit.sql` stages to `claims_to_omop`
7. Validation pack — joined corpus where every Plan 1 line has a Plan 2 remit
8. ADR amendment to 0016 — remit reconciliation convention

---

## Task 1: `X12_835_RemitItem` types

```python
class X12_835_RemitItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    payer_id: str
    claim_id: str  # from CLP01 — joins onto Plan 1's claim_id
    line_number: int = Field(ge=1)
    procedure_code: str
    charged_amount: Decimal
    paid_amount: Decimal
    allowed_amount: Decimal
    adjustment_codes: list[tuple[str, Decimal]] = Field(default_factory=list)  # CAS group/reason/amount
    is_reversal: bool = False
    paid_date: date | None = None
```

Tests assert frozen, extra="forbid", reversal toggle. **Commit:** `feat(templates/commercial): X12_835_RemitItem typed model`.

---

## Task 2: Reader

`X12_835_Reader.read(path)` walks pyx12's CLP/SVC/CAS loops; one `X12_835_RemitItem` per service line. Test against in-memory 835 transaction. **Commit:** `feat(templates/commercial): X12_835_Reader CLP/SVC walker`.

---

## Task 3: Reconciler

`RemitReconciler.reconcile(remit_items, cost_table_rows) -> list[CostUpdate]` produces UPDATE statements keyed on `(payer_id, claim_id, line_number)`. Missing claim_id (orphan remit) emits a structured warning + a row in a `remit_orphans` log table. **Commit:** `feat(templates/commercial): RemitReconciler joins 835 onto Plan 1 cost rows`.

---

## Task 4: Reversals

CLP02 = 22 → emit a compensating COST row with negated amounts and `cost_event_field_concept_id` = "remit_reversal". Original COST row is preserved (idempotency). **Commit:** `feat(templates/commercial): 835 reversals emit compensating COST rows`.

---

## Task 5: Synthetic fixtures

CMS-published 835 examples + a 100-remit deterministic corpus matched to Plan 1's 100-claim output. Some claims intentionally have no remit (orphan-claim case); some remits have no upstream claim (orphan-remit case); some are reversals. **Commit:** `feat(templates/commercial): synthetic 835 corpus matched to Plan 1 claims`.

---

## Task 6: Manifest extension

New stages in `claims_to_omop/manifest.yaml`: `02e_load_835` (sql_file://sql/02e_load_835.sql), `02f_reconcile_remit` (uses RemitReconciler via a new `remit_reconciler` node). **Commit:** `feat(templates/commercial): claims_to_omop manifest gains 835 reconciliation stages`.

---

## Task 7: Validation pack

E2E asserts:
- 100% of paid claims get a `paid_amount` (no NULL after reconciliation)
- ≥95% match rate (orphan rate <5%)
- Reversal compensation: net cost = original − reversal for every reversed claim
- ≥99% of remit rows process within 30s (devplan T-021 perf budget)

**Commit:** `test(templates/commercial): claims_to_omop 835 reconciliation E2E`.

---

## Task 8: ADR 0016 amendment

Append a §"Remit reconciliation" subsection to ADR 0016 documenting the join key, reversal compensation, and orphan handling. **Commit:** `docs(adr): ADR 0016 — append 835 remit reconciliation`.

---

## Done

After Task 8 lands, Plan 2 is complete. The `claims_to_omop` template now produces fully-reconciled cost rows with both charged and paid amounts.
