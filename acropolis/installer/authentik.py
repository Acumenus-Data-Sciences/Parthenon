# installer/authentik.py
"""Authentik SSO bootstrap — creates OAuth2 providers and applications via API.

This module runs after Authentik is healthy (Phase 7) and:
1. Creates OAuth2/OIDC providers for each downstream service
2. Creates Authentik applications linked to those providers
3. Configures the embedded outpost to proxy all applications
4. Writes the real client IDs/secrets back to .env

Idempotent — safe to re-run on an existing Authentik instance.
"""
from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from rich.console import Console

from acropolis.installer.utils import REPO_ROOT, container_health, generate_password


@dataclass
class OAuthApp:
    """Definition of a downstream service that needs an OAuth2 provider."""

    name: str  # Authentik application slug (e.g. "superset")
    display_name: str  # Human-readable name
    redirect_uris: list[str]  # OAuth2 redirect URIs (with {domain} placeholder)
    launch_url: str  # Application launch URL (with {domain} placeholder)
    # Which .env vars to write the client_id and client_secret to
    env_client_id: str
    env_client_secret: str
    # Whether this service does native OIDC (vs just Traefik forward-auth)
    native_oidc: bool = True


# All services that need OAuth2 providers in Authentik
OAUTH_APPS: list[OAuthApp] = [
    OAuthApp(
        name="grafana",
        display_name="Grafana",
        redirect_uris=["https://grafana.{domain}/login/generic_oauth"],
        launch_url="https://grafana.{domain}/",
        env_client_id="GRAFANA_OAUTH_CLIENT_ID",
        env_client_secret="GRAFANA_OAUTH_CLIENT_SECRET",
    ),
    OAuthApp(
        name="superset",
        display_name="Apache Superset",
        redirect_uris=[
            "https://superset.{domain}/oauth-authorized/authentik",
        ],
        launch_url="https://superset.{domain}/",
        env_client_id="AUTHENTIK_SUPERSET_CLIENT_ID",
        env_client_secret="AUTHENTIK_SUPERSET_CLIENT_SECRET",
    ),
    OAuthApp(
        name="datahub",
        display_name="DataHub",
        redirect_uris=["https://datahub.{domain}/callback/oidc"],
        launch_url="https://datahub.{domain}/",
        env_client_id="AUTHENTIK_DATAHUB_CLIENT_ID",
        env_client_secret="AUTHENTIK_DATAHUB_CLIENT_SECRET",
    ),
    OAuthApp(
        name="pgadmin",
        display_name="pgAdmin",
        redirect_uris=["https://pgadmin.{domain}/oauth2/authorize"],
        launch_url="https://pgadmin.{domain}/",
        env_client_id="AUTHENTIK_PGADMIN_CLIENT_ID",
        env_client_secret="AUTHENTIK_PGADMIN_CLIENT_SECRET",
    ),
    OAuthApp(
        name="portainer",
        display_name="Portainer",
        redirect_uris=["https://portainer.{domain}/"],
        launch_url="https://portainer.{domain}/",
        env_client_id="AUTHENTIK_PORTAINER_CLIENT_ID",
        env_client_secret="AUTHENTIK_PORTAINER_CLIENT_SECRET",
        native_oidc=False,  # Forward-auth only
    ),
    OAuthApp(
        name="n8n",
        display_name="n8n Workflow Automation",
        redirect_uris=["https://n8n.{domain}/"],
        launch_url="https://n8n.{domain}/",
        env_client_id="AUTHENTIK_N8N_CLIENT_ID",
        env_client_secret="AUTHENTIK_N8N_CLIENT_SECRET",
        native_oidc=False,  # Forward-auth only
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

    def list_providers(self) -> list[dict]:
        """List all OAuth2 providers."""
        result = self.get("/api/v3/providers/oauth2/?page_size=100")
        return result.get("results", [])

    def create_provider(
        self,
        name: str,
        redirect_uris: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> dict:
        """Create an OAuth2/OIDC provider. Returns the created provider."""
        payload: dict = {
            "name": name,
            "authorization_flow": None,  # Will be set after lookup
            "invalidation_flow": None,  # Will be set after lookup
            "redirect_uris": redirect_uris,
            "client_type": "confidential",
            "signing_key": None,  # Will be set after lookup
            "sub_mode": "hashed_user_id",
            "include_claims_in_id_token": True,
            "property_mappings": [],  # Will auto-populate with defaults
        }
        if client_id:
            payload["client_id"] = client_id
        if client_secret:
            payload["client_secret"] = client_secret
        return self.post("/api/v3/providers/oauth2/", payload)

    def list_applications(self) -> list[dict]:
        """List all applications."""
        result = self.get("/api/v3/core/applications/?page_size=100")
        return result.get("results", [])

    def create_application(
        self,
        name: str,
        slug: str,
        provider_pk: int,
        launch_url: str,
    ) -> dict:
        """Create an application linked to a provider."""
        return self.post(
            "/api/v3/core/applications/",
            {
                "name": name,
                "slug": slug,
                "provider": provider_pk,
                "meta_launch_url": launch_url,
                "policy_engine_mode": "any",
            },
        )

    def list_flows(self, designation: str) -> list[dict]:
        """List flows by designation (authorization, invalidation, etc.)."""
        result = self.get(f"/api/v3/flows/instances/?designation={designation}&page_size=50")
        return result.get("results", [])

    def list_certificate_keypairs(self) -> list[dict]:
        """List available certificate-key pairs for token signing."""
        result = self.get("/api/v3/crypto/certificatekeypairs/?page_size=50")
        return result.get("results", [])

    def list_outposts(self) -> list[dict]:
        """List all outposts."""
        result = self.get("/api/v3/outposts/instances/?page_size=50")
        return result.get("results", [])

    def update_outpost(self, pk: str, data: dict) -> dict:
        """Update an outpost."""
        return self.patch(f"/api/v3/outposts/instances/{pk}/", data)

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
        # Append under the OAuth section
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
                # Token invalid — try to reset it via Django shell
                console.print("[yellow]token expired, resetting...[/]", end=" ")
                if _reset_bootstrap_token(api.token, console):
                    # Retry immediately
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
        f"Token.objects.create(identifier='api-admin', user=admin, key='{token_key}', intent='api', expiring=False); "
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
    """Bootstrap Authentik OAuth2 providers and applications.

    Creates providers and applications for all downstream services,
    configures the embedded outpost, and writes real credentials to .env.

    Returns True on success, False on failure.
    """
    console.print("\n[bold cyan]Authentik SSO Bootstrap[/]\n")

    # Read bootstrap token from .env
    env_vars = _read_env_file()
    token = env_vars.get("AUTHENTIK_BOOTSTRAP_TOKEN", "")
    if not token:
        console.print("[red]AUTHENTIK_BOOTSTRAP_TOKEN not found in .env[/]")
        return False

    # Wait for Authentik
    if not _wait_for_authentik(console):
        return False

    # Connect to API (internal Docker URL)
    api = AuthentikAPI("http://localhost:9000", token)
    if not _wait_for_api(api, console):
        return False

    # ── Lookup prerequisites ────────────────────────────────────────────
    console.print("  Looking up authorization flows...", end=" ")

    # Find the default authorization flow
    auth_flows = api.list_flows("authorization")
    auth_flow_pk = None
    for flow in auth_flows:
        if "default-provider-authorization" in flow.get("slug", ""):
            auth_flow_pk = flow["pk"]
            break
    if not auth_flow_pk and auth_flows:
        auth_flow_pk = auth_flows[0]["pk"]

    # Find the default invalidation flow
    inval_flows = api.list_flows("invalidation")
    inval_flow_pk = None
    for flow in inval_flows:
        if "default-provider-invalidation" in flow.get("slug", ""):
            inval_flow_pk = flow["pk"]
            break
    if not inval_flow_pk and inval_flows:
        inval_flow_pk = inval_flows[0]["pk"]

    if not auth_flow_pk or not inval_flow_pk:
        console.print("[red]FAILED[/]")
        console.print("[red]Could not find authorization/invalidation flows[/]")
        return False
    console.print("[green]OK[/]")

    # Find signing key (certificate keypair)
    console.print("  Looking up signing keys...", end=" ")
    keypairs = api.list_certificate_keypairs()
    signing_key = None
    for kp in keypairs:
        if "authentik" in kp.get("name", "").lower() or kp.get("managed", ""):
            signing_key = kp["pk"]
            break
    if not signing_key and keypairs:
        signing_key = keypairs[0]["pk"]
    console.print("[green]OK[/]" if signing_key else "[yellow]none (tokens unsigned)[/]")

    # Get default OIDC scope mappings
    console.print("  Looking up property mappings...", end=" ")
    mappings = api.list_property_mappings()
    mapping_pks = [m["pk"] for m in mappings]
    console.print(f"[green]{len(mapping_pks)} found[/]")

    # ── Get existing state ──────────────────────────────────────────────
    existing_providers = {p["name"]: p for p in api.list_providers()}
    existing_apps = {a["slug"]: a for a in api.list_applications()}

    # ── Create providers and applications ───────────────────────────────
    created_credentials: dict[str, tuple[str, str]] = {}

    for app_def in OAUTH_APPS:
        provider_name = f"{app_def.display_name} OAuth2"
        console.print(f"  {app_def.display_name}...", end=" ")

        # Check if provider already exists
        if provider_name in existing_providers:
            provider = existing_providers[provider_name]
            client_id = provider.get("client_id", "")
            client_secret = provider.get("client_secret", "")
            console.print("[dim]provider exists[/]", end=" ")
        else:
            # Build redirect URIs as list of {matching_mode, url} objects
            redirect_uri_objects = [
                {"matching_mode": "strict", "url": uri.replace("{domain}", domain)}
                for uri in app_def.redirect_uris
            ]

            # Create the provider
            payload: dict = {
                "name": provider_name,
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
                provider = api.post("/api/v3/providers/oauth2/", payload)
                client_id = provider.get("client_id", "")
                client_secret = provider.get("client_secret", "")
                console.print("[green]provider created[/]", end=" ")
            except HTTPError as e:
                body = e.read().decode() if hasattr(e, "read") else str(e)
                console.print(f"[red]provider failed: {body}[/]")
                continue

        # Create or update application
        if app_def.name in existing_apps:
            existing_app = existing_apps[app_def.name]
            # If app exists but points to a different provider, update it
            if existing_app.get("provider") != provider["pk"]:
                try:
                    api.patch(
                        f"/api/v3/core/applications/{app_def.name}/",
                        {"provider": provider["pk"]},
                    )
                    console.print("[green]app updated[/]")
                except HTTPError:
                    console.print("[dim]app exists[/]")
            else:
                console.print("[dim]app exists[/]")
        else:
            launch_url = app_def.launch_url.replace("{domain}", domain)
            try:
                api.create_application(
                    name=app_def.display_name,
                    slug=app_def.name,
                    provider_pk=provider["pk"],
                    launch_url=launch_url,
                )
                console.print("[green]app created[/]")
            except HTTPError as e:
                body = e.read().decode() if hasattr(e, "read") else str(e)
                console.print(f"[red]app failed: {body}[/]")
                continue

        # Store credentials for .env update
        if client_id and client_secret:
            created_credentials[app_def.name] = (client_id, client_secret)

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
            # Outpost.providers expects provider PKs (integers), not application PKs
            # Get all our newly created provider PKs
            all_providers = api.list_providers()
            our_provider_names = {f"{a.display_name} OAuth2" for a in OAUTH_APPS}
            new_provider_pks = [
                p["pk"]
                for p in all_providers
                if p["name"] in our_provider_names
            ]

            # Merge with existing providers on the outpost
            existing_pks = embedded.get("providers", [])
            merged_pks = list(set(existing_pks + new_provider_pks))

            api.update_outpost(embedded["pk"], {"providers": merged_pks})
            console.print(f"[green]OK ({len(merged_pks)} providers)[/]")
        else:
            console.print("[yellow]no embedded outpost found[/]")
    except (HTTPError, URLError) as e:
        console.print(f"[yellow]skipped ({e})[/]")

    # ── Write credentials to .env ───────────────────────────────────────
    console.print("  Updating .env with OAuth2 credentials...", end=" ")
    updates = 0
    for app_def in OAUTH_APPS:
        if app_def.name in created_credentials:
            client_id, client_secret = created_credentials[app_def.name]
            _update_env_var(app_def.env_client_id, client_id)
            _update_env_var(app_def.env_client_secret, client_secret)
            # Grafana uses duplicate env vars (GRAFANA_OAUTH_* and AUTHENTIK_GRAFANA_*)
            if app_def.name == "grafana":
                _update_env_var("AUTHENTIK_GRAFANA_CLIENT_ID", client_id)
                _update_env_var("AUTHENTIK_GRAFANA_CLIENT_SECRET", client_secret)
            updates += 1
    console.print(f"[green]{updates} services configured[/]")

    # ── Summary ─────────────────────────────────────────────────────────
    console.print(f"\n  [green]Authentik SSO bootstrap complete: "
                  f"{len(created_credentials)}/{len(OAUTH_APPS)} services configured[/]")

    return True
