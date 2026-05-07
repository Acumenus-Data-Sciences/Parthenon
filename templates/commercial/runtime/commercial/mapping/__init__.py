"""Commercial-tier AI-assisted concept mapping (Plan 6, T-024A).

This package implements the Plan 6 retrieve-then-rerank pipeline:

- ``embedder`` — ``BgeEmbedder`` wraps sentence-transformers + bge-base.
- ``types`` — ``ConceptCandidate`` + ``RerankResult`` Pydantic models.
- ``retriever`` — ``ConceptRetriever`` pgvector top-K wrapper.
- ``reranker`` — ``ConceptReranker`` LLM rerank glue.
- ``suggester_node`` — ``ConceptMappingSuggesterNode`` orchestration.
- ``review_queue_node`` — ``MappingReviewQueueNode`` write-side.

The bge-base weights and torch wheel are heavy (~1 GB combined); both
deps live ONLY in the commercial wheel per ADR 0019.
"""
