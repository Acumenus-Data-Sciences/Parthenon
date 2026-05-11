# Pancreatic Corpus Remaining Enrichment To-Do

Date: 2026-04-11

## Current Inventory

- [x] Local corpus found at `/mnt/md0/pancreatic-corpus`.
- [x] Pancreas CDM expanded to 361 patients:
  - [x] 21 PANCREAS-CT patients.
  - [x] 168 CPTAC-PDA patients.
  - [x] 172 TCGA-PAAD patients.
- [x] Core clinical record coverage is present for all 361 patients:
  - [x] Visits.
  - [x] Conditions.
  - [x] Measurements.
  - [x] Drug exposures.
  - [x] Specimens.
  - [x] Observation periods.
- [x] Driver-gene summaries are present for all 361 patients:
  - [x] KRAS.
  - [x] TP53.
  - [x] SMAD4.
  - [x] CDKN2A.
- [x] Pancreatic cohort definitions exist:
  - [x] All PDAC Patients.
  - [x] Resectable PDAC with Surgical Intervention.
  - [x] FOLFIRINOX Recipients.
  - [x] High CA 19-9 at Diagnosis.
  - [x] KRAS Mutant PDAC.

## Remaining Work

- [ ] Clinical notes.
  - [x] Fix note-generation idempotency so outpatient consultation and outpatient progress notes do not collide.
  - [x] Add a bounded run option for safe smoke testing.
  - [x] Verify Ollama and the configured MedGemma model are available.
  - [x] Debug bounded note generation on patients 1 and 2.
  - [x] Raise the Ollama note-generation read timeout for MedGemma 27B.
  - [x] Switch generated-note commits to one note at a time for safer resume after a crash.
  - [x] Switch the active run to `MedAIBase/MedGemma1.5:4b` for speed after a successful one-note smoke test.
  - [x] Replace unconstrained 4B note generation with source-faithful structured templates after quality review found hallucinated pathology, placeholders, outcome leakage, and invented exam/toxicity details.
  - [x] Add a selective `--force-note-types` option so pathology can be regenerated later without deleting consultation, operative, and progress notes.
  - [x] Generate notes for all eligible patients.
  - [x] Validate expected total: 1,229 notes for 361 patients and 146 surgical patients.

- [x] Pancreatic TCGA genomics in OMOP extension tables.
  - [x] Create a pancreatic-specific backfill script that does not confuse app-layer FoundationOne data with the pancreatic corpus.
  - [x] Seed `omop.genomic_test` metadata for TCGA-PAAD WXS somatic variant calling.
  - [x] Seed `omop.target_gene` and `app.omop_gene_symbol_map` for observed loaded genes.
  - [x] Resolve TCGA participant and aliquot barcodes to `pancreas.person` and `pancreas.specimen`.
  - [x] Create derived `omop.procedure_occurrence` rows for genomic testing where needed.
  - [x] Load `omop.variant_occurrence` with valid `procedure_occurrence_id` and `specimen_id`.
  - [x] Load clinically useful `omop.variant_annotation` fields.
  - [x] Write a review table or report for unmatched genes, specimens, or participants instead of silently dropping them.
  - [x] Validate loaded coverage: 18,324 variants, 270,468 annotations, 169 participants with loaded variants, 172 participants with derived genomic procedure anchors.

- [ ] Imaging reconciliation.
  - [ ] Reconcile 13 PANCREAS-CT patients without linked source-58 imaging studies.
  - [ ] Reconcile 19 CPTAC-PDA patients without linked source-58 imaging studies.
  - [ ] Reconcile 17 TCGA-PAAD tissue `.svs` slides not matched to `pancreas.person`.
  - [ ] Decide whether TCGA diagnostic `.svs` slides belong in the current pancreatic CDM subset before loading them.
  - [ ] Keep PANTHER MRI out until a participant crosswalk exists.
  - [ ] Keep PanTS NIfTI out until conversion and person-linkage rules exist.

- [ ] Imaging features.
  - [ ] Define source feature inputs first; `omop.image_feature` is currently empty because no feature extraction source is loaded.
  - [ ] Seed `app.omop_imaging_feature_map` after feature definitions are chosen.
  - [ ] Backfill `omop.image_feature` and `app.imaging_feature_omop_xref`.

- [ ] Validation and characterization.
  - [x] Re-run validation queries after each backfill.
  - [ ] Re-run Achilles or the local pancreas characterization workflow after data changes.
  - [ ] Document final row counts and known non-goals.

## Execution Notes

- Do not run destructive rebuilds of the pancreas schema unless explicitly intended.
- Treat `/mnt/md0/pancreatic-corpus/OMOP_IMAGING_GENOMICS_SPEC.md` as the local source-of-truth for merge constraints.
- Do not load PANTHER MRI without a crosswalk to `pancreas.person`.
- Do not model RNA-seq, methylation, or miRNA matrices as `variant_occurrence`.
- 27B pathology probe result: `puyangwang/medgemma-27b-it:q4_0` runs acceptably fast with `--num-ctx 4096 --num-gpu 999`, but sample pathology outputs invented unsupported specimen dimensions, pTNM/AJCC staging, lymph node counts, margin/invasion findings, differentiation, and IHC/stain details. Keep structured pathology templates as the trusted corpus output unless future 27B work is source-validated behind strict rejection/fallback.
- Future pathology-only 27B refresh command, after prompt/source review:
  `python3 scripts/pancreatic/generate_notes.py --note-types pathology --force-note-types pathology --template-note-types consultation,operative,progress --model puyangwang/medgemma-27b-it:q4_0 --num-ctx 4096 --num-gpu 999 --timeout-seconds 600 --commit-interval 1`
