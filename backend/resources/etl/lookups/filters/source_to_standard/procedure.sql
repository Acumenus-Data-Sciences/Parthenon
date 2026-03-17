AND lower(c.vocabulary_id) IN ('cpt4', 'hcpcs', 'icd10pcs', 'icd9proc')
AND lower(c2.domain_id) = 'procedure'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('cpt4', 'hcpcs', 'icd10pcs', 'icd9proc')
AND lower(c2.domain_id) = 'procedure'
