AND lower(c.vocabulary_id) IN ('ndc')
AND lower(c.domain_id) = 'drug'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('ndc')
AND lower(c2.domain_id) = 'drug'
