#!/usr/bin/env python3
"""Webhook server for Parthenon n8n automation.

Listens on 0.0.0.0:9876 for n8n workflow requests.
Handles blog post writing, documentation sync, and doc rebuilds.

Endpoints:
  GET  /health         — health check
  GET  /git-logs       — gather 24h git logs from all repos
  GET  /codebase-state — full codebase state for drift detection
  POST /write-post     — write markdown blog post and git commit
  POST /write-sync-files — write multiple doc/help/installer files and commit
  POST /deploy-docs    — rebuild Docusaurus docs

Usage:
    python3 blog-webhook.py              # Start server
    python3 blog-webhook.py --port 9876  # Custom port
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BLOG_DIR = REPO_ROOT / "docs" / "blog"
REPOS_DIR = REPO_ROOT.parent  # ~/Github/

REPOS = ["Parthenon", "MediCosts", "Aurora", "Medgnosis", "MindLog", "Zephyrus"]

# Paths for codebase state gathering
FRONTEND_FEATURES_DIR = REPO_ROOT / "frontend" / "src" / "features"
HELP_DIR = REPO_ROOT / "backend" / "resources" / "help"
DOCS_DIR = REPO_ROOT / "docs" / "site" / "docs"
SIDEBARS_FILE = REPO_ROOT / "docs" / "site" / "sidebars.ts"
INSTALLER_DIR = REPO_ROOT / "installer"
DOCKER_COMPOSE = REPO_ROOT / "docker-compose.yml"
API_ROUTES = REPO_ROOT / "backend" / "routes" / "api.php"
SIDEBAR_TSX = REPO_ROOT / "frontend" / "src" / "components" / "layout" / "Sidebar.tsx"
DEVLOG_DIR = REPO_ROOT / "docs" / "devlog"
CONSOLE_COMMANDS_DIR = REPO_ROOT / "backend" / "app" / "Console" / "Commands"


def run_cmd(cmd, cwd=None, timeout=120):
    """Run a shell command and return stdout."""
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=timeout
    )
    return result.stdout.strip(), result.stderr.strip(), result.returncode


class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sys.stderr.write(f"[{ts}] {fmt % args}\n")

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok"})
        elif self.path == "/git-logs":
            self._handle_git_logs()
        elif self.path == "/codebase-state":
            self._handle_codebase_state()
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}

        if self.path == "/write-post":
            self._handle_write_post(body)
        elif self.path == "/write-sync-files":
            self._handle_write_sync_files(body)
        elif self.path == "/deploy-docs":
            self._handle_deploy_docs()
        else:
            self._respond(404, {"error": "not found"})

    # ── GET /git-logs ────────────────────────────────────────────────

    def _handle_git_logs(self):
        """Gather git logs from all repos for the last 24 hours."""
        logs = {}
        total = 0
        for repo in REPOS:
            repo_dir = REPOS_DIR / repo
            if not (repo_dir / ".git").exists():
                continue
            stdout, _, rc = run_cmd(
                "git log --since='1 day ago' --pretty=format:'%h|||%s|||%an' --no-merges",
                cwd=str(repo_dir),
            )
            if rc == 0 and stdout:
                commits = []
                for line in stdout.strip().split("\n"):
                    parts = line.split("|||")
                    if len(parts) == 3:
                        commits.append(
                            {"hash": parts[0], "message": parts[1], "author": parts[2]}
                        )
                if commits:
                    logs[repo] = commits
                    total += len(commits)

        devlog_dir = REPO_ROOT / "docs" / "devlog"
        devlog_content = ""
        if devlog_dir.exists():
            yesterday = datetime.now() - timedelta(days=1)
            for md_file in devlog_dir.rglob("*.md"):
                if md_file.stat().st_mtime > yesterday.timestamp():
                    content = md_file.read_text()[:2000]
                    devlog_content += f"\n=== {md_file.name} ===\n{content}\n"

        self._respond(200, {
            "repos": logs,
            "total_commits": total,
            "repo_count": len(logs),
            "devlog_content": devlog_content[:4000],
        })

    # ── GET /codebase-state ──────────────────────────────────────────

    def _handle_codebase_state(self):
        """Gather full codebase state for drift detection."""
        state = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "frontend_features": self._get_frontend_features(),
            "help_files": self._get_help_files(),
            "docusaurus_pages": self._get_docusaurus_pages(),
            "sidebars": self._get_sidebars(),
            "route_help_mapping": self._get_route_help_mapping(),
            "installer_state": self._get_installer_state(),
            "docker_services": self._get_docker_services(),
            "artisan_commands": self._get_artisan_commands(),
            "recent_devlogs": self._get_recent_devlogs(),
            "git_log_week": self._get_git_log_week(),
        }
        self._respond(200, state)

    def _get_frontend_features(self):
        """List all frontend feature directories."""
        if not FRONTEND_FEATURES_DIR.exists():
            return []
        return sorted(d.name for d in FRONTEND_FEATURES_DIR.iterdir() if d.is_dir())

    def _get_help_files(self):
        """List all help JSON files and their content summary."""
        if not HELP_DIR.exists():
            return {}
        result = {}
        for f in sorted(HELP_DIR.glob("*.json")):
            try:
                data = json.loads(f.read_text())
                result[f.stem] = {
                    "title": data.get("title", ""),
                    "docs_url": data.get("docs_url", ""),
                    "tip_count": len(data.get("tips", [])),
                }
            except (json.JSONDecodeError, OSError):
                result[f.stem] = {"error": "parse_failed"}
        return result

    def _get_docusaurus_pages(self):
        """List all .mdx documentation pages with their frontmatter."""
        if not DOCS_DIR.exists():
            return {}
        result = {}
        for f in sorted(DOCS_DIR.rglob("*.mdx")):
            rel = str(f.relative_to(DOCS_DIR))
            content = f.read_text()
            # Extract frontmatter
            fm = {}
            fm_match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
            if fm_match:
                for line in fm_match.group(1).split("\n"):
                    if ":" in line:
                        key, val = line.split(":", 1)
                        fm[key.strip()] = val.strip().strip('"')
            result[rel] = {
                "id": fm.get("id", ""),
                "title": fm.get("title", ""),
                "sidebar_label": fm.get("sidebar_label", ""),
                "size_bytes": len(content),
                "mtime": f.stat().st_mtime,
            }
        return result

    def _get_sidebars(self):
        """Read sidebars.ts and extract referenced doc IDs."""
        if not SIDEBARS_FILE.exists():
            return {"raw": "", "doc_ids": []}
        content = SIDEBARS_FILE.read_text()
        # Extract all quoted doc IDs from sidebars.ts
        doc_ids = re.findall(r'"([\w/-]+)"', content)
        # Filter to likely doc references (contain / or are 'intro')
        doc_refs = [d for d in doc_ids if "/" in d or d == "intro"]
        return {"raw": content, "doc_ids": doc_refs}

    def _get_route_help_mapping(self):
        """Extract the route-to-help-key mapping from Sidebar.tsx."""
        if not SIDEBAR_TSX.exists():
            return {}
        content = SIDEBAR_TSX.read_text()
        # Find the routeHelpKeys object
        match = re.search(
            r"routeHelpKeys:\s*Record<string,\s*string>\s*=\s*\{(.*?)\}",
            content, re.DOTALL,
        )
        if not match:
            return {}
        mapping = {}
        for line in match.group(1).split("\n"):
            pair = re.search(r'"([^"]+)":\s*"([^"]+)"', line)
            if pair:
                mapping[pair.group(1)] = pair.group(2)
        return mapping

    def _get_installer_state(self):
        """Extract key configuration from installer files."""
        state = {"ports": {}, "services": [], "prereqs_url": "", "app_version": ""}

        # Extract port defaults from config.py
        config_file = INSTALLER_DIR / "config.py"
        if config_file.exists():
            content = config_file.read_text()
            port_patterns = {
                "nginx": r"nginx_port\s*=\s*(\d+)",
                "postgres": r"postgres_port\s*=\s*(\d+)",
                "redis": r"redis_port\s*=\s*(\d+)",
                "ai": r"ai_port\s*=\s*(\d+)",
                "solr": r"solr_port\s*=\s*(\d+)",
            }
            for name, pattern in port_patterns.items():
                match = re.search(pattern, content)
                if match:
                    state["ports"][name] = int(match.group(1))

            # PREREQS_URL
            url_match = re.search(r'PREREQS_URL\s*=\s*"([^"]+)"', content)
            if url_match:
                state["prereqs_url"] = url_match.group(1)

            # APP_VERSION
            ver_match = re.search(r'APP_VERSION.*?["\'](\d+\.\d+\.\d+)["\']', content)
            if ver_match:
                state["app_version"] = ver_match.group(1)

        # Extract services from docker_ops.py
        ops_file = INSTALLER_DIR / "docker_ops.py"
        if ops_file.exists():
            content = ops_file.read_text()
            svc_matches = re.findall(
                r'\("(\w[\w-]*)",\s*"(parthenon-\w+)",\s*(\d+)\)',
                content,
            )
            state["services"] = [
                {"compose_name": m[0], "container_name": m[1], "timeout": int(m[2])}
                for m in svc_matches
            ]

        # Extract required ports from preflight.py
        pre_file = INSTALLER_DIR / "preflight.py"
        if pre_file.exists():
            content = pre_file.read_text()
            ports_match = re.search(r"REQUIRED_PORTS\s*=\s*\[([^\]]+)\]", content)
            if ports_match:
                state["preflight_ports"] = [
                    int(p.strip()) for p in ports_match.group(1).split(",") if p.strip()
                ]

        return state

    def _get_docker_services(self):
        """Parse docker-compose.yml for services and ports."""
        if not DOCKER_COMPOSE.exists():
            return {}
        content = DOCKER_COMPOSE.read_text()
        services = {}
        current_svc = None
        in_ports = False

        for line in content.split("\n"):
            # Top-level service definition (2-space indent, ends with :)
            svc_match = re.match(r"^  (\w[\w-]*):\s*$", line)
            if svc_match:
                current_svc = svc_match.group(1)
                services[current_svc] = {"ports": [], "container_name": ""}
                in_ports = False
                continue

            if current_svc:
                # container_name
                cn_match = re.match(r"^\s+container_name:\s*(.+)", line)
                if cn_match:
                    services[current_svc]["container_name"] = cn_match.group(1).strip()

                # ports section
                if re.match(r"^\s+ports:\s*$", line):
                    in_ports = True
                    continue
                if in_ports:
                    port_match = re.match(r'^\s+-\s*["\']?(\S+)', line)
                    if port_match:
                        services[current_svc]["ports"].append(port_match.group(1).strip("\"'"))
                    elif not line.strip().startswith("-") and line.strip():
                        in_ports = False

        return services

    def _get_artisan_commands(self):
        """List custom artisan command classes."""
        if not CONSOLE_COMMANDS_DIR.exists():
            return []
        commands = []
        for f in sorted(CONSOLE_COMMANDS_DIR.glob("*.php")):
            content = f.read_text()
            sig_match = re.search(r"signature\s*=\s*['\"]([^'\"]+)['\"]", content)
            if sig_match:
                commands.append({"file": f.name, "signature": sig_match.group(1)})
        return commands

    def _get_recent_devlogs(self):
        """Get devlog files modified in the last 7 days with content excerpts."""
        if not DEVLOG_DIR.exists():
            return []
        cutoff = datetime.now().timestamp() - (7 * 86400)
        results = []
        for f in sorted(DEVLOG_DIR.rglob("*.md")):
            if f.stat().st_mtime > cutoff:
                content = f.read_text()
                results.append({
                    "path": str(f.relative_to(DEVLOG_DIR)),
                    "mtime": f.stat().st_mtime,
                    "excerpt": content[:3000],
                })
        return results[:20]  # Limit to 20 most recent

    def _get_git_log_week(self):
        """Get Parthenon git log for the past 7 days."""
        stdout, _, rc = run_cmd(
            "git log --since='7 days ago' --pretty=format:'%h|||%s|||%an|||%aI' --no-merges",
            cwd=str(REPO_ROOT),
        )
        if rc != 0 or not stdout:
            return []
        commits = []
        for line in stdout.split("\n"):
            parts = line.split("|||")
            if len(parts) == 4:
                commits.append({
                    "hash": parts[0], "message": parts[1],
                    "author": parts[2], "date": parts[3],
                })
        return commits[:100]  # Limit

    # ── POST /write-post ─────────────────────────────────────────────

    def _handle_write_post(self, body):
        """Write a blog post markdown file, git commit."""
        markdown = body.get("markdown", "")
        filename = body.get("filename", "")

        if not markdown or not filename:
            self._respond(400, {"error": "markdown and filename required"})
            return

        if not filename.endswith(".md") or "/" in filename or ".." in filename:
            self._respond(400, {"error": "invalid filename"})
            return

        filepath = BLOG_DIR / filename
        filepath.write_text(markdown)

        stdout, stderr, rc = run_cmd(
            f'git add docs/blog/{filename} && git commit -m "docs: add daily dev blog post for {filename.replace(".md", "").replace("-dev-diary", "")}"',
            cwd=str(REPO_ROOT),
        )

        if rc != 0:
            self._respond(500, {"error": f"git commit failed: {stderr}", "stdout": stdout})
            return

        self._respond(200, {"status": "ok", "file": str(filepath), "git": stdout})

    # ── POST /write-sync-files ───────────────────────────────────────

    def _handle_write_sync_files(self, body):
        """Write multiple files for doc/help/installer sync and commit."""
        files_written = []
        errors = []

        # Write Docusaurus pages
        for item in body.get("docusaurus", []):
            path = item.get("path", "")
            content = item.get("content", "")
            if not path or not content:
                continue
            # Validate path is under docs/site/docs/
            if ".." in path or not path.endswith(".mdx"):
                errors.append(f"invalid docusaurus path: {path}")
                continue
            full_path = DOCS_DIR / path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)
            files_written.append(f"docs/site/docs/{path}")

        # Write sidebars.ts if provided
        if body.get("sidebars_ts"):
            SIDEBARS_FILE.write_text(body["sidebars_ts"])
            files_written.append("docs/site/sidebars.ts")

        # Write help JSON files
        for item in body.get("help", []):
            key = item.get("key", "")
            content = item.get("content", {})
            if not key or not content:
                continue
            if ".." in key or "/" in key:
                errors.append(f"invalid help key: {key}")
                continue
            filepath = HELP_DIR / f"{key}.json"
            filepath.write_text(json.dumps(content, indent=2))
            files_written.append(f"backend/resources/help/{key}.json")

        # Write installer patches
        for item in body.get("installer", []):
            filename = item.get("filename", "")
            content = item.get("content", "")
            if not filename or not content:
                continue
            if ".." in filename or "/" in filename:
                errors.append(f"invalid installer filename: {filename}")
                continue
            filepath = INSTALLER_DIR / filename
            if not filepath.exists():
                errors.append(f"installer file not found: {filename}")
                continue
            filepath.write_text(content)
            files_written.append(f"installer/{filename}")

        # Update Sidebar.tsx route mapping if provided
        if body.get("sidebar_tsx_mapping"):
            self._update_sidebar_route_mapping(body["sidebar_tsx_mapping"])
            files_written.append("frontend/src/components/layout/Sidebar.tsx")

        if not files_written:
            self._respond(200, {"status": "no_changes", "errors": errors})
            return

        # Git commit all changes
        git_add = " ".join(f'"{f}"' for f in files_written)
        date_str = datetime.now().strftime("%Y-%m-%d")
        stdout, stderr, rc = run_cmd(
            f'git add {git_add} && git commit -m "docs: automated sync — {len(files_written)} files updated ({date_str})"',
            cwd=str(REPO_ROOT),
        )

        if rc != 0:
            self._respond(500, {
                "error": f"git commit failed: {stderr}",
                "files_written": files_written,
                "errors": errors,
            })
            return

        self._respond(200, {
            "status": "ok",
            "files_written": files_written,
            "errors": errors,
            "git": stdout,
        })

    def _update_sidebar_route_mapping(self, new_mapping):
        """Update the routeHelpKeys object in Sidebar.tsx."""
        if not SIDEBAR_TSX.exists():
            return
        content = SIDEBAR_TSX.read_text()
        # Build new mapping string
        entries = []
        for route, key in sorted(new_mapping.items(), key=lambda x: x[0]):
            entries.append(f'  "{route}": "{key}",')
        new_obj = "{\n" + "\n".join(entries) + "\n}"
        # Replace the existing mapping
        content = re.sub(
            r"(routeHelpKeys:\s*Record<string,\s*string>\s*=\s*)\{.*?\}",
            rf"\g<1>{new_obj}",
            content,
            flags=re.DOTALL,
        )
        SIDEBAR_TSX.write_text(content)

    # ── POST /deploy-docs ────────────────────────────────────────────

    def _handle_deploy_docs(self):
        """Rebuild Docusaurus documentation."""
        deploy_script = REPO_ROOT / "deploy.sh"
        if not deploy_script.exists():
            self._respond(500, {"error": "deploy.sh not found"})
            return

        stdout, stderr, rc = run_cmd(
            "./deploy.sh --docs", cwd=str(REPO_ROOT)
        )

        self._respond(
            200 if rc == 0 else 500,
            {"status": "ok" if rc == 0 else "error", "stdout": stdout[-2000:], "stderr": stderr[-1000:]},
        )


def main():
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 9876
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    print(f"Parthenon webhook listening on http://0.0.0.0:{port}")
    print(f"  GET  /health         — health check")
    print(f"  GET  /git-logs       — gather 24h git logs from all repos")
    print(f"  GET  /codebase-state — full codebase state for drift detection")
    print(f"  POST /write-post     — write markdown blog post and git commit")
    print(f"  POST /write-sync-files — write doc/help/installer files and commit")
    print(f"  POST /deploy-docs    — rebuild Docusaurus docs")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()


if __name__ == "__main__":
    main()
