from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    redis_url: str = "redis://redis:6379/2"
    model_cache_dir: str = "/tmp/parthenon-models"

    # Ollama configuration (for medical LLMs)
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "puyangwang/medgemma-27b-it:q4_0"
    ollama_timeout: int = 120
    ollama_num_predict: int = 256
    ollama_embedding_base_url: str = "http://host.docker.internal:11434"
    ollama_embedding_timeout: int = 60
    abby_ollama_base_url: str = "http://host.docker.internal:11434"
    abby_ollama_model: str = "puyangwang/medgemma-27b-it:q4_0"
    abby_ollama_keep_alive: int = 3600
    abby_cloud_routing_enabled: bool = False
    phenotype_interpreter_enabled: bool = True
    phenotype_interpreter_base_url: str = "http://host.docker.internal:11434"
    phenotype_interpreter_model: str = "MedAIBase/MedGemma1.5:4b"
    phenotype_interpreter_timeout: int = 120
    phenotype_interpreter_num_predict: int = 900

    # ChromaDB configuration
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    startup_ingest_docs: bool = False
    wiki_root_dir: str = "/data/wiki"
    wiki_default_workspace: str = "platform"

    # StudyAgent configuration
    study_agent_url: str = "http://study-agent:8765"

    # SapBERT model (CPU fallback for embedding generation)
    sapbert_model: str = "cambridgeltl/SapBERT-from-PubMedBERT-fulltext"

    # Ollama embedding model (GPU-accelerated, preferred over SapBERT)
    ollama_embedding_model: str = "nomic-embed-text:latest"

    # Ariadne concept mapping configuration
    # Vector search uses vocab.concept_embedding_bge (BAAI/bge-base-en-v1.5,
    # 768-dim, ~632k standard concepts). The query encoder MUST match the model
    # that populated the table, hence the dedicated BGE settings below.
    ariadne_vocab_schema: str = "vocab"
    ariadne_embedding_table: str = "concept_embedding_bge"
    ariadne_bge_model: str = "BAAI/bge-base-en-v1.5"
    # Empty = no instruction prefix (symmetric concept-name ↔ concept-name match).
    # Set to "Represent this sentence for searching relevant passages: " for
    # asymmetric short-query → long-passage retrieval.
    ariadne_bge_query_instruction: str = ""
    # MODEL_CACHE_DIR (/models) is a read-only tmpfs for the non-root appuser;
    # BGE downloads must target a writable path. /tmp/parthenon-models is the
    # de-facto writable HF cache already used by the Chroma embedder.
    ariadne_bge_cache_dir: str = "/tmp/parthenon-models"

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

    # Claude Agent SDK (Study Designer agent)
    agent_model: str = "claude-opus-4-7"
    agent_effort: str = "xhigh"
    agent_max_turns: int = 24
    agent_max_budget_usd: float = 5.0
    agent_max_concurrent_turns: int = 4
    agent_approval_timeout_seconds: int = 600

    # Reverb (Pusher-protocol) — python-ai publishes agent events
    reverb_app_id: str = ""
    reverb_app_key: str = ""
    reverb_app_secret: str = ""
    reverb_host: str = "reverb"
    reverb_port: int = 8080
    reverb_scheme: str = "http"

    # Knowledge graph (Phase 3)
    knowledge_cache_ttl: int = 3600
    knowledge_cache_prefix: str = "abby:kg:"
    knowledge_max_traversal_depth: int = 5
    knowledge_vocab_schema: str = "vocab"
    # Primary CDM schema the Abby data-quality profiler queries. Parthenon has no
    # "cdm" schema — clinical data lives in per-source schemas (omop, synpuf, ...);
    # the old "cdm" default made every data-quality query fail silently. Override
    # via KNOWLEDGE_CDM_SCHEMA to point the profiler at a different source schema.
    knowledge_cdm_schema: str = "omop"

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

    @property
    def phenotype_llm_base_url(self) -> str:
        return self.phenotype_interpreter_base_url or self.ollama_base_url


settings = Settings()
