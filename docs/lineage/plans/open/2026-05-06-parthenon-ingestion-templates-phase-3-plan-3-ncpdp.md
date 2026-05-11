# Parthenon Ingestion Templates — Phase 3, Plan 3: T-021C — NCPDP Pharmacy Claims

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Third slice of T-021. Lands the NCPDP D.0 Telecom Standard reader for pharmacy claims, projects to OMOP `DRUG_EXPOSURE` + `COST`. Closes T-021. Commercial-tier per Phase 3 spec §2 + Q1=(b′).

**Architecture:** New commercial-tier node `NCPDP_Reader` reads NCPDP D.0 transactions. NCPDP is a different standard than X12 (segment-based but distinct grammar), so we use a dedicated parser — `pyparsing`-based hand-rolled minimal parser is acceptable here since (a) NCPDP D.0 is much narrower than X12 (focused on pharmacy fills + reversals), (b) no widely-adopted Python NCPDP library exists with a clean license, and (c) the field set we need (NDC code, days supply, quantity dispensed, cost, BIN/PCN) is small. The reader maps NDC codes via `vocab.concept_relationship 'Maps to'` to RxNorm → DRUG_EXPOSURE.

**Tech Stack:** Python 3.12, no new heavy deps. `pyparsing` (already a transitive of pandas/structlog).

**Depends on:** Phase 3 Plan 1 (commercial-tier wheel + manifest scaffolding).

**Unblocks:** None directly. Closes T-021.

---

## Conventions

Same as Plans 1–2. Branch: `feature/phase-3-plan-3-ncpdp`. Type names: `NCPDPReader`, `NCPDPClaim`, `NCPDPParseError`.

---

## Task index (10 tasks)

1. NCPDP D.0 grammar — minimal pyparsing definition (segments: AM01 transaction header, AM03 patient, AM04 insurance, AM07 claim, AM11 pricing)
2. `NCPDPClaim` typed Pydantic model
3. `NCPDPReader` reader core
4. NDC → RxNorm mapping (joins on `vocab.concept` + `concept_relationship 'Maps to'`)
5. Reversal handling — transaction code B2 (reversal) emits compensating DRUG_EXPOSURE + negative COST
6. Synthetic NCPDP fixtures (50-claim corpus, deterministic seed)
7. Manifest extension — `claims_to_omop` gains `03_load_ncpdp` + `03a_map_drug_exposure` stages
8. Validation pack — pharmacy-only sub-corpus E2E
9. HIGHSEC PHI guard — pharmacy DOB / member ID never logged
10. ADR amendment to 0016 — pharmacy-claims convention

---

## Task 1: NCPDP grammar

Define a `pyparsing` grammar covering only the segments we ingest. NCPDP D.0 reference: NCPDP Telecom Standard v.D.0 §B.1 (Claim Billing). Each segment ends with a segment separator (default `0x1E`); fields within a segment use field separator `0x1C`.

**Commit:** `feat(templates/commercial): NCPDP D.0 minimal pyparsing grammar`.

---

## Task 2: `NCPDPClaim` types

```python
class NCPDPClaim(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    transaction_code: Literal["B1", "B2", "B3"]  # Billing / Reversal / Rebill
    bin_number: str
    processor_control_number: str
    pharmacy_npi: str
    cardholder_id: str  # de-identified per HIGHSEC
    date_of_service: date
    ndc_code: str  # 11-digit NCPDP product ID
    days_supply: int = Field(ge=0)
    quantity_dispensed: Decimal = Field(ge=0)
    ingredient_cost: Decimal = Field(ge=0)
    dispensing_fee: Decimal = Field(ge=0)
    patient_paid_amount: Decimal = Field(ge=0)
    is_reversal: bool = False
```

**Commit:** `feat(templates/commercial): NCPDPClaim typed model`.

---

## Task 3: Reader

`NCPDPReader.read(path)` parses one transaction per record, materializing `NCPDPClaim`. **Commit:** `feat(templates/commercial): NCPDPReader core`.

---

## Task 4: NDC → RxNorm

Join `fmt_ncpdp_claim.ndc_code` against `vocab.concept` (`vocabulary_id='NDC'`) and follow `concept_relationship 'Maps to'` to RxNorm standard concepts. SQL stage `03a_map_drug_exposure.sql` handles the projection. Unmapped NDCs go to a Phase 6/T-024 review queue (not in scope here; just emit them to a `unmapped_ndc` log table). **Commit:** `feat(templates/commercial): NDC → RxNorm via concept_relationship`.

---

## Task 5: Reversals

Transaction code B2 (reversal) → compensating DRUG_EXPOSURE row with `quantity` = negative + COST row with negated amounts. Original DRUG_EXPOSURE preserved (idempotency). **Commit:** `feat(templates/commercial): NCPDP B2 reversals emit compensating rows`.

---

## Task 6: Fixtures

Deterministic 50-pharmacy-claim corpus (seed=42), mix of B1 fills and B2 reversals. Real NDC codes from `vocab.concept` (curated 30 common NDCs). **Commit:** `feat(templates/commercial): synthetic NCPDP corpus`.

---

## Task 7: Manifest extension

Add stages to `claims_to_omop/manifest.yaml`: `03_load_ncpdp` (csv_reader → fmt_ncpdp_claim), `03a_map_drug_exposure` (sql_file://). **Commit:** `feat(templates/commercial): claims_to_omop manifest gains NCPDP stages`.

---

## Task 8: Validation pack

E2E:
- 100% of B1 transactions produce a DRUG_EXPOSURE + COST row
- B2 reversals net to 0 quantity for the reversed claim_id
- 90% of NDCs map to a non-NULL RxNorm `drug_concept_id` (10% expected unmapped — flow into review queue)
- Throughput: 100k pharmacy claims < 30 min (T-021 budget)

**Commit:** `test(templates/commercial): claims_to_omop NCPDP E2E`.

---

## Task 9: HIGHSEC PHI guard

Pharmacy DOB (NCPDP field 304-C4) + cardholder_id (302-C2) are PHI. Reader logs MUST never include them. Test captures stderr during a parse and asserts redaction. **Commit:** `feat(templates/commercial): NCPDP PHI guard`.

---

## Task 10: ADR 0016 amendment

Append §"NCPDP pharmacy claims" subsection covering NDC→RxNorm mapping convention, reversal handling, and the unmapped-NDC review-queue handoff to T-024. **Commit:** `docs(adr): ADR 0016 — append NCPDP pharmacy claims convention`.

---

## Done

T-021 (`claims_to_omop`) is complete after Task 10. The template ingests 837 institutional/professional/dental + 835 remits + NCPDP pharmacy and projects to VISIT_OCCURRENCE / PROCEDURE_OCCURRENCE / CONDITION_OCCURRENCE / DRUG_EXPOSURE / COST.
