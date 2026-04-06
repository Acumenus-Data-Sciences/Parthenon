# ClinVar

ClinVar is the NCBI public archive of submitted interpretations of human genetic variants and their relationships to disease or other phenotypes.

For Abby, the important concepts are:

- ClinVar stores variant interpretations, not just raw sequence changes.
- A ClinVar record can include clinical significance, condition, review status, supporting evidence, and submitter information.
- ClinVar commonly uses HGVS expressions to describe variants at the coding or protein level.
- Clinical significance values include terms such as `pathogenic`, `likely pathogenic`, `uncertain significance`, `likely benign`, and `benign`.
- Review status matters because it indicates how much review or consensus supports an interpretation.

Common identifiers:

- `SCV` = submitted interpretation from a specific submitter
- `RCV` = record aggregated by variant-condition relationship
- `VCV` or Variation ID = record aggregated at the variant level

Parthenon genomics context:

- The local ClinVar cache stores `variation_id`, `hgvs`, `clinical_significance`, `review_status`, and related disease fields.
- Uploaded variants can be annotated from the local ClinVar cache after sync.
- ClinVar significance is used as one of the signals for pathogenicity-oriented cohort and variant workflows.

Source URLs:

- `https://www.ncbi.nlm.nih.gov/clinvar/`
- `https://www.ncbi.nlm.nih.gov/clinvar/docs/clinsig/`

Related local references:

- `docs/devlog/phases/15-clinvar.md`
- `docs/devlog/phases/15-genomics.md`
- `docs/data-dictionary/app-schema.md`
