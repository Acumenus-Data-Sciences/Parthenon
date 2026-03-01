-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS vocab;
CREATE SCHEMA IF NOT EXISTS cdm;
CREATE SCHEMA IF NOT EXISTS results;

-- Grant permissions
GRANT ALL ON SCHEMA app, vocab, cdm, results TO parthenon;
