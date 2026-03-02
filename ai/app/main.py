from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import abby, clinical_nlp, concept_mapping, embeddings, health, profiling, schema_mapping

app = FastAPI(
    title="Parthenon AI Service",
    description="AI/ML service for concept mapping, embeddings, and clinical NLP. Uses Ollama with MedGemma for medical reasoning.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
app.include_router(
    concept_mapping.router, prefix="/concept-mapping", tags=["concept-mapping"]
)
app.include_router(
    clinical_nlp.router, prefix="/clinical-nlp", tags=["clinical-nlp"]
)
app.include_router(profiling.router, prefix="/profiling", tags=["profiling"])
app.include_router(
    schema_mapping.router, prefix="/schema-mapping", tags=["schema-mapping"]
)
app.include_router(abby.router, prefix="/abby", tags=["abby"])
