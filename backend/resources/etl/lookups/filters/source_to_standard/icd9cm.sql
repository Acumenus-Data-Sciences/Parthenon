AND lower(c.vocabulary_id) IN ('icd9cm')
AND lower(c2.domain_id) = 'condition'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('icd9cm')
AND lower(c2.domain_id) = 'condition'
