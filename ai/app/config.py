from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://parthenon:secret@postgres:5432/parthenon"
    redis_url: str = "redis://redis:6379/1"
    model_cache_dir: str = "/app/models"

    # Ollama configuration (for MedGemma and other LLMs)
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "MedAIBase/MedGemma1.5:4b"
    ollama_timeout: int = 120

    # SapBERT model (for Phase 2+ embedding generation)
    sapbert_model: str = "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"

    class Config:
        env_file = ".env"


settings = Settings()
