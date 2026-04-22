# i18n Full Frontend Scanner Backlog Triage

Date: 2026-04-21

Source command:

```bash
cd frontend
npm run i18n:scan
```

Current scanner output:

- Full frontend scanner: 786 candidates across 1,125 scanned files.
- FinnGen paths excluded from this i18n track: 372 candidates.
- Non-FinnGen backlog for this triage: 414 candidates.
- Candidate kinds after FinnGen exclusion: 414 object properties.
- Dedicated release-facing shell scan: `npm run i18n:scan:app-priority` reports 0 candidates across 214 files.

Use the dedicated `npm run i18n:scan:app-priority` script plus the focused wave scanners below as the operational completion gates for this extraction program. The unsupported ad hoc `npm run i18n:scan -- --app-priority` invocation should not be used for milestone accounting.

## Classification

| Class | Candidates | Files | Disposition |
| --- | ---: | ---: | --- |
| Cohort authoring and diagnostics | 0 | 62 | Completed for `src/features/cohort-definitions`. Focused wave scanner reports 0 candidates across cohort list/detail, expression editor, validation, diagnostics, attrition, patient list, Circe SQL, wizard, and shared cohort surfaces. |
| Analysis design and results | 0 | 75 | Completed for `src/features/analyses`, `src/features/estimation`, `src/features/prediction`, `src/features/pathways`, `src/features/sccs`, `src/features/self-controlled-cohort`, and `src/features/evidence-synthesis`. Focused analytics wave scanner reports 0 candidates across gallery/list, characterization, incidence-rate, estimation, prediction, pathways, SCCS, self-controlled-cohort, and evidence-synthesis designer/results/verdict/detail surfaces. |
| Data source setup and ingestion | 0 | 46 | Completed for `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome. Focused wave scanner reports 0 candidates. |
| Standard PROs UI | 0 | 10 | Completed for `src/features/standard-pros/components`, `src/features/standard-pros/pages`, and user-facing helper paths under `src/features/standard-pros/lib`. The focused Standard PROs UI scanner reports 0 candidates; the remaining full-feature candidates are intentionally confined to the curated instrument catalog file. |
| Imaging, genomics, and radiogenomics | 0 | 27 | Completed for `src/features/imaging`, `src/features/genomics`, and `src/features/radiogenomics`. Focused wave scans report 0 candidates across the imaging (14 files), genomics (9 files), and radiogenomics (4 files) scopes, with DICOM/OHIF/PACS identifiers, measurement units, and backend significance matching keys protected where needed. |
| Strategus and study packages | 0 | 6 | Completed for `src/features/strategus`. Focused Strategus wave scanner reports 0 candidates across the study package page, module config panels, JSON spec editor, and Strategus helper/type metadata. Module names, JSON keys, and OHDSI package identifiers remain protected with explicit exemptions. |
| Investigation clinical workflows | 0 | 63 | Completed for `src/features/investigation`. Focused investigation wave scanner reports 0 candidates across the landing/new-investigation shell, phenotype builder/validation/codewas/cohort tooling, clinical gallery/config/tracking/history/results, genomic evidence search/upload/chart/table surfaces, synthesis dossier/export/versioning, and shared investigation-side panels. Clinical/source values, concept IDs, JSON keys, scientific shorthand, and OHDSI/FinnGen identifiers remain protected where needed. |
| Profiles and patient similarity | 0 | 72 | Completed for `src/features/profiles` and `src/features/patient-similarity`. Focused wave scanner reports 0 candidates across patient profile search/browse/header/timeline/labs/visits/notes/eras surfaces plus similarity workspace, comparison, diagnostics, cohort actions, trajectory/radar/divergence charts, and matching/landscape panels. |
| Publish, care gaps, and risk scores | 0 | 75 | Completed for `src/features/publish`, `src/features/care-gaps`, and `src/features/risk-scores`. The focused wave scanner reports 0 candidates across publish wizard/template/export surfaces, care-gap bundle/evaluation/population surfaces, and risk-score workflow/detail/result surfaces. |
| Generated/static/curated data | 414 | 2 | This is now the entire remaining non-FinnGen backlog, dominated by `src/features/etl/lib/cdm-schema-v54.ts` and `src/features/standard-pros/data/instruments.ts`. Do not machine-translate as UI copy; requires curated terminology/data asset handling. |
| HEOR | 0 | 13 | Completed for `src/features/heor`. Focused HEOR wave scanner reports 0 candidates across the hub, analysis detail workspace, claims explorer, budget-impact chart, cost-effectiveness plane, scenario comparison chart, tornado diagram, and supporting HEOR label helpers. Payer terminology, Solr command text, currency figures, and ICER/QALY shorthand remain protected where needed. |
| Morpheus | 0 | 33 | Completed for `src/features/morpheus`. Focused Morpheus wave scanner reports 0 candidates across the dashboard, patient journey, location track, medication timeline, concept drawer, microbiology/antibiogram views, labs, vitals, dataset selector, export, and supporting Morpheus label helpers/constants. Microbiology/source terminology, organism names, specimen labels, antibiotic names, units, and dataset/source identifiers remain protected where needed. |
| ETL source profiler and Aqueduct | 0 | 19 | Completed for the live profiler chrome and Aqueduct canvas/editor surfaces. The focused wave scanner reports 0 candidates across the source-profiler page, profiler support components, and Aqueduct modals/editors. Table/schema/file identifiers, CDM column names, and the static `cdm-schema-v54.ts` standards documentation remain protected where needed. |
| GIS, Poseidon, code tools, text-to-SQL, Jupyter | 0 | 90 | Completed for `src/features/gis`, `src/features/poseidon`, `src/features/code-explorer`, `src/features/text-to-sql`, and `src/features/jupyter`. The focused wave scanner reports 0 candidates across GIS layers/detail panels, Poseidon orchestration, code-explorer chrome, text-to-SQL/query-library/query-runner surfaces, and the Jupyter workbench. Translation-key tokens, units, backend/source-driven labels, and tool/protocol identifiers remain protected where needed. |
| Concept sets and shared research primitives | 0 | 19 | Completed for `src/features/concept-sets`, `src/components/concept/ConceptSearchInput.tsx`, `src/components/charts/SignificanceVerdictBadge.tsx`, and `src/components/workbench/primitives.tsx`. The focused wave scanner reports 0 candidates across concept-set list/detail/builder/import/bundle/Phoebe/item-detail surfaces plus the shared concept-search, verdict badge, and workbench status-strip primitives. Separator glyphs and data-driven clinical/source values remain protected where needed. |
| Legacy Abby AI panel | 0 | 10 | Completed for `src/features/abby-ai`, including the legacy cohort-builder side panel, action-plan card, and research-profile panel. The focused Abby wave scanner reports 0 candidates across 10 files. Remaining action-plan step labels and result payloads are explicitly treated as dynamic/internal tool data rather than static UI chrome. |
| Other small workbench surfaces | 0 | 14 | Completed for `src/features/study-agent`, `src/features/phenotype-library`, `src/features/community-workbench-sdk`, `src/features/workbench`, and `src/features/etl/pages/EtlToolsPage.tsx`, plus the supporting phenotype/workbench helper layers. The focused wave scanner reports 0 candidates across Study Designer, phenotype library, community workbench SDK, workbench launcher/card, and ETL-tools chrome. FinnGen-branded launcher copy remains explicitly deferred with `i18n-exempt` handling per the scoped FinnGen exclusion. |

## Top Non-FinnGen Files

| Candidates | File |
| ---: | --- |
| 315 | `src/features/etl/lib/cdm-schema-v54.ts` |
| 99 | `src/features/standard-pros/data/instruments.ts` |

## Recommended Extraction Order

1. Data-source setup and ingestion. Completed 2026-04-20.
   Scope completed: `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome. Source names, schema names, auth schemes, URLs, examples, FHIR/OMOP/CDM tokens, and visual separators were kept protected.

2. Cohort authoring and diagnostics. Completed 2026-04-20.
   Scope completed: `src/features/cohort-definitions` across list/detail, expression editor, validation, diagnostics, attrition, patient list, Circe SQL, wizard, temporal preset, and shared cohort surfaces. Clinical/source labels, generated SQL, JSON, and OHDSI/Circe identifiers were kept protected.

3. Analysis design and results. Completed 2026-04-20.
   Scope completed: `src/features/analyses`, `src/features/estimation`, `src/features/prediction`, `src/features/pathways`, `src/features/sccs`, `src/features/self-controlled-cohort`, and `src/features/evidence-synthesis`. The focused analytics wave command reports 0 candidates across 75 files. Statistical method labels, package names, and source-data values remain protected where needed.

4. Standard PROs UI. Completed 2026-04-20.
   Scope completed: `src/features/standard-pros/components`, `src/features/standard-pros/pages`, and user-facing import/error helpers under `src/features/standard-pros/lib`. The focused wave command reports 0 candidates across 10 files. The full `src/features/standard-pros` folder is down to 99 candidates across 23 files, all intentionally confined to `src/features/standard-pros/data/instruments.ts` as curated instrument content rather than generic UI copy.

5. Imaging, genomics, and radiogenomics. Completed 2026-04-21.
   Scope completed: `src/features/imaging`, `src/features/genomics`, and `src/features/radiogenomics`, including imaging page chrome, DICOM import, measurement/response panels, study viewer chrome, genomics uploads/ClinVar/analysis/tumor board surfaces, and the precision medicine tab. The focused wave scans report 0 candidates across 27 files. DICOM, PACS, OHIF, modality names, measurements, units, accession IDs, and backend significance matching keys remain protected where needed.

6. Strategus and study packages. Completed 2026-04-21.
   Scope completed: `src/features/strategus` module config panels, study package page, JSON spec editor, and Strategus metadata helpers. The focused wave scanner reports 0 candidates across 6 files. Strategus module names, JSON keys, OHDSI package identifiers, and generated specification text remain protected with explicit `i18n-exempt` annotations where needed.

7. Profiles and patient similarity. Completed 2026-04-21.
   Scope completed: `src/features/profiles` and `src/features/patient-similarity`. The focused wave scanner reports 0 candidates across 72 files. Patient/person labels, source-controlled clinical values, concept IDs, MRNs, vocabulary routes, trajectory math labels, and research identifiers remain protected where needed while the surrounding UI chrome now uses app i18n resources.

8. Publish, care gaps, and risk scores. Completed 2026-04-21.
   Scope completed: `src/features/publish`, `src/features/care-gaps`, and `src/features/risk-scores`. The focused wave scanner reports 0 candidates across 75 files. Publish templates, export chrome, table captions/headers, care-gap bundle/evaluation/population workflow surfaces, and risk-score hub/create/detail/results chrome now resolve through app i18n resources, while study titles, clinical/source values, concept IDs, JSON, and standards identifiers remain protected where needed.

9. Investigation clinical workflows. Completed 2026-04-21.
   Scope completed: `src/features/investigation` across landing/new-investigation shell, phenotype builder/validation/codewas/cohort tooling, clinical gallery/config/tracking/history/results, genomic evidence search/upload/chart/table surfaces, synthesis dossier/export/versioning, and shared investigation-side panels. The focused wave scanner reports 0 candidates across 63 files. Clinical/source values, concept IDs, JSON keys, scientific shorthand, and OHDSI/FinnGen identifiers remain protected where needed.

10. HEOR. Completed 2026-04-21.
   Scope completed: `src/features/heor` across the HEOR hub, analysis detail workspace, claims explorer, budget-impact chart, cost-effectiveness plane, scenario comparison chart, tornado diagram, and supporting HEOR label helpers. The focused wave scanner reports 0 candidates across 13 files. Payer terminology, Solr command text, currency figures, and ICER/QALY shorthand remain protected where needed.

11. Morpheus. Completed 2026-04-21.
   Scope completed: `src/features/morpheus` across the dashboard, patient journey, location track, medication timeline, diagnoses summary, labs, vitals, microbiology/antibiogram views, concept drawer, dataset selector, export flow, and Morpheus label helpers/constants. The focused Morpheus wave scanner reports 0 candidates across 33 files. Microbiology/source terminology, organism names, specimen labels, antibiotic names, units, and dataset/source identifiers remain protected where needed while the surrounding inpatient workflow chrome now resolves through app i18n resources.

12. ETL source profiler and Aqueduct. Completed 2026-04-21.
   Scope completed: `src/features/etl/pages/SourceProfilerPage.tsx`, profiler support components (`ScanHistorySidebar`, `ScanProgressIndicator`, `CompletenessHeatmap`, `DataQualityScorecard`, `TableSizeChart`, `FkRelationshipGraph`, `TableAccordion`, `PiiBadge`, and `profiler-badges`), and the Aqueduct canvas/modal/editor surfaces under `src/features/etl/components/aqueduct`. The focused wave scanner reports 0 candidates across 19 files. Table names, schema names, CDM column identifiers, OMOP/FHIR/SQL/JSON tokens, and the static `src/features/etl/lib/cdm-schema-v54.ts` standards documentation remain protected where needed while the surrounding ETL workflow chrome now resolves through app i18n resources.

13. GIS / Poseidon / code tools / text-to-SQL / Jupyter. Completed 2026-04-21.
   Scope completed: `src/features/gis`, `src/features/poseidon`, `src/features/code-explorer`, `src/features/text-to-sql`, and `src/features/jupyter`. The focused wave scanner reports 0 candidates across 90 files. Translation-key identifiers, units, backend/source-driven labels, and tool/protocol identifiers remain protected where needed.

14. Concept sets and shared research primitives. Completed 2026-04-21.
   Scope completed: `src/features/concept-sets`, `src/components/concept/ConceptSearchInput.tsx`, `src/components/charts/SignificanceVerdictBadge.tsx`, and `src/components/workbench/primitives.tsx`. The focused wave scanner reports 0 candidates across 19 files. Separator glyphs, data-driven vocabulary/source values, and run-status payload values remain protected where needed while the surrounding concept-set workflow chrome now resolves through app i18n resources.

15. Small workbench bundle. Completed 2026-04-21.
   Scope completed: `src/features/study-agent`, `src/features/phenotype-library`, `src/features/community-workbench-sdk`, `src/features/workbench`, and `src/features/etl/pages/EtlToolsPage.tsx`, plus the supporting phenotype/workbench helper layers. The focused wave scanner reports 0 candidates across 14 files. FinnGen-branded launcher copy remains explicitly deferred with `i18n-exempt` handling per the scoped FinnGen exclusion.

16. Legacy Abby AI panel. Completed 2026-04-21.
   Scope completed: `src/features/abby-ai`, including the legacy cohort-builder side panel, action-plan card, and research-profile panel. The focused wave scanner reports 0 candidates across 10 files. Dynamic plan step labels and result payloads remain treated as internal/tool-generated data rather than static UI chrome.

17. Generated/static policy bucket only.
   The ordinary non-FinnGen app-surface extraction backlog is now exhausted. The remaining non-FinnGen candidates are entirely concentrated in `src/features/etl/lib/cdm-schema-v54.ts` and `src/features/standard-pros/data/instruments.ts`, which stay in the generated/static-data policy bucket rather than the ordinary UI-string workflow.

## Generated/Static Data Policy

The scanner intentionally reports static descriptions and clinical/source-like data so they do not disappear from view, but these should not be bulk-translated as ordinary interface strings:

- `src/features/etl/lib/cdm-schema-v54.ts` contains OMOP CDM schema/table/field descriptions. Treat this as standards documentation or source terminology.
- `src/features/standard-pros/data/instruments.ts` contains instrument content. Treat it as curated instrument metadata; do not machine-translate validated instrument text.
- Morpheus antibiotic classes and microbiology labels now follow a terminology policy rather than a simple UI translation pass; keep using that exemption pattern if the underlying source/codelist content expands.
- Strategus type/module constants should preserve package/module identifiers and only translate surrounding UI chrome.

## Intentional Exemptions To Add During Waves

When each wave touches its files, add `i18n-exempt` comments for scanner hits that are not translatable UI copy:

- visual separators such as `·`, dashes, bullets, and compact chart glyphs;
- product and protocol identifiers such as OMOP, OHDSI, CDM, DICOM, PACS, OHIF, Strategus, Circe, JSON, SQL, FHIR, and package names;
- URLs, filenames, paths, auth scheme examples, and code samples;
- clinical/source-data values that must remain as source vocabulary, source labels, or curated terminology;
- measurement units and compact statistical labels where translation would change semantics.

## Completion Rule For Each Future Wave

Each extraction wave should finish with:

- focused scanner command for the wave reporting 0 actionable candidates or documented exemptions;
- the current full/frontend app-priority scanner counts documented without masking regressions;
- `npm run i18n:report` with 100% key presence and no missing keys;
- focused frontend typecheck, ESLint, and i18n Vitest coverage;
- browser smoke for at least English, Spanish, Korean, Hindi, one CJK locale, and one European Wave 1 locale when the surface is route-visible;
- no FinnGen paths unless that scope is explicitly reopened.
