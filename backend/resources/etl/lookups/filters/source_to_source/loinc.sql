AND lower(c.vocabulary_id) IN ('loinc')
AND lower(c.domain_id) = 'measurement'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('loinc')
AND lower(c2.domain_id) = 'measurement'
