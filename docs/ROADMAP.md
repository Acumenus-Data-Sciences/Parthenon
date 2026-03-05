# Parthenon Roadmap

Parthenon 1.0 (shipping with Phase 14 — HADES integration) unifies the core OHDSI toolchain. The three phases that follow extend the platform into domains where the OHDSI community has the data, the vocabulary, and the scientific infrastructure — but no integrated tooling.

Each phase is designed so that it delivers standalone value before the next one begins. They can be adopted independently.

---

## Current Status

| Version | Status | What ships |
|---|---|---|
| **0.9** | Shipped | Full Atlas parity, Docusaurus manual, API reference, in-app help |
| **1.0** | Shipped | Phase 14 — CDM characterization dashboard, patient profiles, care gaps materialized layer, Eunomia GiBleed loader, multi-source Achilles |
| **1.1** | In development | Phase 15 — Molecular Diagnostics & Cancer Genomics |
| **1.2** | Planned | Phase 16 — DICOM & Medical Imaging |
| **1.3** | Planned | Phase 17 — Health Economics & Outcomes Research |

---

## Phase 15 — Molecular Diagnostics & Cancer Genomics (v1.1)

> *The 17-year gap between validated evidence and clinical practice is shortest precisely where it would hurt most to miss it: precision oncology. Phase 15 closes that loop.*

### The Problem

The OHDSI network represents 544+ databases and hundreds of millions of patients. For researchers studying cancer genomics, that data exists — variant calls live in OMOP MEASUREMENT tables, treatment episodes in EPISODE/EPISODE_EVENT, tumor characteristics in the OMOP Oncology Extension. But no tool makes these queryable together. Genomics Working Group tooling (KOIOS, vcf2omop) is R-only and command-line. The evidence synthesis loop — from observational data to computable clinical recommendation — is entirely manual.

### What Ships

#### Genomic Data Ingestion
Upload VCF files, FHIR Genomics reports, PDF pathology reports, or cBioPortal MAF files. The AI-powered pipeline maps variants to OMOP concepts using the OMOP Genomic Vocabulary (HGVS, ClinVar, COSMIC), writes structured records to the MEASUREMENT table, and flags any mappings that require human review. The same ingestion review queue used for general ETL handles genomic concept assignments.

#### Genomic Criteria in the Cohort Builder
The cohort definition editor gains new criteria types alongside the existing clinical panels:

- **Gene mutation** — e.g., EGFR L858R mutation present
- **Tumor Mutational Burden (TMB)** — above/below quantile threshold
- **Microsatellite Instability (MSI)** — stable / unstable / indeterminate
- **Gene fusions** — e.g., ALK rearrangement
- **Pathogenicity class** — ClinVar Likely Pathogenic or Pathogenic
- **Treatment episodes** — HemOnc chemotherapy regimen criteria

Example cohort: *"Patients with EGFR L858R AND Stage IIIB/IV NSCLC AND first-line osimertinib — with at least 6 months of CDM observation following treatment initiation."* Built visually with real-time person-count feedback, no SQL required.

#### Variant-Outcome Analysis Suite
Four purpose-built analytical modules for precision medicine outcomes research:

| Module | What it answers |
|---|---|
| **Mutation-Survival Analyzer** | Kaplan-Meier and Cox regression stratified by mutation status, TMB quantile, or MSI — visualized as survival curves with confidence intervals |
| **Treatment-Variant Response Matrix** | Heatmap of response rates across mutation × treatment combinations — identify which variants predict response to which therapies |
| **Genomic Characterization Dashboard** | Waterfall plots, lollipop mutation diagrams, co-occurrence matrices, pathway enrichment — the researcher-facing view of a cohort's molecular landscape |
| **Pharmacogenomic Correlator** | Link germline pharmacogenomic variants (CYP450, VKORC1, CYP2C9) to drug exposure and adverse event rates at the population level |

#### AI-Powered Evidence Synthesis
An automated pipeline that monitors OMOP data for emerging genomic signals, generates and executes population-level effect estimation studies without manual study design, and produces LLM-written evidence summaries (with effect sizes, confidence intervals, and GRADE-style quality assessments) readable by oncologists and tumor boards.

#### Molecular Tumor Board Dashboard
Given a patient's molecular profile, Parthenon queries its evidence base for outcomes data from molecularly similar patients — surfaced as a structured evidence panel for tumor board discussion. Exportable as FHIR ClinicalReasoning resources for EHR integration via CDS Hooks.

#### Federated Network Analysis
GA4GH VRS-based variant identification allows variant frequency queries and treatment-outcome association studies to run across OHDSI network sites without sharing patient-level data. Variant records are identified by globally unique VRS IDs rather than institution-specific strings, making federation accurate across different sequencing pipelines.

### Why Now
The OMOP Oncology Extension (Episode/Episode_Event tables, CDM v5.4) is now stable with 20+ data partners converting. The OMOP Genomic Vocabulary is in active development. The KOIOS-VRS preprint (Feb 2026) establishes the federated variant identification approach. The scientific infrastructure is ready; what's missing is the platform to make it accessible without writing R.

---

## Phase 16 — DICOM & Medical Imaging (v1.2)

> *3.6 billion imaging procedures per year. In OMOP today, each one is a single procedure code. Phase 16 gives imaging its meaning back.*

### The Problem

Medical imaging is the largest data domain in healthcare by volume — and the most invisible in observational research. The OMOP Medical Imaging (MI-CDM) extension, published in 2024 and validated against the ADNI dataset, defines how to represent imaging studies as `Image_occurrence` records and quantitative measurements as `Image_feature` records. But it's a specification without a reference implementation. Nobody has an embedded PACS, an integrated viewer, an AI biomarker pipeline, and OMOP analytics in one deployable stack.

### What Ships

#### Embedded DICOM Server (Orthanc)
A production-grade PACS/VNA (Orthanc, GPLv3) runs as a Docker service alongside Parthenon. DICOM studies stored in Orthanc are automatically ETL'd into `Image_occurrence` records with metadata, acquisition parameters, and `wadors_uri` links. Orthanc's DICOMweb API (WADO-RS, QIDO-RS, STOW-RS) feeds the viewer and the AI biomarker pipeline.

#### Zero-Footprint DICOM Viewer (OHIF)
The OHIF Viewer (v3, React/Cornerstone.js) is embedded directly in the Parthenon React SPA. No separate PACS workstation needed. Access imaging from:
- The **patient timeline** — imaging events link to the viewer in context
- **Cohort member browse** — view imaging for any cohort member without leaving Parthenon
- **Imaging analysis results** — drilldown from population-level findings to individual studies

#### AI Biomarker Pipeline
A pluggable inference system where containerized AI models receive DICOM series and write structured `Image_feature` records to the CDM with full provenance (model name, version, confidence, acquisition parameters). Built-in models ship for:
- Organ segmentation (volume, shape features)
- Radiomic feature extraction (IBSI-compliant first-order statistics, texture, shape)
- Nodule detection and measurement (lung, liver)
- Radiation dose tracking (RDSR parsing → population-level dose optimization)

Third-party models can be registered and invoked through the same interface.

#### Radiology Report NLP
Unstructured radiology reports (stored as OMOP NOTE records) are parsed by an LLM-powered pipeline: extract findings → map to RadLex/SNOMED concepts → write structured `Image_feature` records. Handles the full range of report types: CT chest, MRI brain, PET-CT, mammography, ultrasound.

#### Imaging Criteria in the Cohort Builder
Build cohorts defined by imaging findings — not just the procedure that was performed:

- **Modality and anatomy** — CT chest, MRI brain, PET-CT abdomen
- **Quantitative features** — e.g., tumor volume > 3 cm³, SUVmax > 5.0
- **AI-derived classifications** — e.g., Lung-RADS 4B, BI-RADS 5, LI-RADS LR-5
- **Radiation dose thresholds** — for dose optimization studies

#### Radiogenomics
Cross-domain queries linking imaging biomarkers to molecular data via `person_id` and temporal context. Tumor size at diagnosis correlates with variant profiles. Response assessment on follow-up imaging correlates with molecular predictors. The imaging and genomics phases are designed to compose — the same cohort builder, the same analysis suite, the same evidence pipeline.

#### Federated Imaging Research
Share radiomic feature distributions and AI model performance metrics across OHDSI network sites without transmitting DICOM data. Enables multi-site validation of imaging biomarkers and site-stratified population-level imaging analytics.

### Why Now
The MI-CDM extension (Park et al., 2024) and the JAMIA DICOM vocabulary integration paper (October 2025) establish the OMOP-native representation. Orthanc and OHIF are both mature, Docker-ready, and open-source. The IBSI gives a reproducible standard for radiomic features. What's missing is a reference implementation that integrates all of these into a working, deployable system.

---

## Phase 17 — Health Economics & Outcomes Research (v1.3)

> *Parthenon already knows which care gaps are open. Phase 17 answers what it costs when they stay that way.*

### The Problem

Parthenon tracks 45 care bundles and 438 care gap measures — HbA1c testing, retinal exams, statin adherence, BP control, cancer screenings, immunizations — with per-patient open/closed/overdue status and population-level compliance dashboards. But it stops at the clinical question: *Is this gap addressed or not?*

The economic question goes unanswered: *What does it cost when the gap stays open? What is the return on investment of closing it? Which specific gaps in the diabetes bundle drive the most downstream spend?*

OHDSI has world-class clinical comparative effectiveness tooling (CohortMethod, SCCS, PatientLevelPrediction). It has no native mechanism for health economics analysis: no cost accumulation over follow-up windows, no ICER computation, no bootstrapped cost confidence intervals, no QALY framework. Phase 17 fills that gap.

### What Ships

#### Care Gap Economics Engine
For each of the 438 care gap measures across 45 bundles, the engine computes:

- **Pre-period costs** — baseline expenditure in the 6–12 months before gap identification
- **Intervention cost** — cost of closing the gap (screening, medication, clinic visit)
- **Post-period costs** — downstream expenditure at 6, 12, 24, and 36-month windows, broken into complication-related, disease management, and all-cause categories

Costs flow from the OMOP `COST` table (total_charge, total_paid, paid_by_payer, copay, deductible, DRG) linked to clinical events via `cost_event_id`. Claims completeness is validated using `PAYER_PLAN_PERIOD` — patients with enrollment gaps are excluded from specific follow-up windows to prevent underestimation bias.

#### Comparative Cohort Construction with Propensity Scoring
For each bundle, two cohorts are constructed and matched:
- **Gap-Closed Cohort** — patients whose gaps were addressed within a defined window
- **Gap-Open Cohort** — same condition, gaps identified but not addressed or addressed late

Matching uses OHDSI's CohortMethod framework: thousands of baseline covariates from FeatureExtraction, variable-ratio propensity score matching with 0.2 SD caliper, SMD < 0.1 required for all covariates post-match. Difference-in-differences analysis handles residual time-invariant confounding. Negative control outcomes detect any remaining imbalance.

#### ROI Calculator
For every gap measure and every bundle, a single interpretable output: *ROI = (Downstream Cost Avoided) / (Intervention Cost)*. Stratified by age group, comorbidity burden (Charlson index), payer type (commercial, Medicare, Medicaid), and geography. The result is a ranked list: *these are the gaps where care quality investment generates the most economic return.*

#### Population Scenario Modeling
Interactive simulation: *"If our T2DM population achieved 80% HbA1c testing compliance instead of the current 52%, what is the projected 3-year cost impact?"*  The model applies the observed gap-closure cost differential to the counterfactual population at scale. Runs against any registered CDM source.

#### Value-Based Contract Simulator
Configure a value-based care contract — target compliance thresholds per bundle, shared savings percentage, quality bonus structure, measurement period — and simulate performance under current trajectory vs. achievable targets. Outputs: projected shared savings, quality bonus, total value captured per enrolled member per year.

#### HEOR Analytics Dashboard
A dedicated module surfacing:
- Care gap compliance trending over time (monthly, quarterly)
- Cost-of-poor-quality by bundle, stratified by payer and geography
- ROI rankings across all 438 gap measures
- Population scenario comparison (current vs. intervention trajectories)
- Value-based contract performance scorecards

### Why It Matters
US healthcare spends $4.5 trillion annually; an estimated $1.3 trillion is attributable to care coordination failures. The downstream events — diabetic amputations, dialysis initiation, heart failure hospitalizations, COPD ICU exacerbations — are the direct, predictable consequences of care gaps that went unaddressed. Parthenon already identifies those gaps at the patient level. Phase 17 makes the economic case for closing them, at the scale of a health system or an OHDSI network.

---

## Medium-Term (2026–2027)

Beyond the three numbered phases, several capabilities are planned without specific version assignments:

**Vocabulary Refresh UI** — An admin-facing workflow to load new Athena vocabulary downloads: upload the ZIP, extract, COPY into a staging schema, swap into production. Currently requires manual SQL steps.

**FHIR R4 Server** — Expose cohort definitions, patient data, and evidence as FHIR resources. Enable OMOP data to be queried via CQL against FHIR endpoints.

**HL7 v2 Ingestion** — Direct ADT and ORU message ingestion into the CDM pipeline, alongside existing CSV and FHIR ingestion.

**Multi-tenancy** — Schema-per-tenant or row-level security for hosting Parthenon as a shared service across multiple research groups or institutions.

**Active Learning Loop** — The AI concept mapper learns from human review decisions in real time, progressively reducing the volume of mappings requiring manual approval.

**i18n** — Japanese, French, and Spanish UI translations. OHDSI network participants span 70+ countries.

---

## Long-Term Vision

**Federated Analytics** — Execute studies across OHDSI network nodes without sharing raw data. Distributed analysis with local execution, aggregated results.

**CDS Hooks Integration** — Surface evidence generated from OMOP data at the point of care via CDS Hooks. A clinician's EHR triggers a query; Parthenon returns evidence from real-world outcomes data on molecularly similar patients.

**Real-Time Surveillance** — Shift from batch analysis to continuous monitoring. Pharmacovigilance signals detected as they emerge; cohort sizes updated daily.

---

## Feedback & Contributions

Phase priorities are informed by the OHDSI community and clinical research needs. If you're actively working on genomics, imaging, or health economics research on OMOP data and have requirements or data to test against, open an issue or start a discussion.

[github.com/sudoshi/Parthenon/issues](https://github.com/sudoshi/Parthenon/issues)
[github.com/sudoshi/Parthenon/discussions](https://github.com/sudoshi/Parthenon/discussions)

