# Parthenon Ingestion Templates — Phase 4, Plan 7: Federated mapping review spike

> **For agentic workers:** Use `superpowers:executing-plans`. Steps use checkbox tracking.

> **GATE — exploratory**: Spike + design memo only (Phase 4 spec Q11). NO ADR. Production lift is **gated on Hive Networks Phase N** and moves out of the templates subproject.

**Goal:** Working POC of cross-network mapping review using the Plan 7 reviewer UI on top of Hive Networks' federated query layer. Demonstrates "X reviewers across N networks have approved this concept" without sharing PHI. Outputs a design memo describing what production lift requires.

**Architecture:**

- **Federated query path:** Hive Networks' federated layer answers "for source_code+source_vocab=X, how many networks have an approved mapping in `parthenon_concept_map`?" without revealing per-network row counts (k-anonymity threshold ≥3).
- **Reviewer UI extension:** detail page gains a "Cross-network signal" panel: "3 networks have approved concept_id=4193704; 1 has rejected; 0 escalated". No reviewer names, no row counts below k.
- **Topology:** 2-network POC. Network A is `parthenon.acumenus.net`; Network B is a second self-hosted Parthenon instance (or a stub fixture if Hive isn't ready).
- **Hive dependency:** if Hive Networks federated layer isn't available at execution time, build against a stub `FederatedQueryClient` that returns canned responses; the design memo documents the real integration.

**Tech Stack:** Hive Networks federated query SDK (or stub); Plan 7 reviewer UI extension (React).

**Depends on:** Phase 3 closed; **Hive Networks federated query layer status check** (Phase 4 spec §7).

**Unblocks:** Hive Networks Phase N — production federated mapping review.

---

## Conventions

- Branch: `feature/phase-4-plan-7-federated-mapping-spike`.
- Type names: `FederatedQueryClient`, `FederatedConsensusPanel`, `useFederatedConsensus`.
- This is a SPIKE — code lives in `templates/commercial/spikes/federated_mapping/` and is NOT loaded by the runtime registry. The reviewer UI extension is feature-flagged off by default.

---

## Task index (6 tasks)

1. **Hive readiness probe** — short audit doc `docs/devlog/modules/2026-XX-XX-hive-federated-status-probe.md`. If Hive's federated query layer is production-ready, integrate; if not, build the spike against the `FederatedQueryClient` stub.
2. **`FederatedQueryClient` interface** — abstract over Hive vs stub. `consensus(source_code, source_vocab) -> {approved: int, rejected: int, escalated: int, networks_responding: int, k_anonymity_met: bool}`.
3. **Stub implementation** — `FederatedQueryClientStub` returns canned responses for testing. Real implementation deferred or wired against Hive depending on Task 1.
4. **Reviewer UI panel** — `FederatedConsensusPanel.tsx` on the detail page. Shows the consensus numbers if `k_anonymity_met=true`, otherwise renders "Insufficient cross-network data". Feature-flagged off by default.
5. **POC walkthrough** — record a short video or screenshots showing the panel in action across 2 networks (or stub). Lands in `docs/devlog/modules/2026-XX-XX-federated-mapping-poc.md`.
6. **Design memo** — `docs/architecture/2026-XX-XX-federated-mapping-design-memo.md` documents:
   - What the spike proved
   - What production requires (auth, k-anon enforcement, response caching, latency budget)
   - Open questions for Hive Networks Phase N owner
   - The Phase 5+ ticket that takes over from here

---

## Done

After Task 6: spike code in `templates/commercial/spikes/`; reviewer UI panel feature-flagged off; design memo handed to Hive Networks Phase N owner. NO ADR — explicit per Q11.
