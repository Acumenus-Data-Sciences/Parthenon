# parthenon-templates

Standalone Python service implementing the Parthenon ingestion-templates runtime:
node SDK (Phase 0 T-001), orchestration adapter (T-002), manifest registry (T-003),
and the `parthenon-cdm` CDM bootstrap helper (T-005).

This package is not exposed via Nginx. It listens on the internal docker network
only and authenticates Laravel via the `X-Parthenon-Internal-Token` header.

See `docs/superpowers/specs/2026-05-02-parthenon-ingestion-templates-phase-0-design.md`
for the full design.
