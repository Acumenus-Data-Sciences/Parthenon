from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    redis_url: str = "redis://redis:6379/2"
    model_cache_dir: str = "/app/models"

    # Ollama configuration (for MedGemma and other LLMs)
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "MedAIBase/MedGemma1.5:4b"
    ollama_timeout: int = 120
    ollama_num_predict: int = 256
    abby_ollama_base_url: str = ""
    abby_ollama_model: str = ""
    abby_ollama_keep_alive: int = 3600

    # ChromaDB configuration
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    startup_ingest_docs: bool = False

    # StudyAgent configuration
    study_agent_url: str = "http://study-agent:8765"

    # SapBERT model (CPU fallback for embedding generation)
    sapbert_model: str = "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"

    # Ollama embedding model (GPU-accelerated, preferred over SapBERT)
    ollama_embedding_model: str = "nomic-embed-text"

    # Ariadne concept mapping configuration
    ariadne_vocab_schema: str = "omop"

    # Memory settings
    memory_intent_stack_max_depth: int = 3
    memory_intent_expiry_turns: int = 10
    memory_summarization_threshold: float = 0.7
    memory_context_budget_working: int = 1500
    memory_context_budget_page: int = 500
    memory_context_budget_live: int = 800
    memory_context_budget_episodic: int = 400
    memory_context_budget_semantic: int = 600
    memory_context_budget_institutional: int = 200
    memory_profile_calibration_min_interactions: int = 5
    memory_profile_decay_factor: float = 0.85

    # Claude API (Phase 2 — hybrid LLM routing)
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"
    claude_max_tokens: int = 4096
    claude_timeout: int = 60

    # PHI sanitization (Phase 2 — data governance)
    phi_detection_enabled: bool = True
    phi_block_on_detection: bool = True

    # Cost controls (Phase 2 — budget enforcement)
    cloud_monthly_budget_usd: float = 500.0
    cloud_budget_alert_thresholds: list[float] = [0.50, 0.80, 0.95]
    cloud_budget_cutoff_threshold: float = 0.95

    # Knowledge graph (Phase 3)
    knowledge_cache_ttl: int = 3600
    knowledge_cache_prefix: str = "abby:kg:"
    knowledge_max_traversal_depth: int = 5
    knowledge_vocab_schema: str = "vocab"
    knowledge_cdm_schema: str = "cdm"

    # Agency (Phase 4)
    agency_api_base_url: str = "http://nginx:80"
    agency_plan_expiry_seconds: int = 600
    agency_rate_limit_low: int = 20
    agency_rate_limit_medium: int = 10
    agency_rate_limit_high: int = 3

    # Institutional intelligence (Phase 6)
    institutional_faq_threshold: int = 3
    institutional_staleness_days: int = 180
    institutional_max_suggestions: int = 3

    @property
    def abby_llm_base_url(self) -> str:
        return self.abby_ollama_base_url or self.ollama_base_url

    @property
    def abby_llm_model(self) -> str:
        return self.abby_ollama_model or self.ollama_model


settings = Settings()
