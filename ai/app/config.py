from typing import NamedTuple

from pydantic_settings import BaseSettings, SettingsConfigDict


class ResolvedAgentProvider(NamedTuple):
    """The effective model/transport for one agent turn after resolving the
    global ``agent_provider`` against an optional per-profile override."""

    provider: str          # "anthropic" | "local"
    model: str
    effort: str
    base_url: str | None   # None for anthropic (CLI uses its built-in endpoint)
    auth_token: str | None  # None for anthropic (CLI uses ANTHROPIC_API_KEY)
    actions_enabled: bool  # whether approval-gated WRITE tools are available


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    redis_url: str = "redis://redis:6379/2"
    model_cache_dir: str = "/tmp/parthenon-models"

    # CORS: restrict browser cross-origin access to the Parthenon app origins.
    # The service is normally reached server-to-server via Laravel (CORS does
    # not apply there), so scoping this does not affect backend calls; it
    # replaces a "*" wildcard that was also spec-invalid alongside
    # allow_credentials=True. Comma-separated; override via CORS_ORIGINS.
    cors_origins: str = (
        "http://localhost:8082,http://localhost:5175,"
        "https://parthenon.acumenus.net"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

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
    abby_chat_provider_mode: str = ""
    abby_chat_default_profile_id: str = ""
    abby_chat_fallback_profile_ids: str = ""
    abby_local_chat_profile_id: str = "local-medgemma"
    abby_local_chat_fallback_profile_ids: str = ""
    # Lower-resource local fallback (MedGemma 4B) — a second local profile so a
    # constrained host can still answer when the 27B model is unavailable.
    abby_local_chat_4b_profile_id: str = "local-medgemma-4b"
    abby_local_chat_4b_model: str = "MedAIBase/MedGemma1.5:4b"
    # Optional operator-friendly tag aliases, "alias=real_tag" comma list, e.g.
    # "medgemma:27b=puyangwang/medgemma-27b-it:q4_0". Resolved before Ollama calls.
    abby_model_aliases: str = "medgemma:27b=puyangwang/medgemma-27b-it:q4_0"
    # Warm the local model with a 1-token probe on service startup when enabled,
    # to avoid a cold-start stall on the first user turn.
    abby_warmup_on_startup: bool = False
    abby_cloud_chat_profile_id: str = "anthropic-claude"
    abby_cloud_entitlement: str = "org_api_key"
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
    # Per-million-token pricing carried in provider profile metadata (the single
    # declarative source for budget estimation; the adapter falls back to its own
    # PRICING table only for models without profile metadata).
    claude_input_price_per_mtok: float = 3.0
    claude_output_price_per_mtok: float = 15.0

    # OpenAI API / OpenAI-compatible providers (provider-agnostic Abby routing)
    openai_api_key: str = ""
    openai_model: str = "gpt-5.5"
    openai_base_url: str = ""
    openai_max_output_tokens: int = 4096
    openai_timeout: int = 60
    # 0.0 = operator must set real pricing to enable budget estimation for OpenAI.
    openai_input_price_per_mtok: float = 0.0
    openai_output_price_per_mtok: float = 0.0
    openai_compatible_api_key: str = ""
    openai_compatible_model: str = ""
    openai_compatible_base_url: str = ""
    openai_compatible_max_output_tokens: int = 4096
    openai_compatible_timeout: int = 60

    # PHI sanitization (Phase 2 — data governance)
    phi_detection_enabled: bool = True
    phi_block_on_detection: bool = True

    # Cost controls (Phase 2 — budget enforcement)
    cloud_monthly_budget_usd: float = 500.0
    cloud_budget_alert_thresholds: list[float] = [0.50, 0.80, 0.95]
    cloud_budget_cutoff_threshold: float = 0.95
    anthropic_monthly_budget_usd: float = 0.0
    openai_monthly_budget_usd: float = 0.0
    openai_compatible_monthly_budget_usd: float = 0.0

    # Claude Agent SDK (Study Designer agent)
    agent_model: str = "claude-opus-4-7"
    agent_effort: str = "xhigh"
    agent_max_turns: int = 24
    agent_max_budget_usd: float = 5.0
    agent_max_concurrent_turns: int = 4
    agent_approval_timeout_seconds: int = 600

    # Agent provider switch (EE = Anthropic cloud; CE = local model via proxy).
    # The agent loop (MCP tools, approval gating, streaming) is model-agnostic;
    # only the CLI's request target and the auto-enabled tool set change.
    # Defaults preserve EE behavior — overriding nothing keeps Anthropic/Opus.
    agent_provider: str = "anthropic"  # "anthropic" | "local"
    # Anthropic-compatible proxy (claude-code-router / LiteLLM) that translates
    # the Messages API to a local Ollama backend. Internal network only.
    agent_local_base_url: str = "http://claude-router:8787"
    # Tool-calling-capable local model. NOT MedGemma (a RAG model with weak
    # function-calling); use Qwen2.5-Coder-32B / Llama-3.3-70B / Hermes-3.
    agent_local_model: str = "qwen2.5-coder:32b"
    # Dummy bearer the proxy accepts in place of a real Anthropic key.
    agent_local_auth_token: str = "local"
    # Gate the approval-gated WRITE tools on the local provider. Off by default:
    # CE ships omnipresent Abby (reads/chat) on day one; operators opt in to
    # actions per-deployment once their local model proves reliable tool-calling.
    agent_local_actions_enabled: bool = False
    # Local models ignore or break on high thinking budgets; cap effort.
    agent_local_effort: str = "medium"

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

    def resolve_agent_provider(
        self,
        profile_provider: str | None = None,
        request_provider: str | None = None,
    ) -> ResolvedAgentProvider:
        """Resolve the effective provider for an agent turn.

        Precedence: ``request_provider`` (Laravel's runtime agents.provider_mode
        decision, authoritative) > ``profile_provider`` (a profile forcing one) >
        the global ``agent_provider`` env default. For the local provider, returns
        the local model/effort and the proxy transport, and whether write tools are
        enabled. Anthropic returns the cloud model with no transport override (the
        CLI uses its built-in endpoint + ANTHROPIC_API_KEY).
        """
        provider = (
            request_provider or profile_provider or self.agent_provider or "anthropic"
        ).lower()
        if provider == "local":
            return ResolvedAgentProvider(
                provider="local",
                model=self.agent_local_model,
                effort=self.agent_local_effort,
                base_url=self.agent_local_base_url,
                auth_token=self.agent_local_auth_token,
                actions_enabled=self.agent_local_actions_enabled,
            )
        return ResolvedAgentProvider(
            provider="anthropic",
            model=self.agent_model,
            effort=self.agent_effort,
            base_url=None,
            auth_token=None,
            actions_enabled=True,
        )


settings = Settings()
