AND lower(c.vocabulary_id) IN ('nucc')
AND lower(c.domain_id) = 'provider'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('nucc')
AND lower(c2.domain_id) = 'provider'
