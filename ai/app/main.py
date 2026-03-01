from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import clinical_nlp, concept_mapping, embeddings, health

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
