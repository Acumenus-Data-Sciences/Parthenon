"""Local web-based installer launcher for Parthenon."""
from __future__ import annotations

import json
import socket
import subprocess
import tempfile
import threading
import webbrowser
from contextlib import contextmanager
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from . import config, launcher, preflight, utils


STATIC_DIR = launcher.resource_path("installer/web")

_CONTENT_TYPES: dict[str, str] = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json",
}


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length) if length else b"{}"
    return json.loads(raw.decode("utf-8") or "{}")


def _json(handler: BaseHTTPRequestHandler, payload: dict[str, Any], status: int = 200) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


@dataclass
class InstallState:
    running: bool = False
    status: str = "Ready"
    logs: list[str] = field(default_factory=list)
    success: bool = False
    summary: dict[str, Any] | None = None
    thread: threading.Thread | None = None
    proc: subprocess.Popen | None = None


class InstallerBackend:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.install_state = InstallState()

    @contextmanager
    def _use_repo_root(self, repo_path: str):
        original_repo_root = utils.REPO_ROOT
        try:
            resolved = launcher.validate_repo_path(repo_path or launcher.default_repo_path())
            utils.REPO_ROOT = resolved
            yield resolved
        finally:
            utils.REPO_ROOT = original_repo_root

    def bootstrap(self) -> dict[str, Any]:
        defaults = config.build_config_defaults()
        return {
            "defaults": defaults,
            "repo_path": launcher.default_repo_path(),
            "wsl_distro": launcher.default_wsl_distro(),
            "wsl_repo_path": launcher.default_wsl_repo_path(),
            "platform": {"windows": launcher.is_windows_host()},
        }

    def validate_launch_context(self, payload: dict[str, Any]) -> dict[str, str]:
        repo_path = str(payload.get("repo_path") or "").strip()
        wsl_distro = str(payload.get("wsl_distro") or "").strip()
        wsl_repo_path = str(payload.get("wsl_repo_path") or "").strip()
        if launcher.is_windows_host():
            if not repo_path and not wsl_repo_path:
                raise ValueError("repo_path or wsl_repo_path is required on Windows")
            return {"repo_path": repo_path, "wsl_distro": wsl_distro, "wsl_repo_path": wsl_repo_path}
        launcher.validate_repo_path(repo_path or launcher.default_repo_path())
        return {"repo_path": repo_path or launcher.default_repo_path(), "wsl_distro": "", "wsl_repo_path": ""}

    def grouped_preflight(self, payload: dict[str, Any]) -> dict[str, Any]:
        repo_path = str(payload.get("repo_path") or "")
        with self._use_repo_root(repo_path) as resolved:
            checks = preflight.run_checks(payload)

        def section(items: list[preflight.CheckResult], title: str, action: str) -> dict[str, Any]:
            return {
                "title": title,
                "action": action,
                "checks": [{"name": c.name, "status": c.status, "detail": c.detail} for c in items],
            }

        runtime = [
            c
            for c in checks
            if c.name
            in {
                "Python ≥ 3.9",
                "Operating system",
                "Docker ≥ 24.0",
                "Docker Compose v2",
                "Docker daemon",
                "Linux docker group",
            }
        ]
        workspace = [c for c in checks if c.name in {"Disk space ≥ 5 GB", "Repo complete", "Existing install", "PHP vendor dir"}]
        ports = [c for c in checks if c.name.startswith("Port ")]
        failures = [c for c in checks if c.status == "fail"]
        warnings = [c for c in checks if c.status == "warn"]
        return {
            "repo_root": str(resolved),
            "failures": len(failures),
            "warnings": len(warnings),
            "sections": [
                section(runtime, "Runtime Dependencies", "Fix Docker, Compose, Python, or Linux docker-group issues before installation."),
                section(workspace, "Workspace Readiness", "Confirm the selected repo, free disk, and whether an existing install is acceptable."),
                section(ports, "Port Availability", "Free these ports or change the mapped ports later in the wizard."),
            ],
        }

    def validate_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.validate_launch_context(payload)
        if payload.get("dry_run"):
            return config.build_config_defaults(payload)
        return config.validate_config(payload)

    def start_install(self, payload: dict[str, Any], *, upgrade: bool) -> None:
        if payload.get("dry_run"):
            launch_context = self.validate_launch_context(payload)
            normalized = config.build_config_defaults(payload)
            normalized["repo_path"] = launch_context["repo_path"]
            with self._lock:
                self.install_state = InstallState(
                    running=False,
                    status="Dry run complete",
                    logs=[
                        "Dry run mode enabled.",
                        "Required installer fields were relaxed for walkthrough purposes.",
                        "No files were written and no installation commands were executed.",
                    ],
                    success=True,
                    summary=normalized,
                )
            return
        normalized = self.validate_config(payload)
        launch_context = self.validate_launch_context(payload)

        with self._lock:
            if self.install_state.running:
                raise ValueError("An installation is already running")
            self.install_state = InstallState(
                running=True,
                status="Starting installer...",
                logs=["Preparing temporary defaults file..."],
                success=False,
                summary=normalized,
            )
            thread = threading.Thread(
                target=self._run_install,
                args=(normalized, launch_context, upgrade),
                daemon=True,
            )
            self.install_state.thread = thread
            thread.start()

    def _run_install(self, normalized: dict[str, Any], launch_context: dict[str, str], upgrade: bool) -> None:
        temp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".json", prefix="parthenon-installer-", delete=False) as handle:
                json.dump(normalized, handle, indent=2)
                temp_path = handle.name

            cmd, cwd = launcher.build_install_command(
                defaults_path=temp_path,
                upgrade=upgrade,
                repo_path=launch_context["repo_path"],
                wsl_distro=launch_context["wsl_distro"],
                wsl_repo_path=launch_context["wsl_repo_path"],
            )
            proc = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            with self._lock:
                self.install_state.proc = proc
            assert proc.stdout is not None
            for line in proc.stdout:
                with self._lock:
                    self.install_state.logs.append(line.rstrip("\n"))
            rc = proc.wait()
            with self._lock:
                self.install_state.running = False
                self.install_state.success = rc == 0
                self.install_state.status = "Installation complete" if rc == 0 else f"Installer failed with status {rc}"
        except Exception as exc:
            with self._lock:
                self.install_state.running = False
                self.install_state.success = False
                self.install_state.status = f"Launcher failed: {exc}"
                self.install_state.logs.append(f"Launcher error: {exc}")
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)

    def install_status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "running": self.install_state.running,
                "status": self.install_state.status,
                "logs": self.install_state.logs,
                "success": self.install_state.success,
                "summary": self.install_state.summary,
            }


class InstallerHandler(BaseHTTPRequestHandler):
    backend: InstallerBackend

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/bootstrap":
            _json(self, self.backend.bootstrap())
            return
        if parsed.path == "/api/install/status":
            _json(self, self.backend.install_status())
            return
        if parsed.path in {"/", "/index.html"}:
            self._serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return
        if parsed.path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        # Special case: background image served from frontend assets
        if parsed.path == "/assets/parthenon-login-bg.png":
            self._serve_file(launcher.resource_path("frontend/public/parthenon-login-bg.png"), "image/png")
            return
        # Generalized static file serving with path traversal prevention
        requested = (STATIC_DIR / parsed.path.lstrip("/")).resolve()
        if requested.is_file() and str(requested).startswith(str(STATIC_DIR.resolve())):
            ext = requested.suffix.lower()
            content_type = _CONTENT_TYPES.get(ext)
            if content_type:
                self._serve_file(requested, content_type)
                return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin", "")
        if origin and not origin.startswith(("http://127.0.0.1", "http://localhost")):
            _json(self, {"error": "Forbidden origin"}, status=403)
            return
        parsed = urlparse(self.path)
        try:
            payload = _read_json(self)
            if parsed.path == "/api/validate-launch":
                _json(self, {"context": self.backend.validate_launch_context(payload)})
                return
            if parsed.path == "/api/preflight":
                context = self.backend.validate_launch_context(payload)
                _json(self, self.backend.grouped_preflight({**payload, **context}))
                return
            if parsed.path == "/api/validate":
                _json(self, {"config": self.backend.validate_config(payload)})
                return
            if parsed.path == "/api/install/start":
                self.backend.start_install(payload, upgrade=bool(payload.get("upgrade")))
                _json(self, {"ok": True})
                return
            self.send_error(HTTPStatus.NOT_FOUND)
        except Exception as exc:
            _json(self, {"error": str(exc)}, status=400)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def _serve_file(self, path: Path, content_type: str) -> None:
        if not path.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _find_port(preferred: int = 7777) -> int:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", preferred))
        sock.close()
        return preferred
    except OSError:
        sock.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        return port


def main() -> None:
    port = _find_port()
    backend = InstallerBackend()

    class BoundHandler(InstallerHandler):
        pass

    BoundHandler.backend = backend
    server = ThreadingHTTPServer(("127.0.0.1", port), BoundHandler)
    url = f"http://127.0.0.1:{port}/"
    webbrowser.open(url)
    print(f"Parthenon installer running at {url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if backend.install_state.proc and backend.install_state.proc.poll() is None:
            backend.install_state.proc.terminate()
            backend.install_state.proc.wait(timeout=5)
