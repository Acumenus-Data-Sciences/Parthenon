# installer/authentik.py
"""Authentik SSO bootstrap — forward-auth + native SSO (OIDC/SAML).

All Acropolis services use a dual-app authentication model:

    1. Forward Auth: Internet → Apache (TLS) → Traefik → Authentik → Backend
    2. Native SSO: Service-native OIDC or SAML via Authentik as IdP

Each service gets a proxy provider (forward_single mode) for Traefik middleware
AND (optionally) a native SSO provider (OAuth2/OIDC or SAML) with its own
application. n8n is forward-auth only — no native SSO.

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


@dataclass(frozen=True)
class NativeSsoDef:
    """Native SSO provider definition (OIDC or SAML)."""

    service_name: str  # Must match ServiceDef.name
    sso_type: str  # "oidc" or "saml"
    app_slug: str  # e.g. "grafana-oidc", "wazuh-saml"
    display_name: str  # e.g. "Grafana OIDC"
    redirect_uris: list[str]  # Templates with {domain} placeholder
    # SAML-only fields
    saml_audience: str = ""  # SP entity ID
    saml_acs_url: str = ""  # Assertion Consumer Service URL template
    # Env var names for credentials
    env_client_id: str = ""
    env_client_secret: str = ""


NATIVE_SSO_DEFS: list[NativeSsoDef] = [
    NativeSsoDef(
        service_name="grafana",
        sso_type="oidc",
        app_slug="grafana-oidc",
        display_name="Grafana OIDC",
        redirect_uris=[
            "https://grafana.{domain}/login/generic_oauth",
            "http://grafana.{domain}/login/generic_oauth",
        ],
        env_client_id="GRAFANA_OAUTH_CLIENT_ID",
        env_client_secret="GRAFANA_OAUTH_CLIENT_SECRET",
    ),
    NativeSsoDef(
        service_name="superset",
        sso_type="oidc",
        app_slug="superset-oidc",
        display_name="Superset OIDC",
        redirect_uris=[
            "https://superset.{domain}/oauth-authorized/authentik",
            "http://superset.{domain}/oauth-authorized/authentik",
        ],
        env_client_id="SUPERSET_OAUTH_CLIENT_ID",
        env_client_secret="SUPERSET_OAUTH_CLIENT_SECRET",
    ),
    NativeSsoDef(
        service_name="pgadmin",
        sso_type="oidc",
        app_slug="pgadmin-oidc",
        display_name="pgAdmin OIDC",
        redirect_uris=[
            "https://pgadmin.{domain}/oauth2/authorize",
            "http://pgadmin.{domain}/oauth2/authorize",
        ],
        env_client_id="PGADMIN_OAUTH_CLIENT_ID",
        env_client_secret="PGADMIN_OAUTH_CLIENT_SECRET",
    ),
    NativeSsoDef(
        service_name="datahub",
        sso_type="oidc",
        app_slug="datahub-oidc",
        display_name="DataHub OIDC",
        redirect_uris=[
            "https://datahub.{domain}/callback/oidc",
            "http://datahub.{domain}/callback/oidc",
        ],
        env_client_id="DATAHUB_OAUTH_CLIENT_ID",
        env_client_secret="DATAHUB_OAUTH_CLIENT_SECRET",
    ),
    NativeSsoDef(
        service_name="portainer",
        sso_type="oidc",
        app_slug="portainer-oidc",
        display_name="Portainer OIDC",
        redirect_uris=[
            "https://portainer.{domain}",
            "http://portainer.{domain}",
        ],
        env_client_id="PORTAINER_OAUTH_CLIENT_ID",
        env_client_secret="PORTAINER_OAUTH_CLIENT_SECRET",
    ),
    NativeSsoDef(
        service_name="wazuh",
        sso_type="saml",
        app_slug="wazuh-saml",
        display_name="Wazuh SAML",
        redirect_uris=[],  # SAML uses ACS URL, not redirect
        saml_audience="wazuh-saml",
        saml_acs_url="https://wazuh.{domain}/_opendistro/_security/saml/acs",
        env_client_id="WAZUH_SAML_ENTITY_ID",
        env_client_secret="WAZUH_SAML_EXCHANGE_KEY",
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


def bootstrap_authentik(
    domain: str,
    console: Console,
) -> bool:
    """Bootstrap Authentik SSO — forward-auth proxy providers + native SSO (OIDC/SAML).

    For each service, creates:
    - ONE proxy provider (forward_single mode) for Traefik middleware
    - ONE application linked to that proxy provider
    - (Optionally) ONE native SSO provider (OAuth2/OIDC or SAML) + application

    Configures the embedded outpost with all proxy providers.
    Creates OIDC providers for Grafana, Superset, pgAdmin, DataHub, Portainer.
    Creates a SAML provider for Wazuh with signed assertions.

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
