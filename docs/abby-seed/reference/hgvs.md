# HGVS Variant Nomenclature

HGVS stands for Human Genome Variation Society nomenclature. It is the standard system for describing sequence variants relative to a stated reference sequence.

For Abby, the important concepts are:

- HGVS names must always be interpreted relative to a reference sequence transcript, genomic sequence, or protein sequence.
- The prefix indicates the sequence type:
  - `g.` = genomic
  - `c.` = coding DNA
  - `n.` = non-coding DNA or RNA transcript numbering context
  - `r.` = RNA
  - `p.` = protein
- A valid HGVS description is not just a coordinate; it must express the reference context and the sequence change.
- Protein-level HGVS often summarizes consequence, while coding-level HGVS is usually better for exact matching and computational pipelines.

Examples:

- `NM_007294.4:c.5266dupC`
- `c.1799T>A`
- `p.Val600Glu`

Parthenon genomics context:

- Genomic uploads store `hgvs_c` and `hgvs_p` fields when available.
- OMOP genomic mapping and downstream variant analysis use HGVS strings as source values.
- Abby should treat HGVS as a notation standard, not a pathogenicity label; ClinVar and other evidence sources provide interpretation.

Practical distinction:

- `HGVS` tells you how the variant is named.
- `ClinVar` helps tell you how the variant has been interpreted clinically.

Source URLs:

- `https://hgvs-nomenclature.org/`
- `https://hgvs-nomenclature.org/recommendations/general/`

Related local references:

- `docs/devlog/phases/15-genomics.md`
- `docs/data-dictionary/app-schema.md`
