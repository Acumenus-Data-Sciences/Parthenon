-- REAL-PE Replication — Concept ID Hydration
--
-- The cohort JSON templates in this folder reference concepts by
-- (VOCABULARY_ID, CONCEPT_CODE). Run this query first to resolve the
-- standard concept_ids that your vocab build assigned, then plug them
-- into the cohort JSON before seeding.
--
-- Rationale: CPT/HCPCS concept_ids can shift between Athena vocab releases,
-- so we resolve at seed time rather than hard-coding them.

SET search_path = vocab, public;

\echo '--- Standard concept IDs used by REAL-PE replication ---'

SELECT c.concept_id,
       c.concept_name,
       c.vocabulary_id,
       c.concept_code,
       c.domain_id,
       c.standard_concept,
       c.invalid_reason
FROM concept c
WHERE (c.vocabulary_id = 'SNOMED' AND c.concept_code = '59282003')      -- Pulmonary embolism
   OR (c.vocabulary_id = 'CPT4'   AND c.concept_code IN ('37211','37212','37213','37214','37187','36430'))
   OR (c.vocabulary_id = 'LOINC'  AND c.concept_code IN ('718-7','30350-3','30351-1','20509-6'))
   OR (c.vocabulary_id = 'SNOMED' AND c.concept_code = '1386000')       -- Intracranial hemorrhage
   OR (c.vocabulary_id = 'SNOMED' AND c.concept_code = '131148009')     -- Bleeding
ORDER BY c.vocabulary_id, c.concept_code;

\echo '--- Non-standard-to-standard mapping (if any of the above are non-standard) ---'

SELECT src.vocabulary_id   AS source_vocab,
       src.concept_code    AS source_code,
       src.concept_name    AS source_name,
       tgt.concept_id      AS standard_concept_id,
       tgt.concept_name    AS standard_name,
       tgt.vocabulary_id   AS standard_vocab
FROM concept src
JOIN concept_relationship cr
  ON cr.concept_id_1 = src.concept_id
 AND cr.relationship_id = 'Maps to'
 AND cr.invalid_reason IS NULL
JOIN concept tgt
  ON tgt.concept_id = cr.concept_id_2
 AND tgt.standard_concept = 'S'
WHERE (src.vocabulary_id = 'CPT4' AND src.concept_code IN ('37211','37212','37213','37214','37187','36430'))
   OR (src.vocabulary_id = 'LOINC' AND src.concept_code IN ('718-7','30350-3'))
ORDER BY src.concept_code;
