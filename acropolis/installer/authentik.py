# installer/authentik.py
"""Authentik SSO bootstrap — forward-auth only via Traefik embedded outpost.

All Acropolis services use a single authentication model:

    Internet → Apache (TLS) → Traefik → Authentik Forward Auth → Backend

Each service gets exactly ONE proxy provider (forward_single mode) and ONE
application. The embedded outpost handles all authentication via Traefik's
`authentik@docker` middleware. No native OAuth2/OIDC — services use their
own internal auth after the SSO gate.

Idempotent — safe to re-run on an existing Authentik instance.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from rich.console import Console

from acropolis.installer.utils import REPO_ROOT, container_health


@dataclass(frozen=True)
class ServiceDef:
    """Definition of a downstream service needing Authentik forward auth."""

    name: str  # Slug (e.g. "superset")
    display_name: str  # Human-readable name
    external_host: str  # External URL template (with {domain} placeholder)


# All services gated by Authentik forward auth
SERVICE_DEFS: list[ServiceDef] = [
    ServiceDef(
        name="grafana",
        display_name="Grafana",
        external_host="https://grafana.{domain}",
    ),
    ServiceDef(
        name="superset",
        display_name="Apache Superset",
        external_host="https://superset.{domain}",
    ),
    ServiceDef(
        name="datahub",
        display_name="DataHub",
        external_host="https://datahub.{domain}",
    ),
    ServiceDef(
        name="pgadmin",
        display_name="pgAdmin",
        external_host="https://pgadmin.{domain}",
    ),
    ServiceDef(
        name="portainer",
        display_name="Portainer",
        external_host="https://portainer.{domain}",
    ),
    ServiceDef(
        name="n8n",
        display_name="n8n",
        external_host="https://n8n.{domain}",
    ),
    ServiceDef(
        name="wazuh",
        display_name="Wazuh SIEM",
        external_host="https://wazuh.{domain}",
    ),
]


class AuthentikAPI:
    """Thin wrapper around the Authentik REST API v3."""

    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict] = None,
    ) -> dict:
        url = f"{self.base_url}{path}"
        body = json.dumps(data).encode() if data else None
        req = Request(url, data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")

        response = urlopen(req, timeout=30)
        raw = response.read().decode()
        return json.loads(raw) if raw.strip() else {}

    def get(self, path: str) -> dict:
        return self._request("GET", path)

    def post(self, path: str, data: dict) -> dict:
        return self._request("POST", path, data)

    def patch(self, path: str, data: dict) -> dict:
        return self._request("PATCH", path, data)

    def delete(self, path: str) -> None:
        """Send a DELETE request (returns no body)."""
        url = f"{self.base_url}{path}"
        req = Request(url, method="DELETE")
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Accept", "application/json")
        urlopen(req, timeout=30)

    def list_proxy_providers(self) -> list[dict]:
        """List all proxy providers."""
        result = self.get("/api/v3/providers/proxy/?page_size=100")
        return result.get("results", [])

    def list_oauth2_providers(self) -> list[dict]:
        """List all OAuth2 providers."""
        result = self.get("/api/v3/providers/oauth2/?page_size=100")
        return result.get("results", [])

    def list_applications(self) -> list[dict]:
        """List all applications."""
        result = self.get("/api/v3/core/applications/?page_size=100")
        return result.get("results", [])

    def list_flows(self, designation: str) -> list[dict]:
        """List flows by designation (authorization, invalidation, etc.)."""
        result = self.get(
            f"/api/v3/flows/instances/?designation={designation}&page_size=50"
        )
        return result.get("results", [])

    def list_outposts(self) -> list[dict]:
        """List all outposts."""
        result = self.get("/api/v3/outposts/instances/?page_size=50")
        return result.get("results", [])


def _read_env_file() -> dict[str, str]:
    """Parse the .env file into a dict."""
    env_path = REPO_ROOT / ".env"
    env_vars: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                env_vars[key.strip()] = value.strip()
    return env_vars


def _update_env_var(key: str, value: str) -> None:
    """Update a single variable in the .env file, or append if not present."""
    env_path = REPO_ROOT / ".env"
    content = env_path.read_text()
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)

    if pattern.search(content):
        content = pattern.sub(f"{key}={value}", content)
    else:
        if not content.endswith("\n"):
            content += "\n"
        content += f"{key}={value}\n"

    env_path.write_text(content)


def _wait_for_authentik(console: Console, timeout: int = 120) -> bool:
    """Wait for Authentik server to become healthy."""
    console.print("  Waiting for Authentik to become healthy...", end=" ")
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        status = container_health("acropolis-authentik-server")
        if status == "healthy":
            console.print("[green]OK[/]")
            return True
        time.sleep(3)
    console.print("[red]TIMEOUT[/]")
    return False


def _wait_for_api(api: AuthentikAPI, console: Console, timeout: int = 60) -> bool:
    """Wait for the Authentik API to respond with valid auth."""
    console.print("  Waiting for Authentik API...", end=" ")
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            api.get("/api/v3/core/applications/?page_size=1")
            console.print("[green]OK[/]")
            return True
        except HTTPError as e:
            if e.code == 403:
                console.print("[yellow]token expired, resetting...[/]", end=" ")
                if _reset_bootstrap_token(api.token, console):
                    try:
                        api.get("/api/v3/core/applications/?page_size=1")
                        console.print("[green]OK[/]")
                        return True
                    except (URLError, HTTPError, OSError):
                        pass
                console.print("[red]FAILED[/]")
                return False
            time.sleep(3)
        except (URLError, OSError):
            time.sleep(3)
    console.print("[red]TIMEOUT[/]")
    return False


def _reset_bootstrap_token(token_key: str, console: Console) -> bool:
    """Reset the admin API token via Authentik's Django shell."""
    from acropolis.installer.utils import exec_in_container

    script = (
        "from authentik.core.models import Token, User; "
        "admin = User.objects.get(username='akadmin'); "
        "Token.objects.filter(identifier='api-admin').delete(); "
        f"Token.objects.create(identifier='api-admin', user=admin, key='{token_key}', "
        "intent='api', expiring=False); "
        "print('OK')"
    )
    result = exec_in_container(
        "acropolis-authentik-server",
        ["ak", "shell", "-c", script],
    )
    return "OK" in (result.stdout or "")


def _find_proxy_provider(
    svc: ServiceDef,
    domain: str,
    existing_proxy: dict[str, dict],
) -> dict | None:
    """Find an existing proxy provider by name patterns or external_host URL."""
    external_host = svc.external_host.replace("{domain}", domain)
    candidates = [
        f"{svc.display_name} Forward Auth",
        f"{svc.display_name} Provider",
        f"{svc.display_name} Forward Auth Provider",
    ]
    for name in candidates:
        if name in existing_proxy:
            return existing_proxy[name]
    # Fallback: match by external_host URL
    for p in existing_proxy.values():
        if p.get("external_host", "").rstrip("/") == external_host.rstrip("/"):
            return p
    return None


def _cleanup_oauth2_providers(api: AuthentikAPI, console: Console) -> None:
    """Remove any orphaned OAuth2 providers and their applications.

    Forward auth is the only authentication model. OAuth2 providers are
    artifacts from earlier bootstrap versions and must be removed to prevent
    confusion and duplicate authentication flows.
    """
    # Collect service names for matching
    service_names = {svc.name for svc in SERVICE_DEFS}

    # Find OAuth2 providers that correspond to our managed services
    oauth2_providers = api.list_oauth2_providers()
    # Exclude providers that are actually proxy-provider internal OAuth2 entries
    # (proxy providers appear in the oauth2 list too — filter by component type)
    standalone_oauth2 = [
        p for p in oauth2_providers
        if not any(
            p["name"].endswith("Forward Auth")
            or p["name"].endswith("Forward Auth Provider")
            or p["name"].endswith("Provider")
            for _ in [None]  # Force evaluation
        )
        or "OAuth" in p["name"]
    ]

    if not standalone_oauth2:
        return

    # Find applications linked to standalone OAuth2 providers
    apps = api.list_applications()
    oauth2_pks = {p["pk"] for p in standalone_oauth2}

    apps_to_delete = [
        a for a in apps
        if a.get("provider") in oauth2_pks
        and a["slug"] in service_names  # Only delete apps with bare service slugs
    ]

    if apps_to_delete or standalone_oauth2:
        console.print("  Cleaning up legacy OAuth2 providers...", end=" ")
        deleted = 0

        # Delete applications first (they reference providers)
        for app in apps_to_delete:
            try:
                api.delete(f"/api/v3/core/applications/{app['slug']}/")
                deleted += 1
            except (HTTPError, URLError):
                pass

        # Delete standalone OAuth2 providers
        for p in standalone_oauth2:
            # Skip if this is actually a proxy provider's internal OAuth2 entry
            if any(
                p["name"] == f"{svc.display_name} Forward Auth"
                or p["name"] == f"{svc.display_name} Provider"
                for svc in SERVICE_DEFS
            ):
                continue
            try:
                api.delete(f"/api/v3/providers/oauth2/{p['pk']}/")
                deleted += 1
            except (HTTPError, URLError):
                pass

        if deleted:
            console.print(f"[green]removed {deleted} legacy entries[/]")
        else:
            console.print("[dim]none to remove[/]")


def bootstrap_authentik(
    domain: str,
    console: Console,
) -> bool:
    """Bootstrap Authentik SSO — forward-auth proxy providers only.

    For each service, creates:
    - ONE proxy provider (forward_single mode) for Traefik middleware
    - ONE application linked to that provider

    Configures the embedded outpost with all proxy providers.

    No OAuth2/OIDC providers are created. Services that need internal auth
    (Wazuh, n8n, Grafana, etc.) use their own login after the SSO gate.

    Idempotent and safe on existing installations.

    Returns True on success, False on failure.
    """
    console.print("\n[bold cyan]Authentik SSO Bootstrap (Forward Auth)[/]\n")

    # Read bootstrap token from .env
    env_vars = _read_env_file()
    token = env_vars.get("AUTHENTIK_BOOTSTRAP_TOKEN", "")
    if not token:
        console.print("[red]AUTHENTIK_BOOTSTRAP_TOKEN not found in .env[/]")
        return False

    if not _wait_for_authentik(console):
        return False

    api = AuthentikAPI("http://localhost:9000", token)
    if not _wait_for_api(api, console):
        return False

    # ── Cleanup legacy OAuth2 providers from earlier bootstrap versions ──
    _cleanup_oauth2_providers(api, console)

    # ── Lookup prerequisite flows ──────────────────────────────────────
    console.print("  Looking up authorization flows...", end=" ")

    auth_flow_pk = None
    for flow in api.list_flows("authorization"):
        if "default-provider-authorization" in flow.get("slug", ""):
            auth_flow_pk = flow["pk"]
            break
    if not auth_flow_pk:
        flows = api.list_flows("authorization")
        auth_flow_pk = flows[0]["pk"] if flows else None

    inval_flow_pk = None
    for flow in api.list_flows("invalidation"):
        if "default-provider-invalidation" in flow.get("slug", ""):
            inval_flow_pk = flow["pk"]
            break
    if not inval_flow_pk:
        flows = api.list_flows("invalidation")
        inval_flow_pk = flows[0]["pk"] if flows else None

    if not auth_flow_pk or not inval_flow_pk:
        console.print("[red]FAILED — missing flows[/]")
        return False
    console.print("[green]OK[/]")

    # ── Create proxy providers and applications ────────────────────────
    existing_proxy = {p["name"]: p for p in api.list_proxy_providers()}
    existing_apps = {a["slug"]: a for a in api.list_applications()}

    outpost_provider_pks: list[int] = []

    for svc in SERVICE_DEFS:
        console.print(f"  {svc.display_name}...", end=" ")
        external_host = svc.external_host.replace("{domain}", domain)
        provider_name = f"{svc.display_name} Forward Auth"

        # ── Proxy provider ─────────────────────────────────────────────
        proxy_provider = _find_proxy_provider(svc, domain, existing_proxy)

        if proxy_provider is not None:
            # Ensure consistent naming
            if proxy_provider["name"] != provider_name:
                try:
                    api.patch(
                        f"/api/v3/providers/proxy/{proxy_provider['pk']}/",
                        {
                            "name": provider_name,
                            "mode": "forward_single",
                            "external_host": external_host,
                            "authorization_flow": auth_flow_pk,
                        },
                    )
                except (HTTPError, URLError):
                    pass  # Non-fatal — rename is cosmetic
            console.print("[dim]proxy exists[/]", end=" ")
        else:
            try:
                proxy_provider = api.post(
                    "/api/v3/providers/proxy/",
                    {
                        "name": provider_name,
                        "authorization_flow": auth_flow_pk,
                        "invalidation_flow": inval_flow_pk,
                        "external_host": external_host,
                        "mode": "forward_single",
                    },
                )
                console.print("[green]proxy created[/]", end=" ")
            except HTTPError as e:
                body = e.read().decode() if hasattr(e, "read") else str(e)
                console.print(f"[red]proxy failed: {body}[/]")
                continue

        outpost_provider_pks.append(proxy_provider["pk"])

        # ── Application ────────────────────────────────────────────────
        # Use the clean service slug (not -fwd suffix)
        if svc.name in existing_apps:
            # Ensure it points to our proxy provider
            app = existing_apps[svc.name]
            if app.get("provider") != proxy_provider["pk"]:
                try:
                    api.patch(
                        f"/api/v3/core/applications/{svc.name}/",
                        {"provider": proxy_provider["pk"]},
                    )
                except (HTTPError, URLError):
                    pass
            console.print("[dim]app exists[/]", end=" ")
        else:
            try:
                api.post(
                    "/api/v3/core/applications/",
                    {
                        "name": svc.display_name,
                        "slug": svc.name,
                        "provider": proxy_provider["pk"],
                        "meta_launch_url": external_host,
                        "policy_engine_mode": "any",
                    },
                )
                console.print("[green]app created[/]", end=" ")
            except HTTPError:
                pass  # Non-fatal

        console.print("[green]OK[/]")

    # ── Configure embedded outpost with ONLY proxy providers ───────────
    console.print("  Configuring embedded outpost...", end=" ")
    try:
        outposts = api.list_outposts()
        embedded = None
        for op in outposts:
            if op.get("type") == "proxy" or "embedded" in op.get("name", "").lower():
                embedded = op
                break

        if embedded:
            # Replace (not merge) — only proxy providers belong in the outpost
            api.patch(
                f"/api/v3/outposts/instances/{embedded['pk']}/",
                {"providers": outpost_provider_pks},
            )
            console.print(
                f"[green]OK ({len(outpost_provider_pks)} providers)[/]"
            )
        else:
            console.print("[yellow]no embedded outpost found[/]")
    except (HTTPError, URLError) as e:
        console.print(f"[yellow]skipped ({e})[/]")

    console.print(
        f"\n  [green]Authentik SSO bootstrap complete: "
        f"{len(outpost_provider_pks)} forward-auth services configured[/]"
    )

    return True
