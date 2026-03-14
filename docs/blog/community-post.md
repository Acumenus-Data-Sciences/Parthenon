# Introducing Parthenon — A Unified, Open-Source OHDSI Platform (Seeking Collaborators & Testers)

Hi everyone,

I'd like to share a project I've been building called **Parthenon** — an open-source platform that consolidates the OHDSI toolchain into a single application on OMOP CDM v5.4.

**Live demo:** [parthenon.acumenus.net](https://parthenon.acumenus.net)
**Source code:** [github.com/sudoshi/Parthenon](https://github.com/sudoshi/Parthenon) (Apache 2.0)
**User manual:** [parthenon.acumenus.net/docs](https://parthenon.acumenus.net/docs)

---

## The motivation

If you've run a real-world evidence study with OHDSI tools, you know the friction: Atlas for cohort definitions, a separate WebAPI, Achilles in R, DQD in R, WhiteRabbit and Usagi in Java, CohortMethod and PLP in R — each with its own setup, its own credentials, and its own quirks. Researchers who just want to answer a clinical question spend a disproportionate amount of time wrestling with tooling.

Parthenon is an attempt to put all of that into one login, one Docker Compose stack, and one consistent interface.

---

## What it does today

Parthenon currently covers:

- **Cohort builder** — Circe-compatible expression editor with drag-and-drop criteria, real-time SQL preview, and full import/export compatibility with Atlas cohort definitions
- **Vocabulary browser** — Search, hierarchy navigation, ancestor/descendant trees, and concept set builder across 7M+ OMOP concepts
- **Data characterization** — Built-in Achilles engine (~200 analyses) and DataQualityDashboard (~3,500 checks), no R installation required
- **Research workbench** — Characterizations, incidence rates, treatment pathways, population-level estimation (CohortMethod via R sidecar), and patient-level prediction (PLP via R sidecar)
- **Study orchestrator** — Bundle multiple analyses into a study with unified execution and progress tracking
- **Care gap tracking** — 45 pre-built care bundles, 438 gap measures, per-patient and population-level compliance dashboards
- **AI-powered ingestion** — Upload CSV or FHIR bundles, get schema mapping suggestions and concept mapping with confidence scores, review and approve before writing to CDM
- **Patient profiles** — Interactive timelines with drill-through to vocabulary
- **Abby AI assistant** — Describe a cohort in plain English, get a structured OMOP expression (powered by MedGemma)

The stack is Laravel 11 (PHP 8.4) on the backend, React 19 with TypeScript on the frontend, Python 3.12/FastAPI for the AI service, R 4.4 for HADES package integration, and PostgreSQL 16 with pgvector. Everything runs in Docker.

---

## Where it's headed

Version 1.0 shipped with full Atlas parity and HADES integration. The current roadmap extends into three domains where the OHDSI community has the vocabulary and scientific infrastructure but no integrated tooling:

- **v1.1 (shipped)** — Molecular diagnostics and cancer genomics (VCF ingestion, ClinVar annotation, variant-level cohort criteria)
- **v1.2 (in progress)** — DICOM and medical imaging (DICOMweb integration, imaging cohort criteria, radiology report NLP)
- **v1.3 (in progress)** — Health economics and outcomes research (cost-effectiveness analysis, budget impact modeling, Markov microsimulation)

---

## What I'm looking for

I'm reaching out to the community because this project would benefit enormously from people who know this domain better than I do. Specifically:

- **OMOP/CDM experts** — If you work with OMOP data regularly, your feedback on whether the ETL assumptions, vocabulary handling, and CDM compliance are correct would be invaluable
- **Atlas users** — If you use Atlas today, I'd love to know what Parthenon gets right and where it falls short compared to your real workflows
- **R/HADES developers** — The R sidecar integration for CohortMethod and PLP works but could use review from someone who runs these packages in production
- **Clinical informaticists** — Feedback on the care gap framework, data quality checks, and whether the characterization output matches what you'd expect from Achilles
- **Frontend/UX contributors** — The interface is functional but there's always room for improvement
- **Anyone willing to test** — Try the demo, file issues, break things. The project has a full CI pipeline and I'm responsive to bug reports

The GitHub repo has a `CLAUDE.md` file that gives an AI-friendly overview of the architecture, and the `docs/devlog/` directory contains detailed phase-by-phase development logs if you want to understand how things were built.

---

## Try it

The fastest way to explore is the live demo at **[parthenon.acumenus.net](https://parthenon.acumenus.net)** — it's running against a Synthea dataset (1M synthetic patients) so you can build cohorts, run analyses, and explore the full feature set without any setup.

To run it yourself:

```bash
git clone https://github.com/sudoshi/Parthenon.git
cd Parthenon
cp .env.example .env && cp backend/.env.example backend/.env
docker compose up -d
```

Full setup instructions are in the README.

---

I'd be grateful for any feedback, whether it's "this is useful" or "you're doing X wrong." Both help. If you're interested in contributing, feel free to open an issue or reach out directly.

Thank you for building the OHDSI ecosystem — Parthenon wouldn't exist without the work this community has done on the CDM, vocabularies, and methods library.

Sanjay
