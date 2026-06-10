BEGIN;
-- Restore OMOP vocabulary views in the Acumenus `omop` CDM schema, pointing at
-- the shared `vocab` schema. OHDSI FeatureExtraction/CohortMethod emit vocab
-- references as {cdmDatabaseSchema}.concept; Parthenon splits vocab into a
-- shared `vocab` schema, so the CDM schema needs these views (the same pattern
-- pancreas uses, scripts/pancreatic/create_schema.sql). These were lost in the
-- Mar-22 basebackup recovery, breaking R covariate extraction.
CREATE OR REPLACE VIEW omop.concept              AS SELECT * FROM vocab.concept;
CREATE OR REPLACE VIEW omop.concept_ancestor     AS SELECT * FROM vocab.concept_ancestor;
CREATE OR REPLACE VIEW omop.concept_class        AS SELECT * FROM vocab.concept_class;
CREATE OR REPLACE VIEW omop.concept_relationship AS SELECT * FROM vocab.concept_relationship;
CREATE OR REPLACE VIEW omop.concept_synonym      AS SELECT * FROM vocab.concept_synonym;
CREATE OR REPLACE VIEW omop.domain               AS SELECT * FROM vocab.domain;
CREATE OR REPLACE VIEW omop.drug_strength        AS SELECT * FROM vocab.drug_strength;
CREATE OR REPLACE VIEW omop.relationship         AS SELECT * FROM vocab.relationship;
CREATE OR REPLACE VIEW omop.source_to_concept_map AS SELECT * FROM vocab.source_to_concept_map;
CREATE OR REPLACE VIEW omop.vocabulary           AS SELECT * FROM vocab.vocabulary;

GRANT SELECT ON
  omop.concept, omop.concept_ancestor, omop.concept_class, omop.concept_relationship,
  omop.concept_synonym, omop.domain, omop.drug_strength, omop.relationship,
  omop.source_to_concept_map, omop.vocabulary
TO parthenon_app, abby_analyst, datahub_reader, parthenon_finngen_ro, parthenon_finngen_rw;
COMMIT;
