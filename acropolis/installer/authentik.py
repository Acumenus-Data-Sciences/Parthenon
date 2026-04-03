# installer/authentik.py
"""Authentik SSO bootstrap — creates proxy + OAuth2 providers and applications.

Authentik requires TWO provider types per service:

1. **Proxy provider** + forward-auth application (`{slug}-fwd`):
   Used by the Traefik `authentik@docker` middleware. The embedded outpost
   intercepts requests and redirects unauthenticated users to Authentik login.

2. **OAuth2/OIDC provider** + OIDC application (`{slug}`):
   Used by services that do native OIDC login (Superset, DataHub, pgAdmin,
   Grafana). These providers issue real OAuth2 tokens with client_id/secret.

Both provider types must be linked to separate applications and registered
with the embedded outpost. The bootstrap creates both layers and writes
the OAuth2 credentials to .env.

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


@dataclass
class ServiceDef:
    """Definition of a downstream service needing Authentik SSO."""

    name: str  # Slug base (e.g. "superset")
    display_name: str  # Human-readable name
    external_host: str  # External URL template (with {domain} placeholder)
    # OAuth2/OIDC redirect URIs for native login (with {domain} placeholder)
    oidc_redirect_uris: list[str]
    # Which .env vars to write the OAuth2 client_id/secret to
    env_client_id: str
    env_client_secret: str
    # Whether this service does native OIDC (vs just Traefik forward-auth)
    native_oidc: bool = True


# All services gated by Authentik
SERVICE_DEFS: list[ServiceDef] = [
    ServiceDef(
        name="grafana",
        display_name="Grafana",
        external_host="https://grafana.{domain}",
        oidc_redirect_uris=["https://grafana.{domain}/login/generic_oauth"],
        env_client_id="GRAFANA_OAUTH_CLIENT_ID",
        env_client_secret="GRAFANA_OAUTH_CLIENT_SECRET",
    ),
    ServiceDef(
        name="superset",
        display_name="Apache Superset",
        external_host="https://superset.{domain}",
        oidc_redirect_uris=["https://superset.{domain}/oauth-authorized/authentik"],
        env_client_id="AUTHENTIK_SUPERSET_CLIENT_ID",
        env_client_secret="AUTHENTIK_SUPERSET_CLIENT_SECRET",
    ),
    ServiceDef(
        name="datahub",
        display_name="DataHub",
        external_host="https://datahub.{domain}",
        oidc_redirect_uris=["https://datahub.{domain}/callback/oidc"],
        env_client_id="AUTHENTIK_DATAHUB_CLIENT_ID",
        env_client_secret="AUTHENTIK_DATAHUB_CLIENT_SECRET",
    ),
    ServiceDef(
        name="pgadmin",
        display_name="pgAdmin",
        external_host="https://pgadmin.{domain}",
        oidc_redirect_uris=["https://pgadmin.{domain}/oauth2/authorize"],
        env_client_id="AUTHENTIK_PGADMIN_CLIENT_ID",
        env_client_secret="AUTHENTIK_PGADMIN_CLIENT_SECRET",
    ),
    ServiceDef(
        name="portainer",
        display_name="Portainer",
        external_host="https://portainer.{domain}",
        oidc_redirect_uris=[],
        env_client_id="AUTHENTIK_PORTAINER_CLIENT_ID",
        env_client_secret="AUTHENTIK_PORTAINER_CLIENT_SECRET",
        native_oidc=False,
    ),
    ServiceDef(
        name="n8n",
        display_name="n8n",
        external_host="https://n8n.{domain}",
        oidc_redirect_uris=[],
        env_client_id="AUTHENTIK_N8N_CLIENT_ID",
        env_client_secret="AUTHENTIK_N8N_CLIENT_SECRET",
        native_oidc=False,
    ),
    ServiceDef(
        name="wazuh",
        display_name="Wazuh SIEM",
        external_host="https://wazuh.{domain}",
        oidc_redirect_uris=[],
        env_client_id="",
        env_client_secret="",
        native_oidc=False,
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

    def list_oauth2_providers(self) -> list[dict]:
        """List all OAuth2 providers."""
        result = self.get("/api/v3/providers/oauth2/?page_size=100")
        return result.get("results", [])

    def list_proxy_providers(self) -> list[dict]:
        """List all proxy providers."""
        result = self.get("/api/v3/providers/proxy/?page_size=100")
        return result.get("results", [])

    def list_all_providers(self) -> list[dict]:
        """List all providers (any type)."""
        result = self.get("/api/v3/providers/all/?page_size=200")
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

    def list_certificate_keypairs(self) -> list[dict]:
        """List available certificate-key pairs for token signing."""
        result = self.get("/api/v3/crypto/certificatekeypairs/?page_size=50")
        return result.get("results", [])

    def list_outposts(self) -> list[dict]:
        """List all outposts."""
        result = self.get("/api/v3/outposts/instances/?page_size=50")
        return result.get("results", [])

    def list_property_mappings(self, managed_only: bool = True) -> list[dict]:
        """List OIDC scope property mappings."""
        url = "/api/v3/propertymappings/provider/scope/?page_size=100"
        if managed_only:
            url += "&managed__isnull=false"
        result = self.get(url)
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


def bootstrap_authentik(
    domain: str,
    console: Console,
) -> bool:
    """Bootstrap Authentik SSO — proxy providers, OAuth2 providers, and applications.

    For each service, creates:
    - A proxy provider + forward-auth app ({slug}-fwd) for Traefik middleware
    - An OAuth2 provider + OIDC app ({slug}) for native OIDC login (if applicable)
    - Configures the embedded outpost with all providers
    - Writes OAuth2 credentials to .env

    Idempotent and safe on existing installations. Never reassigns existing
    application providers — creates new ones alongside.

    Returns True on success, False on failure.
    """
    console.print("\n[bold cyan]Authentik SSO Bootstrap[/]\n")

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

    # ── Lookup prerequisites ────────────────────────────────────────────
    console.print("  Looking up flows and keys...", end=" ")

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

    keypairs = api.list_certificate_keypairs()
    signing_key = None
    for kp in keypairs:
        if "authentik" in kp.get("name", "").lower() or kp.get("managed", ""):
            signing_key = kp["pk"]
            break
    if not signing_key and keypairs:
        signing_key = keypairs[0]["pk"]

    mapping_pks = [m["pk"] for m in api.list_property_mappings()]
    console.print("[green]OK[/]")

    # ── Get existing state ──────────────────────────────────────────────
    existing_proxy = {p["name"]: p for p in api.list_proxy_providers()}
    existing_oauth2 = {p["name"]: p for p in api.list_oauth2_providers()}
    existing_apps = {a["slug"]: a for a in api.list_applications()}

    # Track all provider PKs that should be in the outpost
    outpost_provider_pks: list[int] = []
    created_credentials: dict[str, tuple[str, str]] = {}

    for svc in SERVICE_DEFS:
        console.print(f"  {svc.display_name}...", end=" ")
        external_host = svc.external_host.replace("{domain}", domain)
        fwd_slug = f"{svc.name}-fwd"
        fwd_provider_name = f"{svc.display_name} Forward Auth"

        # ── Layer 1: Proxy provider + forward-auth app ──────────────────
        # Find existing proxy provider by name patterns OR by external_host URL.
        # Providers may have been created manually or by an older bootstrap with
        # different naming (e.g. "n8n Automation Provider" vs "n8n Forward Auth").
        proxy_provider = None
        for candidate in [fwd_provider_name,
                          f"{svc.display_name} Provider",
                          f"{svc.display_name} Forward Auth Provider"]:
            if candidate in existing_proxy:
                proxy_provider = existing_proxy[candidate]
                break
        if proxy_provider is None:
            # Fallback: match by external_host URL
            for p in existing_proxy.values():
                if p.get("external_host", "").rstrip("/") == external_host.rstrip("/"):
                    proxy_provider = p
                    break

        if proxy_provider is not None:
            console.print("[dim]proxy exists[/]", end=" ")
        else:
            try:
                proxy_provider = api.post(
                    "/api/v3/providers/proxy/",
                    {
                        "name": fwd_provider_name,
                        "authorization_flow": auth_flow_pk,
                        "invalidation_flow": inval_flow_pk,
                        "external_host": external_host,
                        "mode": "forward_single",
                    },
                )
                console.print("[green]proxy[/]", end=" ")
            except HTTPError as e:
                body = e.read().decode() if hasattr(e, "read") else str(e)
                console.print(f"[red]proxy failed: {body}[/]")
                continue

        outpost_provider_pks.append(proxy_provider["pk"])

        # Forward-auth application
        if fwd_slug not in existing_apps:
            try:
                api.post(
                    "/api/v3/core/applications/",
                    {
                        "name": f"{svc.display_name} (Forward Auth)",
                        "slug": fwd_slug,
                        "provider": proxy_provider["pk"],
                        "meta_launch_url": external_host,
                        "policy_engine_mode": "any",
                    },
                )
            except HTTPError:
                pass  # Non-fatal — app may exist under different slug

        # ── Layer 2: OAuth2 provider + OIDC app (native OIDC only) ──────
        if svc.native_oidc:
            oauth2_provider_name = f"{svc.display_name} OAuth2"

            if oauth2_provider_name in existing_oauth2:
                oauth2_provider = existing_oauth2[oauth2_provider_name]
            else:
                redirect_uri_objects = [
                    {"matching_mode": "strict", "url": uri.replace("{domain}", domain)}
                    for uri in svc.oidc_redirect_uris
                ]
                payload: dict = {
                    "name": oauth2_provider_name,
                    "authorization_flow": auth_flow_pk,
                    "invalidation_flow": inval_flow_pk,
                    "redirect_uris": redirect_uri_objects,
                    "client_type": "confidential",
                    "sub_mode": "hashed_user_id",
                    "include_claims_in_id_token": True,
                    "property_mappings": mapping_pks,
                }
                if signing_key:
                    payload["signing_key"] = signing_key

                try:
                    oauth2_provider = api.post("/api/v3/providers/oauth2/", payload)
                except HTTPError as e:
                    body = e.read().decode() if hasattr(e, "read") else str(e)
                    console.print(f"[red]oauth2 failed: {body}[/]")
                    continue

            outpost_provider_pks.append(oauth2_provider["pk"])

            # OIDC application — create if missing, but NEVER reassign existing
            if svc.name not in existing_apps:
                try:
                    api.post(
                        "/api/v3/core/applications/",
                        {
                            "name": svc.display_name,
                            "slug": svc.name,
                            "provider": oauth2_provider["pk"],
                            "meta_launch_url": external_host,
                            "policy_engine_mode": "any",
                        },
                    )
                except HTTPError:
                    pass  # Non-fatal

            # Store credentials
            client_id = oauth2_provider.get("client_id", "")
            client_secret = oauth2_provider.get("client_secret", "")
            if client_id and client_secret:
                created_credentials[svc.name] = (client_id, client_secret)

        console.print("[green]OK[/]")

    # ── Configure embedded outpost ──────────────────────────────────────
    console.print("  Configuring embedded outpost...", end=" ")
    try:
        outposts = api.list_outposts()
        embedded = None
        for op in outposts:
            if op.get("type") == "proxy" or "embedded" in op.get("name", "").lower():
                embedded = op
                break

        if embedded:
            existing_pks = embedded.get("providers", [])
            merged_pks = list(set(existing_pks + outpost_provider_pks))
            api.patch(
                f"/api/v3/outposts/instances/{embedded['pk']}/",
                {"providers": merged_pks},
            )
            console.print(f"[green]OK ({len(merged_pks)} providers)[/]")
        else:
            console.print("[yellow]no embedded outpost found[/]")
    except (HTTPError, URLError) as e:
        console.print(f"[yellow]skipped ({e})[/]")

    # ── Write credentials to .env ───────────────────────────────────────
    console.print("  Updating .env with OAuth2 credentials...", end=" ")
    updates = 0
    for svc in SERVICE_DEFS:
        if svc.name in created_credentials and svc.env_client_id:
            client_id, client_secret = created_credentials[svc.name]
            _update_env_var(svc.env_client_id, client_id)
            _update_env_var(svc.env_client_secret, client_secret)
            # Grafana uses duplicate env vars
            if svc.name == "grafana":
                _update_env_var("AUTHENTIK_GRAFANA_CLIENT_ID", client_id)
                _update_env_var("AUTHENTIK_GRAFANA_CLIENT_SECRET", client_secret)
            updates += 1
    console.print(f"[green]{updates} services configured[/]")

    console.print(
        f"\n  [green]Authentik SSO bootstrap complete: "
        f"{len(created_credentials)}/{sum(1 for s in SERVICE_DEFS if s.native_oidc)} "
        f"OIDC services + "
        f"{len(SERVICE_DEFS)} forward-auth services configured[/]"
    )

    return True
