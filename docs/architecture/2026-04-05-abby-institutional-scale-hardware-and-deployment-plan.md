# Abby Institutional-Scale Hardware And Deployment Plan

Date: 2026-04-05

## Purpose

This document defines what Abby needs in hardware, infrastructure, and deployment design to run credibly at institutional scale for mature OMOP adopters.

The immediate target is not a generic small-clinic install. It is the subset of the TAM that already has serious OMOP operations, security controls, and research governance, including sites like Mount Sinai and Johns Hopkins.

## Executive Summary

Abby, as currently implemented in Parthenon, is not a single model endpoint. She is a multi-service research assistant composed of:

- Laravel/Nginx application tier
- Python AI service
- local or remote LLM serving layer
- Redis
- PostgreSQL plus pgvector-backed conversation memory
- Chroma-backed RAG retrieval
- read-only OMOP access plus selected live database tools

The current codebase is architecturally suitable for a pilot, a departmental rollout, or a controlled early institutional launch, but not for a naive single-host deployment at a large academic medical center.

The biggest operational conclusion is this:

- Abby should be deployed site-local, in a federated pattern, close to the institution’s OMOP environment.
- The inference tier must be separated from the application tier.
- For institutional production, Ollama should be treated as a pilot or fallback serving layer, not the long-term primary inference plane for multi-user, multi-turn researcher workflows.

## Why This Is The Right Target Market

OHDSI describes itself as a global network with more than 4,200 collaborators across 83 countries and health records for about 810 million unique patients, all linked by the OMOP CDM and federated analytics patterns.[1] That is large enough that Abby’s realistic near-term TAM is the mature subset of institutions that already operate OMOP as a serious research platform, not as an isolated experiment.

This matters because mature OMOP sites already expect:

- federated data access
- IRB and data-use controls
- auditable analysis environments
- reproducible methods
- no casual movement of PHI outside institutional boundaries

Those expectations align with Abby’s strongest deployment posture: local-first, governed, and integrated with the institution’s existing analytics environment.

## What The Current Abby Architecture Implies

Based on the current repository:

- the Python AI service runs as a stateless FastAPI service with 2 `uvicorn` workers
- the Python AI service is intentionally CPU-oriented in its own container and calls an external Ollama endpoint for Abby generation
- Abby pre-warms a dedicated model and keeps it resident with `keep_alive`
- Abby uses pgvector-backed conversation memory in PostgreSQL
- Abby also uses Chroma for multi-collection retrieval
- the Abby router configures an HTTP client with up to 100 connections, meaning the app tier can accept much more request concurrency than a single local model can actually serve

The net effect is simple:

- app-tier concurrency is not the same as inference-tier concurrency
- a single Ollama instance can become the dominant bottleneck very quickly
- institutional scaling is mostly a serving, memory, and governance problem, not a React or Laravel problem

## Important Model Constraint

The current default Abby model is `MedAIBase/MedGemma1.5:4b`.

Google’s MedGemma documentation says:

- MedGemma is intended as a starting point for developers and should be adapted and validated for the site-specific use case.[2]
- MedGemma has not been evaluated or optimized for multi-turn applications.[2]
- If you want to use the model at scale, Google recommends creating a production version using Model Garden.[3]

This is directly relevant because Abby is fundamentally a multi-turn research assistant. Therefore:

- the current MedGemma 4B setup is acceptable for pilot and local-first fallback use
- it is not strong enough, by itself, to be the unqualified institutional production answer for the full Abby conversational workload

## Serving Constraint

Ollama’s official documentation states that:

- concurrent request behavior depends on available RAM or VRAM
- parallelism and context length directly increase memory requirements
- requests queue once the server is overloaded
- the server can return `503` when too many requests are sent
- RAM requirements scale with `OLLAMA_NUM_PARALLEL * OLLAMA_CONTEXT_LENGTH`[4]

Ollama also documents that large-context tasks like agents and tool-using workloads should be set to at least 64k tokens, and that increasing context length increases required VRAM.[5]

That is enough to rule out a simplistic institutional design built around one Ollama process on one convenience GPU.

## Recommended Production Serving Posture

For institutional production, the recommended order is:

1. Primary recommendation: dedicated GPU inference tier using vLLM or an institution-approved managed deployment of the chosen model family.
2. Secondary recommendation: retain Ollama for pilot, fallback, or offline validation paths.
3. Optional hybrid: keep local models for PHI-sensitive or routine tasks, and route selected non-PHI complex reasoning to an approved cloud model only where institutional governance permits.

Why vLLM is the better institutional default:

- it is explicitly built for scalable serving
- it supports an OpenAI-compatible server interface
- it has Kubernetes deployment guidance
- it supports production autoscaling patterns through Ray Serve LLM
- its documentation makes CPU sizing for GPU deployments explicit rather than hiding it behind desktop defaults[6][7][8]

## Hardware Sizing Assumptions

The recommendations below assume a mature OMOP institution with:

- 100 to 300 named Abby users
- 15 to 40 concurrent interactive sessions at daytime peaks
- 5 to 10 simultaneous generation-heavy requests at peaks
- one or more OMOP sources already available
- moderate RAG corpora including documentation, FAQ, institutional guidance, and conversation history
- requirement for site-local deployment, SSO, auditability, and PHI control

If a site expects only a pilot workload, the lower tier is fine. If it expects Abby to become a common research surface across departments, use the institutional tier from the start.

## Recommended Hardware By Tier

### Tier 1: Controlled Pilot

Use this for:

- one department
- under 25 named users
- under 5 concurrent active chats
- limited live database tooling

Recommended baseline:

- Inference node: 1 node, 1 GPU with 48 GB VRAM minimum, 16 to 24 vCPU, 128 GB RAM, 1 to 2 TB NVMe
- App and AI node: 1 to 2 nodes, 8 to 16 vCPU each, 32 to 64 GB RAM, 250 to 500 GB NVMe
- PostgreSQL app and memory store: 8 to 16 vCPU, 64 GB RAM, 1 TB NVMe
- Chroma: 8 vCPU, 32 GB RAM, 500 GB to 1 TB NVMe
- Redis: 4 vCPU, 8 to 16 GB RAM

This tier is enough to validate:

- user acceptance
- model routing
- retrieval quality
- institutional security review
- early prompt and UX tuning

### Tier 2: Institutional Production For A Single Large AMC

Use this for:

- enterprise research rollout at one health system
- hundreds of potential users
- cross-department adoption
- daytime peak traffic
- formal support expectations

Recommended baseline:

- Inference tier:
  - 2 GPU nodes for HA
  - each node with 1 to 2 GPUs of 48 GB VRAM each minimum
  - preferred per-node host spec: 24 to 32 vCPU, 128 to 256 GB RAM, 2 TB NVMe, 25 GbE networking
- Python AI tier:
  - 2 to 3 stateless nodes
  - each with 16 to 32 vCPU, 64 to 128 GB RAM, 500 GB NVMe
- Web and API tier:
  - 2 to 3 stateless nodes, or reuse existing app cluster
  - each with 8 to 16 vCPU, 32 to 64 GB RAM
- PostgreSQL app and memory tier:
  - primary plus replica
  - 16 to 32 vCPU per node
  - 128 GB RAM per node
  - 2 to 4 TB NVMe
- Vector and RAG tier:
  - Chroma or equivalent on 1 to 2 nodes
  - 8 to 16 vCPU, 32 to 64 GB RAM, 1 to 2 TB NVMe
- Redis:
  - 4 to 8 vCPU
  - 16 to 32 GB RAM

Operational notes:

- The OMOP warehouse should be accessed through a read-only analytics endpoint or replica, not the institution’s transactional EHR systems.
- GPU nodes should be isolated from the web tier and monitored separately.
- Model cache volumes should live on local NVMe or fast persistent volumes to avoid cold-start delays.

### Tier 3: Multi-Institution Managed TAM Motion

Use this when Parthenon is serving multiple institutions commercially.

Recommended posture:

- one site-local deployment per institution
- centralized release management and observability control plane
- no multi-tenant PHI data plane
- common deployment package, per-site model policy and network policy

Per-site baseline:

- the Tier 2 footprint above

Vendor-side control plane:

- release registry
- license and entitlement services
- non-PHI telemetry aggregation where contractually allowed
- deployment health and version reporting

This is the right design because mature OMOP customers already operate under federated expectations. A centralized multi-tenant PHI architecture would create avoidable procurement and governance friction.

## Concrete Hardware Recommendation

If I had to recommend a single default institutional bill of materials for Abby today, it would be this:

- 2 inference nodes
- each inference node with 1 x 48 GB GPU minimum, 24 vCPU, 128 GB RAM, 2 TB NVMe
- 2 Python AI nodes with 16 vCPU and 64 GB RAM each
- 2 web/API nodes with 8 vCPU and 32 GB RAM each
- PostgreSQL primary plus replica with 16 vCPU, 128 GB RAM, and 2 TB NVMe each
- 1 Chroma node with 8 to 16 vCPU, 32 to 64 GB RAM, and 1 TB NVMe
- 1 Redis node with 4 vCPU and 16 GB RAM

That is the minimum design I would call institutionally credible for a serious OMOP site.

If the institution wants:

- long context by default
- broader multimodal support
- heavier agentic tooling
- higher concurrency
- local-only reasoning without cloud assist

then move immediately to:

- 2 inference nodes with 2 x 48 GB GPUs each
- 256 GB RAM per inference node

## Institution-Specific Notes

### Mount Sinai Class Deployment

Mount Sinai publicly describes:

- an OMOP dataset with over 11 million patient records and over 87 million patient encounters[9]
- continually refreshed OMOP-formatted data marts[10]
- a cloud-based, multimodal AIR·MS platform for AI work[10][11]

Implications:

- Mount Sinai is not a small data customer
- Abby should be integrated with the existing MSDW and AIR·MS style environment rather than introduced as a standalone workstation-grade add-on
- note-heavy and multimodal use cases are likely to emerge quickly

Recommended posture:

- deploy Abby into Mount Sinai-controlled compute
- use their existing secure data services and SSO pathways
- plan for higher retrieval and index-building workload than a typical site
- prefer 2 x 48 GB GPUs per inference node from the start

### Johns Hopkins Class Deployment

Johns Hopkins publicly describes:

- an OMOP corpus with more than 1 billion pieces of information from 2.6 million patients, updated regularly[12]
- institutional experience with both federated and centralized OMOP applications[13]
- an active OHDSI team and investment in OMOP imaging and reproducible cross-institution research[14]

Implications:

- Johns Hopkins is a strong fit for Abby’s federated deployment posture
- research governance and secure analytics environment integration will matter as much as raw hardware
- OMOP imaging and complex methodological workflows are likely to matter early

Recommended posture:

- deploy into a SAFE or PMAP-like secure analytics environment
- keep OMOP access read-only
- support federated execution patterns first-class
- begin with 1 x 48 GB GPU per inference node only if the initial scope is text-first; otherwise standardize on 2 GPUs per node

## Deployment Architecture Recommendation

### Preferred Architecture

- Site-local Kubernetes or OpenShift deployment
- stateless web and AI services
- dedicated GPU node pool for inference
- dedicated stateful services for PostgreSQL, Redis, and vector retrieval
- private network access to OMOP warehouse or read replica
- institution SSO and RBAC
- audit logging enabled by default

### Not Recommended As The Long-Term Production Design

- one Docker host running app, AI service, vector store, and Ollama together
- direct Abby access to production transactional systems
- unmanaged local model serving with no HA
- central multi-tenant PHI-hosting across institutions

## Deployment Phases

### Phase 1: Site Qualification

Collect:

- OMOP version and source count
- patient count and fact-table scale
- daily or weekly refresh cadence
- whether notes, imaging, and genomics are in scope
- allowed cloud usage posture
- existing GPU or HPC estate
- SSO and audit requirements

Exit criteria:

- clear deployment boundary
- governance approval path identified
- hardware tier selected

### Phase 2: Secure Sandbox

Deploy:

- Abby web and AI tiers
- one institutional inference tier
- read-only OMOP integration
- basic RAG corpus
- audit logging and observability

Validate:

- latency
- concurrency under load
- PHI containment
- correctness of page-context-aware workflows

Exit criteria:

- 10 to 20 pilot users active
- no critical security findings
- no unacceptable queueing under expected pilot load

### Phase 3: Production Hardening

Add:

- HA inference
- PostgreSQL replica
- backup and disaster recovery
- canary releases
- formal model and prompt versioning
- institutional runbooks

Exit criteria:

- production SLOs defined
- rollback tested
- support ownership established

### Phase 4: Enterprise Rollout

Expand:

- more users and departments
- more Abby-enabled pages
- more institutional corpora
- more advanced local tools

Track:

- active users
- p95 response latency
- queue depth and rejection rate
- hallucination and correction rates
- cloud-routing percentage if hybrid mode is enabled

## Software And Packaging Recommendations

For deployment into the mature OMOP TAM, Parthenon should package Abby as:

- a Helm chart or OpenShift-native deployment bundle
- clearly separated CPU and GPU node pools
- environment-variable-based model policy
- first-class support for local-only mode
- optional hybrid routing mode
- institution-owned secrets and model credentials

Near-term software changes that would improve institutional readiness:

- support vLLM as a first-class Abby backend in addition to Ollama
- externalize vector-store choice behind an interface so Chroma can be swapped or consolidated later
- add load-test scripts that simulate streaming Abby traffic
- add inference queue metrics and model replica health to the monitoring stack
- add explicit context-window configuration instead of relying on serving defaults

## Commercial And TAM Recommendation

The strongest near-term TAM is:

- large academic medical centers
- health systems with established OMOP infrastructure
- institutions already participating in OHDSI-style federated analytics
- environments with secure research desktops, HPC, or governed cloud data platforms

The sales motion should be:

- federated local deployment
- site license plus implementation
- methodology and governance review up front
- lighthouse deployments at institutions that already have mature OMOP operations and internal informatics champions

That is a much stronger initial position than trying to sell Abby as a generic AI chatbot for all providers.

## Bottom Line

Abby can run at institutional scale, but not as a casual single-box Ollama install.

For mature OMOP institutions, the correct deployment design is:

- site-local
- federated
- dedicated GPU inference tier
- HA stateful services
- read-only OMOP integration
- explicit governance and audit controls

For hardware, the minimum institutional-grade starting point is:

- 2 GPU inference nodes with 48 GB VRAM minimum per node
- 2 CPU AI nodes
- HA PostgreSQL
- dedicated vector retrieval and Redis services

For methodology and product strategy, the current MedGemma via Ollama stack should remain a pilot and fallback asset, while the institutional production path should move toward a more explicit serving layer and a more validated multi-turn model posture.

## Sources

1. OHDSI, “Who We Are.” https://www.ohdsi.org/who-we-are/
2. Google for Developers, “MedGemma 1.5 model card.” https://developers.google.com/health-ai-developer-foundations/medgemma/model-card
3. Hugging Face, “google/medgemma-4b-it.” https://huggingface.co/google/medgemma-4b-it
4. Ollama, “FAQ.” https://docs.ollama.com/faq
5. Ollama, “Context length.” https://docs.ollama.com/context-length
6. vLLM, “Optimization and Tuning.” https://docs.vllm.ai/en/latest/configuration/optimization/
7. vLLM, “Using Kubernetes.” https://docs.vllm.ai/en/latest/deployment/k8s/
8. vLLM, “OpenAI-Compatible Server.” https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
9. Mount Sinai, “Mount Sinai Data Warehouse (MSDW) De-identified OMOP Data Set.” https://labs.icahn.mssm.edu/minervalab/resources/data-ark/mount-sinai-data-warehouse-msdw-de-identified-omop-data-set/
10. Mount Sinai, “Mount Sinai Data Warehouse.” https://labs.icahn.mssm.edu/msdw/
11. Mount Sinai, “AIR·MS: Artificial Intelligence Ready Mount Sinai.” https://labs.icahn.mssm.edu/minervalab/air-ms-artificial-intelligence-ready-mount-sinai/
12. Johns Hopkins Medicine, “New Tool Transforms Data Collection for Clinical Research.” https://www.hopkinsmedicine.org/news/articles/2022/09/new-tool-transforms-data-collection-for-clinical-research
13. Johns Hopkins BIDS, “Real World Data.” https://bids.jhmi.edu/data-science-communities/real-world-data/
14. Johns Hopkins BIDS, “OHDSI.” https://bids.jhmi.edu/inform-communities/ohdsi/
