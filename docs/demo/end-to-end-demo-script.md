# Parthenon End-to-End Demo Script

**Audience:** clinical researchers, informatics leaders, OHDSI collaborators, data platform teams  
**Default length:** 30-45 minutes  
**Short version:** 10-12 minutes, using the condensed path below  
**Demo premise:** start with a clinical research question, inspect the data, define the phenotype, run analyses, drill into patients, assemble a study, and close with operations and governance.

## Demo Story

Use this single narrative throughout:

> "We want to answer a real-world evidence question without moving between Atlas, WebAPI, Achilles, DataQualityDashboard, WhiteRabbit, Usagi, RStudio, a study tracker spreadsheet, and a separate patient viewer. Parthenon keeps the whole workflow in one governed application."

Suggested clinical question:

> "Among patients with type 2 diabetes, how do we identify a study-ready population, understand data quality, characterize baseline features, compare outcomes, inspect individual patient histories, and package the work for a federated study?"

For oncology-heavy demos, swap the question:

> "For a pancreatic cancer cohort, can we move from CDM characterization to patient timelines, labs, imaging, genomic context, and a study package without leaving the application?"

## Pre-Demo Checklist

Use production or a seeded local environment with at least one CDM source.

- App reachable at `https://parthenon.acumenus.net` or `http://localhost:8082`.
- A super-admin or researcher account can log in.
- A default CDM source is configured under **Clinical Data Models**.
- Demo data is present. Good sources to use:
  - **OHDSI Acumenus CDM** for broad population-level examples.
  - **Pancreas** for patient profiles, labs, imaging, genomics, and notes.
  - **IRSF Natural History Study** for rare-disease cohort and analysis examples.
  - **Eunomia GiBleed** as the smallest fallback demo source.
- Seeded design objects exist: concept sets, cohort definitions, analyses, studies.
- If showing rich analysis result charts, confirm completed executions or seed demo result JSON before the walkthrough.
- If showing AI, confirm the active AI provider under **Administration -> AI Provider Configuration**.
- If showing R sidecar execution, confirm **Administration -> System Health** marks the R runtime as healthy.
- If showing imaging, confirm Orthanc/OHIF services are healthy.

Useful local prep commands:

```bash
docker compose exec php php artisan admin:seed
docker compose exec php php artisan db:seed --class=RolePermissionSeeder
docker compose exec php php artisan db:seed --class=CohortDefinitionSeeder
docker compose exec php php artisan db:seed --class=ConceptSetSeeder
docker compose exec php php artisan db:seed --class=AnalysisSeeder
docker compose exec php php artisan db:seed --class=StudySeeder
docker compose exec php php artisan parthenon:load-eunomia
```

Production caution: do not run `php artisan db:seed` wholesale in production. `DatabaseSeeder` intentionally blocks in production; use individual safe seeders or existing production data.

Optional results demo, if your branch includes the demo result seeder:

```bash
docker compose exec php php artisan results:seed-demo
```

If that command is not available in the environment, use existing completed analyses and skip live result seeding. The results-specific mini-script is in `docs/devlog/modules/results-explorer/howto-demo-results-explorer.md`.

## Condensed 10-Minute Path

1. **Dashboard**: show one login, one source selector, source-aware CDM summary.
2. **Data Explorer**: open **Overview**, **Domains**, **Data Quality**, and **Ares**.
3. **Vocabulary Browser**: search `type 2 diabetes`, open a concept detail, mention hierarchy and semantic search.
4. **Cohort Definitions**: open a study-ready cohort, show **Expression Editor**, **SQL & Generation**, **Diagnostics**, **Patient List**, and **Abby AI**.
5. **Analyses**: open **Analyses**, switch through the seven type tabs, open one completed result.
6. **Studies**: open a study such as `LEGEND-T2DM`, show tabs: **Overview**, **Analyses**, **Results**, **Sites**, **Federated**.
7. **Patient Profiles**: open a known profile, show **Timeline**, **Labs**, **Notes**, **Precision Medicine**, and **Find Similar Patients**.
8. **Admin/System Health**: close by showing service health and role-governed operations.

## Full Script

### 0. Opening Frame

**Action:** Open Parthenon and log in.

**Say:**

> "Parthenon is a unified outcomes research platform for OMOP CDM. The key point is not just that it has many modules. It is that the workflow stays continuous: source registration, data quality, vocabulary, cohorts, analyses, studies, patient review, AI support, and operations all live in one governed app."

**Point out:**

- The left navigation groups the research lifecycle: data, vocabulary, cohorts and analyses, patient-level work, workbench tools, and administration.
- The header has the source selector, global controls, and the light/dark theme toggle.
- Theme preference persists per user, so the app can be demoed in either dark or light mode.

### 1. Dashboard: Orientation and Source Awareness

**Route:** `/`

**Action:**

1. Start on **Dashboard**.
2. Confirm the active source in the header.
3. Show the top metric cards: **CDM Sources**, **Running Jobs**, **Concept Sets**, **Active Cohorts**.
4. Scroll or point to **CDM Characterization**.
5. Click **View Full** to move to Data Explorer.

**Say:**

> "The dashboard is not a marketing page. It is a live operational view over the currently selected CDM. I can see whether sources exist, whether jobs are running, how many reusable concept sets and cohorts are available, and a quick clinical profile for the active source."

**Point out:**

- Person count, total events, data completeness, and domain counts.
- Demographic distribution and domain-level CDM coverage.
- Dashboard links are workflow links, not dead summary cards.

**Fallback:** If no source is selected, say:

> "This is the empty-state behavior: Parthenon asks me to select or configure a CDM source before making data claims."

Then go to **Clinical Data Models**.

### 2. Clinical Data Models: Source Registry and Default CDM

**Route:** `/data-sources`

**Action:**

1. Open **Clinical Data Models** from the sidebar.
2. Expand a source row.
3. Show source key, dialect, daimons, connection, and access controls.
4. Toggle or point at **My Default**.
5. Briefly open **Import from WebAPI** if relevant.
6. Mention **Add Source** without creating a new source unless this is a setup demo.

**Say:**

> "Each CDM is registered as a governed source, with daimons for CDM, vocabulary, and results schemas. Users can set a personal default source, so a researcher who mostly works in Pancreas or IRSF does not have to reselect it every time."

**Point out:**

- WebAPI import preserves migration paths from Atlas/WebAPI.
- Source access can be restricted by role.
- This is source registration, not data copying; CDM schemas can remain read-only.

**Do not click in a short demo:** live source creation, unless the audience is explicitly interested in deployment/setup.

### 3. Data Explorer: Data Quality and Characterization

**Route:** `/data-explorer` or `/data-explorer/:sourceId`

**Action:**

1. Open **Data Explorer**.
2. Show tabs: **Overview**, **Domains**, **Temporal**, **Achilles**, **Data Quality**, **Ares**.
3. In **Overview**, show record counts, demographics, and observation periods.
4. In **Domains**, click conditions, drugs, measurements, procedures, observations, and visits if data exists.
5. In **Temporal**, point to longitudinal coverage and trends.
6. In **Achilles**, show analysis catalog/runs if present.
7. In **Data Quality**, show checks and issue groups.
8. In **Ares**, show network-style reporting if releases exist.

**Say:**

> "Before we trust any effect estimate, we need to know what is in the CDM. This replaces the usual shuffle between Achilles output, DataQualityDashboard output, and custom SQL. The same source selector drives the view, so the cohort builder and analysis engine use the same data context."

**Point out:**

- Domain summaries answer "what data exists?"
- Temporal plots answer "when does it exist?"
- Achilles and DQD answer "can I trust this source for this question?"
- Ares-style releases give shareable, versioned data-quality reporting.

**Expensive action warning:** Do not run a full Achilles or DQD job live unless the demo is about operations. Say:

> "I would normally start a run from here, but for a live demo I am using precomputed results because full characterization can take minutes to an hour depending on source size."

### 4. Vocabulary Browser: From Clinical Language to OMOP Concepts

**Route:** `/vocabulary`

**Action:**

1. Search `type 2 diabetes` in **Keyword Search**.
2. Select a standard condition concept.
3. Show detail pane: concept metadata, relationships, ancestors, descendants, mappings.
4. Switch to **Semantic Search** and search a plain-language phrase like `newly diagnosed diabetes on metformin`.
5. Switch to **Browse Hierarchy** and show ancestor/descendant navigation.
6. Optional: open `/vocabulary/compare` and compare multiple concepts.

**Say:**

> "Vocabulary is where phenotype design becomes auditable. Researchers can search by keyword, use semantic search for clinical phrasing, inspect hierarchy, and see how source codes map into standard concepts."

**Point out:**

- Split-pane layout keeps search and detail visible together.
- Hierarchy browsing helps validate descendant expansion.
- Concept detail links are reused from patient timelines and cohort editors.

**Fallback:** If semantic search is unavailable, say:

> "Semantic search depends on the configured embedding/AI services. The keyword and hierarchy workflows still work against the OMOP vocabulary."

### 5. Concept Sets: Reusable Vocabulary Assets

**Route:** `/concept-sets`

**Action:**

1. Open **Concept Sets**.
2. Show stats, search, tag filters, and public/with-items quick filters.
3. Search for `HbA1c`, `heart failure`, `metformin`, or another seeded set.
4. Open an existing concept set.
5. Show included concepts, descendant logic, import/export, and source traceability.
6. Mention **From Bundle** for care bundle-derived concept sets.

**Say:**

> "Concept sets are reusable building blocks. A cohort definition, analysis, care gap measure, or study can reference the same curated concept set instead of every team recreating it from scratch."

**Point out:**

- Import supports Atlas compatibility.
- Tags and public flags support team reuse.
- Concept-set detail is where inclusion/exclusion decisions become explicit.

### 6. Cohort Definitions: Phenotyping, SQL, Generation, Diagnostics

**Route:** `/cohort-definitions`

**Action:**

1. Open **Cohort Definitions**.
2. Show stats, search, tags, domain grouping, and tier filters: **Study-Ready**, **Validated**, **Draft**.
3. Search for `diabetes`, `CKD`, `IRSF`, or `pancreas` depending on data.
4. Open a cohort such as **Type 2 Diabetes Mellitus Management** or an IRSF target cohort.
5. On the detail page, show:
   - editable title, description, tags, domain
   - **Public/Private**
   - **Export**, **Share**, **Copy**
   - **Abby AI**
6. Click through tabs:
   - **Expression Editor**
   - **SQL & Generation**
   - **Diagnostics**
   - **Overlap**
   - **Patient List**

**Say:**

> "This is the Atlas-compatible cohort workspace. The expression is structured, the SQL is previewable, generation history is tracked, diagnostics are in the same page, and the patient list lets us drill from population definition down to individual records."

**For Abby AI:**

**Action:** Click **Abby AI**. Use:

```text
Patients with type 2 diabetes newly started on metformin after age 40 with no prior insulin use.
```

**Say:**

> "Abby can draft a structured OMOP cohort expression from clinical language. I still review and apply it as a human-in-the-loop step; it does not silently change the phenotype."

**For SQL & Generation:**

**Say:**

> "The SQL preview is important for transparency. This lets informaticists validate what the Circe-style expression compiles to before generation runs against the CDM."

**Expensive action warning:** If the source is large, do not click **Generate** live unless you already know it is fast.

**Diagnostics talking point:**

> "Cohort diagnostics are the bridge between 'the expression compiled' and 'this is study-ready.' I can check counts, attrition, observation time, visit context, and age at index from the same page."

**Patient list bridge:**

> "From here I can move directly from a generated cohort to members, then into patient timelines."

### 7. Analyses: Seven Study Engines in One Index

**Route:** `/analyses`

**Action:**

1. Open **Analyses**.
2. Show search: **Search across all analyses...**
3. Click the tabs:
   - **Characterizations**
   - **Incidence Rates**
   - **Pathways**
   - **Estimations**
   - **Predictions**
   - **SCCS**
   - **Evidence Synthesis**
4. Open **New Analysis** dropdown to show all analysis types, then close it.
5. Open a completed or seeded analysis, ideally:
   - **T2DM Patient Characterization**
   - **New-Onset CKD in T2DM Patients**
   - **Statin Effect on CAD Outcomes**
   - **CKD Progression Risk Model**
   - **NSAID Exposure and GI Bleeding**

**Say:**

> "Analyses are not separate apps. The same cohorts and concept sets feed characterization, incidence rates, pathways, population-level estimation, patient-level prediction, SCCS, and evidence synthesis."

**When showing results, point out by type:**

- Characterization: feature tables, domain tabs, covariate balance.
- Incidence rates: time-at-risk rates and strata.
- Pathways: treatment sequences and attrition through event order.
- Estimation: hazard ratios, forest plot, propensity score diagnostics, Kaplan-Meier curves, love plot, systematic error, power.
- Prediction: ROC, calibration, precision-recall, decision curve, top predictors, external validation.
- SCCS: incidence rate ratios and risk windows.
- Evidence synthesis: cross-analysis estimates and synthesis methods.

**Fallback:** If the selected analysis has no completed result:

> "This design page is the pre-execution state. In a prepared demo I would open a completed execution; the results explorer renders once the R sidecar or built-in execution returns result JSON."

### 8. Studies: Protocol, Execution, Sites, Results, Federation

**Route:** `/studies`

**Action:**

1. Open **Studies**.
2. Toggle table/card view.
3. Use **Search studies...** and filter chips for status, type, priority.
4. Click a stat card such as **Active** or **In Progress** to show drilldown.
5. Open a study, for example **LEGEND-T2DM: Large-scale Evidence Generation for Diabetes Management**.
6. Show header badges, status transition dropdown, duplicate/export/archive controls.
7. Click through tabs:
   - **Overview**
   - **Design**
   - **Analyses**
   - **Results**
   - **Progress**
   - **Sites**
   - **Team**
   - **Cohorts**
   - **Milestones**
   - **Artifacts**
   - **Activity**
   - **Federated**

**Say:**

> "The study layer turns individual design artifacts into a coordinated research project. It tracks protocol details, cohorts, analyses, results, milestones, participating sites, team membership, artifacts, and federated execution."

**Point out:**

- Studies replace a spreadsheet-driven coordination workflow.
- The **Results** tab is the bridge from analysis execution to publication.
- The **Federated** tab is where multi-site execution becomes operational.
- The **Activity** tab gives a provenance trail around study work.

**Optional publish bridge:** If completed analyses exist and the **Manuscript** button appears:

> "When analyses complete, Parthenon can hand off to the publish workflow for manuscript-style outputs."

### 9. Patient Profiles: Population-to-Patient Drilldown

**Route:** `/profiles` or `/profiles/:personId?sourceId=:sourceId`

**Good prepared examples:**

- Pancreas: person `178` if the Pancreas source is loaded.
- Acumenus/imaging remediation notes reference person `1005788`; use only if the environment has that source and profile data.

**Action:**

1. Open **Patient Profiles**.
2. Use a recent profile, cohort member list, or direct route to a known person.
3. Show patient header, demographics, event counts, and source selector.
4. Click view buttons:
   - **Timeline**
   - **List**
   - **Labs**
   - **Imaging**
   - **Visits**
   - **Notes**
   - **Eras**
   - **Precision Medicine**
5. In **List**, show domain tabs and grouped concepts.
6. In **Labs**, expand a lab row and show trend chart, reference range band, and "Show values."
7. In **Notes**, show clinical notes if present.
8. In **Imaging**, show patient imaging timeline if present.
9. In **Precision Medicine**, show radiogenomics/genomics context if present.
10. Click **Find Similar Patients** to bridge to Patient Similarity.

**Say:**

> "After building a cohort and running population-level analyses, researchers often need to understand what the data means at the patient level. The profile view provides a longitudinal timeline, grouped clinical events, labs with reference ranges, visits, notes, imaging, and precision medicine context where available."

**Labs talking point:**

> "The lab chart uses curated reference ranges first and per-source population percentiles as fallback. That means the trend is visually interpretable even when the CDM measurement table did not provide range_low and range_high."

**Fallback:** If a view has no data, say:

> "These modules render honestly from source data. If this patient has no imaging, notes, or genomic context, Parthenon shows that rather than fabricating a panel."

### 10. Patient Similarity: Cohort Profiles, Matching, Landscape

**Route:** `/patient-similarity`

**Action:**

1. Open **Patient Similarity** from **Patient Profiles -> Find Similar Patients** or the sidebar.
2. Select the source.
3. Choose a target cohort.
4. Select mode:
   - expand/search mode for "find similar patients from a cohort centroid"
   - compare mode for "compare target and comparator cohorts"
5. Open settings to show feature weights, age range, gender filter, and similarity mode.
6. Run the first comparison only if demo data is known to respond quickly.
7. Walk the pipeline:
   - cohort centroid/profile
   - similar patients
   - cohort profile comparison
   - covariate balance
   - propensity score matching
   - landscape projection
   - phenotype discovery
   - network fusion

**Say:**

> "Patient Similarity is where cohort-level reasoning and patient-level reasoning meet. The workflow can start from a cohort centroid to find similar patients, or compare two cohorts, assess balance, run propensity score matching, project the patient landscape, and discover phenotypes."

**Point out:**

- The pipeline is stepwise so users can inspect intermediate outputs.
- PSM and balance make the analysis more explainable than a black-box nearest-neighbor list.
- Landscape and phenotype panels support exploratory cohort refinement.

**Fallback:** If the similarity endpoint is not seeded:

> "The UI still shows the intended analytical progression. For this environment, I would use a prepared source with patient feature vectors to run the pipeline live."

### 11. Ingestion and Data Engineering: From Raw Data to CDM

**Route:** `/ingestion`

**Action:**

1. Open **Data Ingestion**.
2. Show tabs:
   - **Ingestion**
   - **Source Profiler**
   - **Aqueduct**
   - **Poseidon**
   - **Vulcan**
3. In **Ingestion**, show projects/uploads if present.
4. In **Source Profiler**, explain schema profiling and WhiteRabbit/BlackRabbit replacement.
5. In **Aqueduct**, explain ETL mapping canvas.
6. In **Poseidon**, explain Dagster/dbt orchestration and freshness.
7. In **Vulcan**, explain FHIR ingestion projects.

**Say:**

> "The same product that consumes OMOP data also helps build and maintain it. Uploads, profiling, schema mapping, FHIR ingestion, and data lakehouse orchestration are part of the same workflow, which matters for teams that own both ETL and research delivery."

**Do not do live uploads** unless the demo is specifically about ingestion.

### 12. Specialty Modules: Show Breadth Without Losing the Story

Use this section as optional add-ons depending on audience.

#### Genomics

**Route:** `/genomics`

**Say:**

> "Genomics supports VCF imports, variant analysis, ClinVar sync, and tumor-board style review. In patient profiles, this context appears through precision medicine panels when linked to a person."

#### Imaging

**Route:** `/imaging`

**Say:**

> "Imaging integrates DICOM studies through Orthanc/OHIF, with AI feature and radiogenomics hooks where available."

#### HEOR

**Route:** `/heor`

**Say:**

> "HEOR covers claims-oriented analyses and economic evidence views, so the same CDM-backed research workflow can extend into utilization and cost evidence."

#### GIS Explorer

**Route:** `/gis`

**Say:**

> "GIS Explorer brings in social determinants, air quality, hospital access, rurality, and comorbidity layers for geographically-aware analyses."

#### Care Gaps

**Route:** `/care-gaps`

**Say:**

> "Care gaps translate cohorts into quality measures and bundle compliance, useful for operational clinical programs as well as research."

#### Risk Scores and Standard PROs+

**Routes:** `/risk-scores`, `/standard-pros`

**Say:**

> "Risk scores and Standard PROs+ extend the evidence workflow into validated instruments, survey capture, and cohort-scoped scoring."

### 13. Commons, Abby, Query Assistant, Workbench

#### Commons

**Route:** `/commons`

**Action:** Open Commons and show channels, wiki/knowledge context, and Abby surfaces if seeded.

**Say:**

> "Commons is the collaborative layer. It is where teams can coordinate around cohorts, analyses, review requests, and institutional knowledge without leaving the research workspace."

#### Query Assistant

**Route:** `/query-assistant`

**Action:** Ask a safe read-only question such as:

```text
Show a SQL query that counts persons by year of birth in the active CDM.
```

**Say:**

> "Query Assistant supports text-to-SQL and data interrogation with a dialect-aware workflow. It is useful for exploratory questions, but it still keeps SQL visible for review."

#### Workbench

**Route:** `/workbench`

**Say:**

> "Workbench is the exploratory analysis area for investigation-driven workflows, including evidence boards and external research tool integrations."

### 14. Publish: From Results to Artifacts

**Route:** `/publish`

**Action:** Open **Publish** directly or from a study's **Manuscript** button when available.

**Say:**

> "Publish is the final mile: once study analyses are complete, the platform can organize results into shareable artifacts rather than leaving researchers to manually assemble screenshots and tables."

**Point out:**

- Study-driven manuscript flow.
- Tables/figures from completed analyses.
- Export-oriented workflow.

### 15. Administration and Governance

**Route:** `/admin`

**Action:**

1. Open **Administration**.
2. Show key cards.
3. Open **System Health**.
4. Drill into a service card if healthy data exists.
5. Open **AI Provider Configuration** if relevant.
6. Mention **Users**, **Roles & Permissions**, **Audit Log**, **Auth Providers**, **FHIR EHR Connections**, **Solr Search Administration**, and **Notifications**.

**Say:**

> "This is not just a research UI. It is an operational platform. Administrators can manage users, roles, auth providers, AI providers, FHIR connections, Solr, system health, notifications, and audit logs from the same place."

**System Health close:**

> "For demos, system health is a strong closing slide because it shows all the sidecars behind the unified experience: PHP/Laravel, frontend, Postgres, Redis, AI services, R runtime, Orthanc/OHIF, Solr, and the data pipeline services."

## Closing Script

**Say:**

> "The main takeaway is continuity. We started with a research question, checked the source, inspected vocabulary, reused concept sets, built a cohort, reviewed SQL and diagnostics, ran or opened analyses, packaged the work into a study, drilled into patients, and closed with operational governance. That is the difference between a toolkit and a platform."

Then offer one targeted follow-up:

- For researchers: "Next, I would show a fully completed LEGEND-style study and walk the results tabs in depth."
- For informatics teams: "Next, I would show source registration, ingestion, data quality, and system health in more detail."
- For executives: "Next, I would show the 10-minute workflow with the RWE lifecycle mapped to time saved across tools."
- For technical evaluators: "Next, I would show the API, route map, deployment path, and CI gates."

## Demo Branches by Audience

| Audience | Emphasize | De-emphasize |
|---|---|---|
| Clinical researchers | cohorts, diagnostics, analyses, patient profiles, studies | deployment details |
| OHDSI collaborators | Atlas compatibility, Circe JSON, WebAPI import, Strategus/studies, federated execution | visual theme details |
| Data engineers | data sources, ingestion, source profiler, Aqueduct, Poseidon, DQD, system health | manuscript workflow |
| Executives | one platform, reduced tool switching, governance, study tracking | detailed SQL |
| AI-focused audience | Abby AI, semantic search, query assistant, mapping assistant, provider config | manual cohort editing |
| Oncology audience | Pancreas source, patient labs, imaging, genomics, precision medicine, radiogenomics | diabetes examples |

## Live Demo Risk Matrix

| Risk | Symptom | Recovery |
|---|---|---|
| No active source | Dashboard/Data Explorer empty state | Go to **Clinical Data Models**, set **My Default**, return |
| Source has sparse data | Domain tabs look empty | Switch to Acumenus, Pancreas, IRSF, or Eunomia |
| AI provider down | Abby or semantic search errors | Use keyword search and explain provider gating |
| R runtime down | Estimation/PLP execution cannot run | Open precomputed completed results |
| Long-running Achilles/cohort generation | Spinner during demo | Stop narrating live execution; show precomputed generation history |
| Imaging services down | OHIF/Orthanc panel unavailable | Show patient timeline/labs and system health service status |
| No patient profile for ID | Profile error state | Use cohort patient list or a recent profile instead |
| No completed study results | Results tab empty | Open **Analyses** and use a completed seeded analysis |

## Route Cheat Sheet

| Module | Route |
|---|---|
| Dashboard | `/` |
| Clinical Data Models | `/data-sources` |
| Data Ingestion | `/ingestion` |
| Data Explorer | `/data-explorer` |
| Vocabulary Browser | `/vocabulary` |
| Concept Compare | `/vocabulary/compare` |
| Mapping Assistant | `/mapping-assistant` |
| Cohort Definitions | `/cohort-definitions` |
| Concept Sets | `/concept-sets` |
| Analyses | `/analyses` |
| Studies | `/studies` |
| Study Packages | `/study-packages` |
| Phenotype Library | `/phenotype-library` |
| Patient Profiles | `/profiles` |
| Patient Similarity | `/patient-similarity` |
| Risk Scores | `/risk-scores` |
| Standard PROs+ | `/standard-pros` |
| Care Gaps | `/care-gaps` |
| Genomics | `/genomics` |
| Imaging | `/imaging` |
| HEOR | `/heor` |
| GIS Explorer | `/gis` |
| Query Assistant | `/query-assistant` |
| Workbench | `/workbench` |
| Publish | `/publish` |
| Jobs | `/jobs` |
| Administration | `/admin` |
| System Health | `/admin/system-health` |
| AI Providers | `/admin/ai-providers` |
| FHIR Connections | `/admin/fhir-connections` |
| FHIR Export | `/admin/fhir-export` |

## Presenter Notes

- Prefer opening existing seeded objects to creating new ones live.
- Avoid expensive run buttons unless the run is intentionally part of the demo.
- Keep a known patient profile route in a browser tab before starting.
- Keep a completed analysis result in a browser tab before starting.
- Keep **System Health** in a browser tab; it is the best recovery screen when a sidecar is down.
- If production data differs from local data, narrate the workflow and avoid making numeric claims unless the number is visible on screen.
- Use the light/dark toggle as a quick polish moment, not a central feature unless the audience asks about UX.
- When asked "what replaces Atlas?", answer: vocabulary, concept sets, cohort definitions, Circe-style SQL generation, import/export compatibility, and study orchestration.
- When asked "what replaces DataQualityDashboard/Achilles?", answer: Data Explorer, Achilles tab, Data Quality tab, Ares reporting, and system-tracked runs.
- When asked "what replaces R/Shiny result viewers?", answer: built-in result visualizations for estimation, prediction, characterization, incidence, SCCS, diagnostics, and study results.
- When asked "how is this governed?", answer: RBAC, per-source restrictions, audit logs, admin pages, health checks, role-gated endpoints, and explicit human review for AI-assisted edits.

## Screenshot Checklist

- Dashboard with CDM characterization.
- Data Explorer overview and Ares/Data Quality tabs.
- Vocabulary split-pane concept detail.
- Cohort detail with **Expression Editor** and **SQL & Generation**.
- Cohort diagnostics with attrition/diagnostic panels.
- Analyses index showing all seven analysis type tabs.
- One completed estimation or prediction result.
- Study detail with tabs and progress/status.
- Patient profile timeline.
- Patient labs trend chart with reference range band.
- Patient Similarity pipeline after one completed step.
- System Health service grid.
