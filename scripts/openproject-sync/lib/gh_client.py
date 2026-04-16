"""GitHub API client using the gh CLI."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GhConfig:
    repo: str = "sudoshi/Parthenon"


class GitHubClient:
    """Thin wrapper around `gh api` for GitHub REST operations."""

    def __init__(self, config: GhConfig | None = None) -> None:
        self._config = config or GhConfig()

    def _repo(self) -> str:
        return self._config.repo

    def _api(
        self,
        path: str,
        method: str = "GET",
        data: dict[str, Any] | None = None,
    ) -> Any:
        cmd = ["gh", "api", path, "--method", method]
        if data is not None:
            cmd += ["--input", "-"]

        result = subprocess.run(
            cmd,
            input=json.dumps(data).encode() if data is not None else None,
            capture_output=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"gh api {method} {path} failed (exit {result.returncode}): "
                f"{result.stderr.decode().strip()}"
            )
        stdout = result.stdout.strip()
        if not stdout:
            return None
        return json.loads(stdout)

    # ------------------------------------------------------------------
    # Milestones
    # ------------------------------------------------------------------

    def list_milestones(self, state: str = "all") -> list[dict[str, Any]]:
        return self._api(
            f"repos/{self._repo()}/milestones?state={state}&per_page=100"
        )

    def create_milestone(
        self, title: str, description: str, state: str = "open"
    ) -> dict[str, Any]:
        return self._api(
            f"repos/{self._repo()}/milestones",
            method="POST",
            data={"title": title, "description": description, "state": state},
        )

    def update_milestone(
        self, number: int, updates: dict[str, Any]
    ) -> dict[str, Any]:
        return self._api(
            f"repos/{self._repo()}/milestones/{number}",
            method="PATCH",
            data=updates,
        )

    def close_milestone(self, number: int) -> dict[str, Any]:
        return self.update_milestone(number, {"state": "closed"})

    # ------------------------------------------------------------------
    # Issues
    # ------------------------------------------------------------------

    def list_issues(
        self, state: str = "all", per_page: int = 100
    ) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        page = 1
        while True:
            batch: list[dict[str, Any]] = self._api(
                f"repos/{self._repo()}/issues"
                f"?state={state}&per_page={per_page}&page={page}"
            )
            if not batch:
                break
            issues.extend(batch)
            if len(batch) < per_page:
                break
            page += 1
        return issues

    def create_issue(
        self,
        title: str,
        body: str,
        labels: list[str] | None = None,
        milestone: int | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {"title": title, "body": body}
        if labels:
            data["labels"] = labels
        if milestone is not None:
            data["milestone"] = milestone
        return self._api(
            f"repos/{self._repo()}/issues",
            method="POST",
            data=data,
        )

    def update_issue(
        self, number: int, updates: dict[str, Any]
    ) -> dict[str, Any]:
        return self._api(
            f"repos/{self._repo()}/issues/{number}",
            method="PATCH",
            data=updates,
        )

    def close_issue(self, number: int) -> dict[str, Any]:
        return self.update_issue(number, {"state": "closed"})

    # ------------------------------------------------------------------
    # Labels
    # ------------------------------------------------------------------

    def list_labels(self) -> list[dict[str, Any]]:
        return self._api(
            f"repos/{self._repo()}/labels?per_page=100"
        )

    def create_label(
        self, name: str, color: str, description: str = ""
    ) -> dict[str, Any]:
        return self._api(
            f"repos/{self._repo()}/labels",
            method="POST",
            data={"name": name, "color": color, "description": description},
        )

    def ensure_label(
        self, name: str, color: str, description: str = ""
    ) -> dict[str, Any]:
        existing = self.list_labels()
        for label in existing:
            if label["name"] == name:
                return label
        return self.create_label(name, color, description)
