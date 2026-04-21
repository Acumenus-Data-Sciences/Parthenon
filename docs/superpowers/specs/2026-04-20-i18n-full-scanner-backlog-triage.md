# i18n Full Frontend Scanner Backlog Triage

Date: 2026-04-21

Source command:

```bash
cd frontend
npm run i18n:scan
```

Current scanner output:

- Full frontend scanner: 1,749 candidates across 1,112 scanned files.
- FinnGen paths excluded from this i18n track: 372 candidates.
- Non-FinnGen backlog for this triage: 1,377 candidates.
- Candidate kinds after FinnGen exclusion: 673 JSX text, 615 object properties, 89 JSX attributes.
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
| Generated/static/curated data | 526 | 8 | Do not machine-translate as UI copy. Requires curated terminology/data asset handling. |
| HEOR | 135 | 7 | Later specialty wave. Protect currency, claims, ICER/QALY, and payer terminology. |
| Morpheus | 152 | 25 | Later specialty wave. Treat microbiology/antibiogram constants as curated/source terminology. |
| ETL source profiler and Aqueduct | 152 | 16 | Later data-engineering wave. Protect table, schema, file, and mapping identifiers. |
| GIS, Poseidon, code tools, text-to-SQL, Jupyter | 257 | 41 | Later technical-tooling wave. Many strings are command/tool labels or examples. |
| Concept sets and shared research primitives | 98 | 13 | Later shared research wave. Some scanner hits are separators/proper nouns and should become exemptions. |
| Legacy Abby AI panel | 30 | 3 | Decide whether this surface is still active before extraction; current layout Abby resources are already localized. |
| Other small workbench surfaces | 64 | 4 | Bundle with the nearest product-area wave. |

## Top Non-FinnGen Files

| Candidates | File |
| ---: | --- |
| 315 | `src/features/etl/lib/cdm-schema-v54.ts` |
| 99 | `src/features/standard-pros/data/instruments.ts` |
| 36 | `src/features/heor/pages/HeorPage.tsx` |
| 36 | `src/features/morpheus/constants/antibioticClasses.ts` |
| 34 | `src/features/poseidon/pages/PoseidonPage.tsx` |
| 31 | `src/features/heor/components/ClaimsExplorer.tsx` |
| 30 | `src/features/heor/pages/HeorAnalysisPage.tsx` |
| 30 | `src/features/jupyter/pages/JupyterPage.tsx` |
| 29 | `src/features/etl/components/aqueduct/FieldMappingDetail.tsx` |
| 29 | `src/features/etl/pages/SourceProfilerPage.tsx` |
| 29 | `src/features/study-agent/pages/StudyDesignerPage.tsx` |
| 27 | `src/features/morpheus/pages/PatientJourneyPage.tsx` |
| 22 | `src/features/phenotype-library/pages/PhenotypeLibraryPage.tsx` |

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

10. Later specialty waves.
   HEOR, Morpheus, ETL source profiler/Aqueduct, GIS/Poseidon/code tools, concept-set shared primitives, and remaining workbench surfaces should follow after the completed waves above. The next highest-value non-FinnGen app wave is now HEOR.

## Generated/Static Data Policy

The scanner intentionally reports static descriptions and clinical/source-like data so they do not disappear from view, but these should not be bulk-translated as ordinary interface strings:

- `src/features/etl/lib/cdm-schema-v54.ts` contains OMOP CDM schema/table/field descriptions. Treat this as standards documentation or source terminology.
- `src/features/standard-pros/data/instruments.ts` contains instrument content. Treat it as curated instrument metadata; do not machine-translate validated instrument text.
- Morpheus antibiotic classes and microbiology labels should follow a terminology policy, not a simple UI translation pass.
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
