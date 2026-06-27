---
slug: v1-0-9-protocol-to-publication-fhir-copilots
title: "Parthenon v1.0.9 — Protocol-to-Publication, FHIR Interoperability, and Copilots Everywhere"
description: "The production-readiness release. A deterministic protocol-to-publication pipeline (ADR-0020) with provenance, empirical calibration, and gated manuscript synthesis; Medgnosis-parity FHIR ingestion validated on the live Epic sandbox; the Abby copilot on every page with a local-model backend for Community Edition; and a fresh-machine install that just works — 161 commits in 29 days."
authors: [mudoshi]
tags: [release, studies, fhir, agents, production-readiness, install]
date: 2026-06-26
---

## v1.0.9 — Protocol-to-Publication, FHIR Interoperability, and Copilots Everywhere

Where v1.0.8 grew the research surface (Publish, Library Lifecycle, the first
copilots), v1.0.9 is the release that makes that surface **trustworthy and
reproducible**. It lands the deterministic **protocol-to-publication pipeline**
(ADR-0020) — provenance, empirical calibration, scientific gates, and
manuscript synthesis — brings **FHIR ingestion to Medgnosis parity** and proves
it against the live Epic sandbox, puts the **Abby copilot on every page** with a
**local-model backend** so Community Edition can run it on-prem, and closes a
long list of production-readiness items: RBAC on every PHI route, R/HADES
analytics proven end-to-end, no "coming soon" in primary workflows, and a
fresh-machine install that starts cleanly from `docker compose up`.

<!--truncate-->

### Protocol-to-Publication pipeline (ADR-0020)

The single largest feature block. A study now moves through a deterministic
finite-state machine from protocol to manuscript, with each transition gated on
evidence:

- **Provenance spine** — content-addressable hashes across analysis outputs and
  draft artifacts, version pinning, and reproducible study packages, so any
  result can be traced to the exact inputs and code that produced it
- **Empirical calibration** — calibrated confidence intervals, EASE, and
  multiplicity correction, with negative-control calibration wired into the
  CohortMethod sidecar; uncalibrated estimates never reach the manuscript
- **Scientific gate ledger + estimate blinding** — blocking gates with estimate
  blinding, behind the `studies.gating_enabled` flag
- **Missing-cohort diagnostics** — index-event breakdown, inclusion attrition,
  and orphan-concept diagnostics with user-visible explanations
- **Manuscript composer** — a gate-aware, protocol-ordered STROBE/RECORD
  synthesis with a provenance appendix, exportable to DOCX and XLSX

Driving it is the **Abby study orchestrator**, a Claude Agent SDK copilot with
an orchestrator launch surface and copilot panel that carries study design →
execution → publication. (This orchestrator shipped under the working name
"Clio" and was unified under the single **Abby** brand before release — one
universal AI brand, zero behavior change.)

### FHIR interoperability — Medgnosis parity and a live Epic handshake

Parthenon's FHIR ingestion now matches the Medgnosis mapper set and is proven on
real Epic data:

- **Six new resource types** — CarePlan, Goal, CareTeam, DocumentReference,
  Coverage, and ServiceRequest map into the OMOP CDM (and its extension tables)
  through a new `ResourceMapper` interface with registry dispatch
- **Soft-delete semantics** — `entered-in-error` status plus a Bulk deleted
  manifest, with soft-delete crosswalk columns on the care-extension tables
- **Epic SMART Backend Services auth** — a public **JWKS endpoint** with a `kid`
  in the Backend Services JWT, validated end-to-end against the live Epic FHIR
  sandbox: the auth handshake plus six mappers exercised on real data
- **OMOP-to-FHIR bulk `$export`** with per-user rate limiting, surfaced through
  an admin bulk-export page that creates, polls, and downloads NDJSON

### Copilots everywhere — and a local-model backend for CE

- **Omnipresent Abby** — an action-taking copilot on the Claude Agent SDK,
  grounded on all 38 page contexts, with help and Abby drawer coverage on every
  page (previously only 21 contexts were grounded)
- **Provider flexibility** — an admin-switchable copilot provider (Anthropic
  cloud ↔ local Ollama) with graceful fallback, plus a config-driven
  local-model backend so **Community Edition can run the copilots fully on-prem**
- **Cloud safety** — Abby provider entitlements with cloud-safety gates and
  HIGHSEC API key masking

### Production-readiness hardening

Most of the release is the unglamorous work that turns a feature-complete beta
into something you can run on real PHI:

- **Security** — CORS scoped to app origins (was wildcard with credentials);
  RBAC permission middleware added to Achilles, DQD, risk-score, and
  clinical-coherence routes; `profiles.view` enforced on Morpheus and Patient
  Profile PHI routes
- **R / HADES proven end-to-end** — estimation, prediction, SCCS, and
  evidence-synthesis runs now **fail with actionable diagnostics** when the R
  sidecar is unavailable instead of silently completing; the response contract
  is hardened and HADES is verified end-to-end; a per-contrast diagnostics gate
  means one bad contrast no longer fails an entire study
- **`sidecars:readiness`** — a single artisan command that probes all nine
  sidecars (darkstar/R, python-ai, redis, orthanc, hecate, fhir-to-cdm,
  templates, anonymizer, scispacy) with `--json` and a non-zero exit, for
  environment promotion gates
- **No "coming soon"** — the FHIR bulk-export and source-profiler comparison
  surfaces are wired to real backends, and non-functional stubs were removed
  outright (the dead Abby plan-execution UI, Chroma Studio seed-FAQ, imaging AI
  measurement extraction) rather than left as placeholders
- **Quality gates** — coverage floor ratcheted 25% → 32% (measured 33.59%),
  real PHPStan level 8 restored via a dated baseline, and new contract tests
  (R↔PHP calibration, Abby data-interrogation, a manuscript
  numeric-fabrication guard)

### Research surface and Publish

- **OHDSI-lifecycle study tabs** — Study Protocol → Analysis Results → Draft
  Manuscript, populated from analysis results with a composed manuscript and
  merged progress tracking
- **Publish exports** — XLSX manuscript export, PNG/SVG figure export, OHDSI
  report-bundle import/export, a rich study-first picker with typed result
  summaries, and `###` subheadings in the paper renderer
- **Multi-reviewer phenotype adjudication**, **patient-similarity PSM cohort
  export** to the results table, **GIS `.xlsx`/`.xls` upload**, and a wired
  self-controlled cohort detail route
- **Hypertension v4** designed and run end-to-end on the Acumenus OMOP CDM —
  BP-indexed target, delay strata, a negative-control panel, and a
  recording-comparable normotensive comparator

### Easier to install

Fresh-machine install hardening closes the gaps that made a clean clone
stumble:

- `docker compose` now starts from a clean `.env.example` — the previously
  undocumented, **required** `PARTHENON_INTERNAL_TOKEN` is present, along with
  default-service credentials for Reverb, Orthanc, Hecate, and JupyterHub, so
  the first `docker compose up` no longer aborts or comes up blank-credentialed
- the installer creates the `acropolis-backend` network and the `data/wiki`
  bind directory before starting services
- the manual-install docs now match reality (the `node` frontend builder lives
  in the `dev` profile, the external networks and host directory are created
  up front)

The recommended path remains the one-command installer:

```bash
git clone https://github.com/Acumenus-Data-Sciences/Parthenon.git
cd Parthenon
python3 install.py
```

### Upgrade notes

- `git pull && ./deploy.sh` is sufficient for most environments. New
  columns (FHIR care-extension tables, soft-delete crosswalks, provenance
  tables) are added by idempotent migrations — run `./deploy.sh --db` to apply
  them.
- The protocol-to-publication **gates are off by default** — enable them with
  `studies.gating_enabled` once you want blocking gates and estimate blinding.
- The **AI Agents** copilots remain off by default; enable them from the admin
  AI Agents toggle. To run them locally in Community Edition, set
  `AGENT_PROVIDER=local`, pull `AGENT_LOCAL_MODEL` in Ollama, and start the
  sidecar (`docker compose --profile ce up -d claude-router python-ai`).
- Existing installs already have `PARTHENON_INTERNAL_TOKEN` set; the install
  changes only affect fresh clones.

### By the numbers

- **161 commits** since v1.0.8 over 29 days (49 `feat`, 32 `fix`)
- **8 `feat(fhir)`** commits bringing the mapper set to Medgnosis parity
- **26** commits across the studies / publish / orchestration / estimation /
  agents feature lines
- **3 install blockers** found and fixed so a clean clone reaches login

### Contributors

Claude Code + @sudoshi
