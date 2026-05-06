-- Phase 3 Plan 6 Task 4 (T-024A): pgvector schema for bge-base concept embeddings.
--
-- Stores one row per OMOP standard concept (or synonym) embedded with
-- ``BAAI/bge-base-en-v1.5`` (768-dim, cosine-normalized). The table lives
-- in the SHARED ``vocab`` schema because the embeddings derive from
-- ``vocab.concept`` + ``vocab.concept_synonym`` and are used by the
-- ``ConceptRetriever`` (Task 6) across all CDM connections.
--
-- Idempotent: ``CREATE EXTENSION IF NOT EXISTS`` and ``CREATE TABLE IF
-- NOT EXISTS`` so the file can be re-applied safely.
--
-- HIGHSEC: this migration is commercial-tier only. The community wheel
-- never references ``vocab.concept_embedding_bge``; the import-linter
-- contract continues to ban community -> commercial imports.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vocab.concept_embedding_bge (
    concept_id  BIGINT      PRIMARY KEY REFERENCES vocab.concept (concept_id),
    embedding   vector(768) NOT NULL,
    model_name  TEXT        NOT NULL DEFAULT 'BAAI/bge-base-en-v1.5',
    embedded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ivfflat index for fast approximate cosine-similarity search.
-- ``lists = 200`` is a reasonable default for ~1M concepts; the build
-- guidance is roughly sqrt(N_rows). ``vector_cosine_ops`` matches the
-- normalize_embeddings=True semantics in BgeEmbedder (Task 2).
CREATE INDEX IF NOT EXISTS concept_embedding_bge_ivfflat_cos
    ON vocab.concept_embedding_bge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 200);

CREATE INDEX IF NOT EXISTS concept_embedding_bge_model_idx
    ON vocab.concept_embedding_bge (model_name);
