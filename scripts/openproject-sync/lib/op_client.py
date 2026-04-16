"""OpenProject API v3 client."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import requests


@dataclass
class OpConfig:
    base_url: str
    api_key: str
    verify_ssl: bool = True


class OpenProjectClient:
    def __init__(self, config: OpConfig) -> None:
        self._config = config
        self._session = requests.Session()
        self._session.auth = ("apikey", config.api_key)
        self._session.headers.update({"Content-Type": "application/json"})

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _url(self, path: str) -> str:
        base = self._config.base_url.rstrip("/")
        return f"{base}/api/v3{path}"

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        resp = self._session.get(
            self._url(path),
            params=params,
            verify=self._config.verify_ssl,
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: dict[str, Any]) -> Any:
        resp = self._session.post(
            self._url(path),
            json=data,
            verify=self._config.verify_ssl,
        )
        resp.raise_for_status()
        return resp.json()

    def _patch(self, path: str, data: dict[str, Any]) -> Any:
        resp = self._session.patch(
            self._url(path),
            json=data,
            verify=self._config.verify_ssl,
        )
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------ #
    # Projects                                                             #
    # ------------------------------------------------------------------ #

    def get_project(self, project_id: int | str) -> dict[str, Any]:
        return self._get(f"/projects/{project_id}")

    def list_projects(self) -> list[dict[str, Any]]:
        data = self._get("/projects", params={"pageSize": 100})
        return data.get("_embedded", {}).get("elements", [])

    def create_subproject(
        self,
        parent_id: int | str,
        identifier: str,
        name: str,
        description: str = "",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "identifier": identifier,
            "name": name,
            "description": {"format": "markdown", "raw": description},
            "_links": {
                "parent": {"href": f"/api/v3/projects/{parent_id}"},
            },
        }
        return self._post("/projects", payload)

    # ------------------------------------------------------------------ #
    # Versions                                                             #
    # ------------------------------------------------------------------ #

    def list_versions(self, project_id: int | str) -> list[dict[str, Any]]:
        data = self._get(f"/projects/{project_id}/versions")
        return data.get("_embedded", {}).get("elements", [])

    def create_version(
        self,
        project_id: int | str,
        name: str,
        description: str = "",
        status: str = "open",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "name": name,
            "description": {"format": "markdown", "raw": description},
            "status": status,
            "_links": {
                "definingProject": {"href": f"/api/v3/projects/{project_id}"},
            },
        }
        return self._post("/versions", payload)

    # ------------------------------------------------------------------ #
    # Work packages                                                        #
    # ------------------------------------------------------------------ #

    def list_work_packages(
        self, project_id: int | str, page_size: int = 100
    ) -> list[dict[str, Any]]:
        """Fetch ALL work packages for a project, following pagination."""
        results: list[dict[str, Any]] = []
        offset = 1
        while True:
            data = self._get(
                f"/projects/{project_id}/work_packages",
                params={"pageSize": page_size, "offset": offset},
            )
            elements: list[dict[str, Any]] = (
                data.get("_embedded", {}).get("elements", [])
            )
            results.extend(elements)
            total: int = data.get("total", 0)
            if len(results) >= total or not elements:
                break
            offset += 1
        return results

    def get_work_package(self, wp_id: int | str) -> dict[str, Any]:
        return self._get(f"/work_packages/{wp_id}")

    def create_work_package(
        self,
        project_id: int | str,
        subject: str,
        description: str = "",
        type_id: int = 1,
        status_id: int = 1,
        parent_id: int | str | None = None,
        version_id: int | str | None = None,
    ) -> dict[str, Any]:
        links: dict[str, Any] = {
            "project": {"href": f"/api/v3/projects/{project_id}"},
            "type": {"href": f"/api/v3/types/{type_id}"},
            "status": {"href": f"/api/v3/statuses/{status_id}"},
        }
        if parent_id is not None:
            links["parent"] = {"href": f"/api/v3/work_packages/{parent_id}"}
        if version_id is not None:
            links["version"] = {"href": f"/api/v3/versions/{version_id}"}

        payload: dict[str, Any] = {
            "subject": subject,
            "description": {"format": "markdown", "raw": description},
            "_links": links,
        }
        return self._post(f"/projects/{project_id}/work_packages", payload)

    def update_work_package(
        self, wp_id: int | str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        # OpenProject requires lockVersion for PATCH; fetch it first if absent.
        if "lockVersion" not in updates:
            current = self.get_work_package(wp_id)
            updates = {"lockVersion": current["lockVersion"], **updates}
        return self._patch(f"/work_packages/{wp_id}", updates)

    def update_wp_status(self, wp_id: int | str, status_id: int) -> dict[str, Any]:
        current = self.get_work_package(wp_id)
        return self._patch(
            f"/work_packages/{wp_id}",
            {
                "lockVersion": current["lockVersion"],
                "_links": {"status": {"href": f"/api/v3/statuses/{status_id}"}},
            },
        )

    # ------------------------------------------------------------------ #
    # Relations                                                            #
    # ------------------------------------------------------------------ #

    def add_wp_relation(
        self,
        from_id: int | str,
        to_id: int | str,
        relation_type: str = "follows",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "relationtype": relation_type,
            "_links": {
                "from": {"href": f"/api/v3/work_packages/{from_id}"},
                "to": {"href": f"/api/v3/work_packages/{to_id}"},
            },
        }
        return self._post(f"/work_packages/{from_id}/relations", payload)

    # ------------------------------------------------------------------ #
    # Meta                                                                 #
    # ------------------------------------------------------------------ #

    def list_types(self) -> list[dict[str, Any]]:
        data = self._get("/types")
        return data.get("_embedded", {}).get("elements", [])

    def list_statuses(self) -> list[dict[str, Any]]:
        data = self._get("/statuses")
        return data.get("_embedded", {}).get("elements", [])
