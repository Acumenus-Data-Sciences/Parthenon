# Parthenon AI Service

FastAPI service providing AI-powered features for the Parthenon platform.

## Tech Stack

- **Python 3.12** + FastAPI
- **Ollama** with MedGemma for clinical NLP
- **pgvector** for concept embeddings
- **Pydantic v2** for request/response models

## API Routers (15)

- `abby`
- `ariadne`
- `cdm_spatial`
- `chroma`
- `circe`
- `clinical_nlp`
- `concept_mapping`
- `embeddings`
- `gis`
- `gis_analytics`
- `health`
- `profiling`
- `schema_mapping`
- `study_agent`
- `text_to_sql`

## Development

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Testing
pytest
mypy app/
```

## Key Features

- **Abby AI Assistant** — natural language to OMOP cohort expressions
- **Concept mapping** — AI-suggested OMOP concept mappings with confidence scores
- **Source profiling** — analyze uploaded CSV/FHIR for schema mapping
- **Vector search** — pgvector-powered semantic concept search
