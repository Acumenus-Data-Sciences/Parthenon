"""Deterministic Laravel-API levers for the orchestrator (ADR-0020 Phase 5).

Each method is a single authenticated call into the Laravel API using the
study-scoped Sanctum token minted per ADR C3. No PHI is ever passed in or out —
only designs, counts, SMDs, gate metrics, and diagnostics. The API client is
injected so the FSM can be exercised against a fake in unit tests.
"""

from __future__ import annotations

from typing import Any, Optional, Protocol


class ApiCaller(Protocol):
    """The subset of ``AgencyApiClient`` the orchestrator depends on."""

    async def call(
        self,
        method: str,
        path: str,
        auth_token: str,
        data: Optional[dict[str, Any]] = None,
        timeout: float = 60.0,
    ) -> dict[str, Any]: ...


class OrchestratorTools:
    """Thin, deterministic wrappers over the Laravel study/gate/analysis API.

    Every wrapper returns the Laravel ``{"success", "status", "data"|"error"}``
    envelope unchanged so the FSM can branch on success/HTTP status without a
    second HTTP abstraction.
    """

    def __init__(self, api: ApiCaller, auth_token: str, study_ref: str) -> None:
        self._api = api
        self._token = auth_token
        # Route-model binding accepts slug or id; the caller passes whichever it has.
        self._study = str(study_ref)

    async def _get(self, path: str) -> dict[str, Any]:
        return await self._api.call("GET", path, self._token)

    async def _post(
        self, path: str, data: Optional[dict[str, Any]] = None, timeout: float = 60.0
    ) -> dict[str, Any]:
        return await self._api.call("POST", path, self._token, data=data, timeout=timeout)

    # -- Study introspection --------------------------------------------------

    async def get_progress(self) -> dict[str, Any]:
        return await self._get(f"studies/{self._study}/progress")

    async def get_results(self, publishable_only: bool = False) -> dict[str, Any]:
        flag = "true" if publishable_only else "false"
        return await self._get(f"studies/{self._study}/results?publishable_only={flag}")

    # -- Gate ledger ----------------------------------------------------------

    async def get_gates(self) -> dict[str, Any]:
        return await self._get(f"studies/{self._study}/gates")

    async def evaluate_gates(self) -> dict[str, Any]:
        """Recompute the estimation-derived gates (S5 study-diagnostics, S6
        calibration) from the study's completed estimation contrasts."""
        return await self._post(f"studies/{self._study}/gates/evaluate", timeout=120.0)

    # -- Stage actions (deterministic levers) ---------------------------------

    async def run_cohort_diagnostics(self, cohort_definition_id: int, source_id: int) -> dict[str, Any]:
        return await self._post(
            f"cohort-definitions/{cohort_definition_id}/diagnostics",
            {"source_id": source_id},
            timeout=600.0,
        )

    async def run_dqd(self, source_id: int) -> dict[str, Any]:
        return await self._post(f"sources/{source_id}/dqd/run", timeout=120.0)

    async def run_estimation(self, estimation_id: int, source_id: int) -> dict[str, Any]:
        return await self._post(
            f"estimations/{estimation_id}/execute",
            {"source_id": source_id},
            timeout=120.0,
        )

    async def execute_study(self, source_id: int) -> dict[str, Any]:
        return await self._post(
            f"studies/{self._study}/execute",
            {"source_id": source_id},
            timeout=120.0,
        )

    async def draft_manuscript(self) -> dict[str, Any]:
        return await self._post(f"studies/{self._study}/manuscript/draft")

    async def export_publication(self, fmt: str = "docx") -> dict[str, Any]:
        return await self._post(f"studies/{self._study}/manuscript/export", {"format": fmt})
