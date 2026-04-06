# Parthenon Genomics Variant Reference

Parthenon stores variant naming and clinical interpretation as related but separate concepts.

Variant naming fields:

- `hgvs_c` stores HGVS coding sequence notation such as `c.1799T>A`
- `hgvs_p` stores HGVS protein notation such as `p.Val600Glu`
- `gene_symbol` stores the HGNC gene symbol

Clinical interpretation fields:

- `clinvar_id` stores the ClinVar variation identifier
- `clinvar_significance` stores the ClinVar clinical significance value
- `clinvar_disease` stores associated disease names
- `clinvar_review_status` stores the ClinVar review status

Local reference cache:

- `clinvar_variants` is the local ClinVar reference table synced from NCBI
- the cache stores coordinate fields, gene symbol, HGVS notation, clinical significance, disease names, review status, and a pathogenicity flag

Workflow implications for Abby:

- HGVS tells Abby how a variant is described
- ClinVar tells Abby how that variant has been interpreted clinically
- Abby should avoid treating HGVS strings as direct evidence of pathogenicity
- Abby should use ClinVar significance and review status when discussing interpretation

OMOP mapping context:

- `measurement_source_value` commonly uses a `GENE:HGVS_c` style source string
- OMOP mapping status is tracked separately from variant interpretation

This note is derived from the local Parthenon genomics schema and implementation docs.
