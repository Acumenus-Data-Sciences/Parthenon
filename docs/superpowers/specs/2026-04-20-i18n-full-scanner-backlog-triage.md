# i18n Full Frontend Scanner Backlog Triage

Date: 2026-04-20

Source command:

```bash
cd frontend
npm run i18n:scan
```

Current scanner output:

- Full frontend scanner: 5,265 candidates across 1,103 scanned files.
- FinnGen paths excluded from this i18n track: 372 candidates.
- Non-FinnGen backlog for this triage: 4,893 candidates.
- Candidate kinds after FinnGen exclusion: 3,208 JSX text, 1,369 object properties, 316 JSX attributes.

The app-priority scanner remains the release gate for the already-promoted language picker work. It currently reports 0 candidates across 214 files. The backlog below is therefore not a blocker for the current public app language selector, but it is the remaining work before Parthenon can claim broad native-language coverage across every product surface.

## Classification

| Class | Candidates | Files | Disposition |
| --- | ---: | ---: | --- |
| Cohort authoring and diagnostics | 687 | 51 | Release-blocking for native cohort-builder claims. Extract next if cohort authoring is the next public i18n promise. |
| Analysis design and results | 725 | 53 | Release-blocking for native analytics workflows. Extract as a focused analysis wave because designers/results share terminology. |
| Data source setup and ingestion | 0 | 46 | Completed for `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome. Focused wave scanner reports 0 candidates. |
| Standard PROs UI | 247 | 13 | Release-blocking for Standard PROs+ workflows. Keep instrument content separate from UI chrome. |
| Imaging and radiogenomics | 266 | 12 | Release-blocking for imaging workflows. Protect DICOM/OHIF/PACS terminology and measurement units. |
| Strategus and study packages | 104 | 3 | Release-blocking for native study-package authoring. Protect JSON/module names and OHDSI package identifiers. |
| Investigation clinical workflows | 336 | 43 | Later app wave unless the Investigation surface becomes a public i18n promise. Keep clinical/source values out of generic UI translation. |
| Profiles and patient similarity | 532 | 55 | Later app wave. Many strings blend profile UI, patient-source labels, and similarity analytics. |
| Publish, care gaps, and risk scores | 448 | 50 | Later app wave. Good candidate for a single applied-results/productivity wave. |
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
| 101 | `src/features/cohort-definitions/components/PhenotypeValidationPanel.tsx` |
| 99 | `src/features/standard-pros/data/instruments.ts` |
| 68 | `src/features/standard-pros/components/builder/BuilderTab.tsx` |
| 55 | `src/features/cohort-definitions/components/CohortDiagnosticsPanel.tsx` |
| 54 | `src/features/imaging/pages/ImagingPage.tsx` |
| 50 | `src/features/strategus/pages/StudyPackagePage.tsx` |
| 49 | `src/features/strategus/components/ModuleConfigPanels.tsx` |
| 48 | `src/features/imaging/components/MeasurementPanel.tsx` |
| 46 | `src/features/analyses/components/CharacterizationDesigner.tsx` |
| 45 | `src/features/genomics/pages/GenomicsPage.tsx` |
| 39 | `src/features/profiles/pages/PatientProfilePage.tsx` |
| 37 | `src/features/estimation/components/EstimationResults.tsx` |
| 37 | `src/features/investigation/components/clinical/ConfigDrawer.tsx` |
| 37 | `src/features/radiogenomics/components/PrecisionMedicineTab.tsx` |
| 37 | `src/features/risk-scores/pages/RiskScoreHubPage.tsx` |

## Recommended Extraction Order

1. Data-source setup and ingestion. Completed 2026-04-20.
   Scope completed: `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome. Source names, schema names, auth schemes, URLs, examples, FHIR/OMOP/CDM tokens, and visual separators were kept protected.

2. Cohort authoring and diagnostics.
   Scope: cohort-definition list/detail, expression editor, validation, diagnostics, attrition, patient list, Circe SQL panel, and phenotype-library pages. Protect clinical concept/source labels, generated SQL, JSON, and OHDSI/Circe identifiers.

3. Analysis design and results.
   Scope: analysis gallery/list plus characterization, incidence, estimation, prediction, pathways, SCCS, self-controlled cohort, and evidence synthesis designers/results. Keep statistical method labels, package names, and source-data values explicit.

4. Standard PROs UI.
   Scope: builder/conduct/analytics UI chrome. Keep `standard-pros/data/instruments.ts` out of generic UI translation until we have a curated instrument-content policy.

5. Imaging and radiogenomics.
   Scope: imaging page, DICOM import, measurement/response panels, study viewer chrome, and precision medicine tab. Protect DICOM, PACS, OHIF, modality names, measurements, units, accession IDs, and series metadata.

6. Strategus and study packages.
   Scope: module config panels, package page, and JSON spec editor. Protect Strategus module names, JSON keys, package identifiers, and generated specification text.

7. Later specialty waves.
   Profiles/patient similarity, publish/care-gaps/risk, HEOR, genomics, Morpheus, ETL source profiler/Aqueduct, GIS/Poseidon/code tools, concept-set shared primitives, and workbench surfaces should follow after the release-facing waves above.

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
- `npm run i18n:scan:app-priority` still reporting 0 candidates;
- `npm run i18n:report` with 100% key presence and no missing keys;
- focused frontend typecheck, ESLint, and i18n Vitest coverage;
- browser smoke for at least English, Spanish, Korean, Hindi, one CJK locale, and one European Wave 1 locale when the surface is route-visible;
- no FinnGen paths unless that scope is explicitly reopened.
