#!/usr/bin/env python3
"""Configure Authentik proxy provider + application + outpost binding for Alfresco.

Standalone script — Alfresco is internal Acumenus infra, not part of the
Acropolis installer (which manages Grafana/Superset/etc.). Uses only stdlib.

Idempotent: safe to re-run. Detects and updates existing objects in place.

Usage:
    # Token from env (recommended)
    AUTHENTIK_BOOTSTRAP_TOKEN=ak-xxx python3 configure_authentik.py

    # Token from CLI
    python3 configure_authentik.py --token ak-xxx

    # Custom domain
    AUTHENTIK_HOST=https://auth.example.net python3 configure_authentik.py

The script:
  1. Locates the authorization + invalidation flows
  2. Finds or creates a Proxy Provider for Alfresco (mode: forward_single)
  3. Finds or creates an Application with slug `alfresco` bound to that provider
  4. Adds the provider to the embedded outpost's provider list

After running, the Traefik `authentik@docker` middleware will recognise
docs.acumenus.net requests and enforce access via the `alfresco` application.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("alfresco.configure_authentik")

SERVICE_NAME = "alfresco"
APPLICATION_SLUG = "alfresco"
APPLICATION_NAME = "Alfresco"
PROVIDER_NAME = "Alfresco Forward Auth"
DEFAULT_AUTHENTIK_HOST = "https://auth.acumenus.net"
DEFAULT_EXTERNAL_HOST_TEMPLATE = "https://docs.{domain}"
DEFAULT_DOMAIN = "acumenus.net"
EMBEDDED_OUTPOST_NAME = "authentik Embedded Outpost"


class AuthentikAPI:
    """Thin Authentik REST client using stdlib only."""

    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _request(
        self,
        method: str,
        path: str,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = json.dumps(data).encode() if data else None
        req = Request(url, data=body, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        response = urlopen(req, timeout=30)  # noqa: S310 — trusted host
        raw = response.read().decode()
        return json.loads(raw) if raw.strip() else {}

    def get(self, path: str) -> dict[str, Any]:
        return self._request("GET", path)

    def post(self, path: str, data: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", path, data)

    def patch(self, path: str, data: dict[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", path, data)

    def list_proxy_providers(self) -> list[dict[str, Any]]:
        return self.get("/api/v3/providers/proxy/?page_size=100").get("results", [])

    def list_applications(self) -> list[dict[str, Any]]:
        return self.get("/api/v3/core/applications/?page_size=100").get("results", [])

    def list_flows(self, designation: str) -> list[dict[str, Any]]:
        path = f"/api/v3/flows/instances/?designation={designation}&page_size=50"
        return self.get(path).get("results", [])

    def list_outposts(self) -> list[dict[str, Any]]:
        return self.get("/api/v3/outposts/instances/?page_size=50").get("results", [])


def _resolve_token(cli_token: str | None) -> str:
    """Token precedence: CLI arg > env var > acropolis/.env file."""
    if cli_token:
        return cli_token

    for env_var in ("AUTHENTIK_BOOTSTRAP_TOKEN", "AUTHENTIK_API_TOKEN"):
        val = os.environ.get(env_var)
        if val:
            logger.info("Using token from $%s", env_var)
            return val

    # Fallback: parse acropolis/.env
    acropolis_env = Path(__file__).resolve().parents[2] / "acropolis" / ".env"
    if acropolis_env.exists():
        for line in acropolis_env.read_text().splitlines():
            line = line.strip()
            if line.startswith("AUTHENTIK_BOOTSTRAP_TOKEN="):
                _, _, val = line.partition("=")
                val = val.strip().strip('"').strip("'")
                if val:
                    logger.info("Using token from acropolis/.env")
                    return val

    logger.error(
        "No Authentik token. Set AUTHENTIK_BOOTSTRAP_TOKEN or pass --token."
    )
    sys.exit(2)


def _find_flow(api: AuthentikAPI, designation: str) -> str:
    """Return the flow PK (UUID string) for the given designation."""
    flows = api.list_flows(designation)
    if not flows:
        logger.error("No %s flow found in Authentik", designation)
        sys.exit(3)
    # Prefer default-*-flow slug if present
    for flow in flows:
        if flow.get("slug", "").startswith(f"default-{designation}"):
            return str(flow["pk"])
    return str(flows[0]["pk"])


def _ensure_provider(
    api: AuthentikAPI,
    external_host: str,
    authorization_flow_pk: str,
    invalidation_flow_pk: str,
) -> dict[str, Any]:
    """Idempotent create-or-update of the Alfresco proxy provider."""
    existing = {p["name"]: p for p in api.list_proxy_providers()}
    payload = {
        "name": PROVIDER_NAME,
        "authorization_flow": authorization_flow_pk,
        "invalidation_flow": invalidation_flow_pk,
        "external_host": external_host,
        "mode": "forward_single",
    }

    if PROVIDER_NAME in existing:
        provider = existing[PROVIDER_NAME]
        pk = provider["pk"]
        logger.info("Provider '%s' exists (pk=%s), updating...", PROVIDER_NAME, pk)
        api.patch(f"/api/v3/providers/proxy/{pk}/", payload)
        return api.get(f"/api/v3/providers/proxy/{pk}/")

    logger.info("Creating provider '%s'...", PROVIDER_NAME)
    return api.post("/api/v3/providers/proxy/", payload)


def _ensure_application(
    api: AuthentikAPI,
    provider_pk: Any,
    external_host: str,
) -> dict[str, Any]:
    """Idempotent create-or-update of the Alfresco application."""
    existing = {a["slug"]: a for a in api.list_applications()}
    payload = {
        "name": APPLICATION_NAME,
        "slug": APPLICATION_SLUG,
        "provider": provider_pk,
        "meta_launch_url": f"{external_host}/share/",
        "meta_description": "Alfresco Content Services — document management",
        "open_in_new_tab": False,
    }

    if APPLICATION_SLUG in existing:
        app = existing[APPLICATION_SLUG]
        logger.info(
            "Application slug='%s' exists (pk=%s), updating...",
            APPLICATION_SLUG,
            app["pk"],
        )
        api.patch(f"/api/v3/core/applications/{APPLICATION_SLUG}/", payload)
        return api.get(f"/api/v3/core/applications/{APPLICATION_SLUG}/")

    logger.info("Creating application slug='%s'...", APPLICATION_SLUG)
    return api.post("/api/v3/core/applications/", payload)


def _ensure_outpost_binding(api: AuthentikAPI, provider_pk: Any) -> None:
    """Add our provider to the embedded outpost's provider list."""
    outposts = api.list_outposts()
    embedded = next(
        (o for o in outposts if o.get("name") == EMBEDDED_OUTPOST_NAME),
        None,
    )
    if embedded is None:
        logger.warning(
            "Embedded outpost '%s' not found — skipping binding. "
            "Available: %s",
            EMBEDDED_OUTPOST_NAME,
            [o.get("name") for o in outposts],
        )
        return

    current_providers = list(embedded.get("providers") or [])
    if provider_pk in current_providers:
        logger.info("Provider already bound to embedded outpost")
        return

    new_providers = sorted(set(current_providers) | {provider_pk})
    logger.info(
        "Binding provider pk=%s to embedded outpost (was %d providers, now %d)",
        provider_pk,
        len(current_providers),
        len(new_providers),
    )
    api.patch(
        f"/api/v3/outposts/instances/{embedded['pk']}/",
        {"providers": new_providers},
    )


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--host",
        default=os.environ.get("AUTHENTIK_HOST", DEFAULT_AUTHENTIK_HOST),
        help=f"Authentik base URL (default: {DEFAULT_AUTHENTIK_HOST})",
    )
    parser.add_argument(
        "--domain",
        default=os.environ.get("DOMAIN", DEFAULT_DOMAIN),
        help=f"Apex domain for docs.{{domain}} external_host (default: {DEFAULT_DOMAIN})",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="Authentik API token (or AUTHENTIK_BOOTSTRAP_TOKEN env)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without making changes",
    )
    args = parser.parse_args()

    token = _resolve_token(args.token)
    external_host = DEFAULT_EXTERNAL_HOST_TEMPLATE.format(domain=args.domain)

    logger.info("Authentik host:  %s", args.host)
    logger.info("External host:   %s", external_host)
    logger.info("Application:     %s (slug=%s)", APPLICATION_NAME, APPLICATION_SLUG)
    logger.info("Provider mode:   forward_single")

    if args.dry_run:
        logger.info("--dry-run: exiting without changes")
        return 0

    api = AuthentikAPI(args.host, token)

    try:
        # 1. Resolve flows
        auth_flow_pk = _find_flow(api, "authorization")
        inval_flow_pk = _find_flow(api, "invalidation")
        logger.info(
            "Flows: authorization=%s invalidation=%s", auth_flow_pk, inval_flow_pk
        )

        # 2. Create/update provider
        provider = _ensure_provider(
            api, external_host, auth_flow_pk, inval_flow_pk
        )
        provider_pk = provider["pk"]
        logger.info("Provider OK: pk=%s", provider_pk)

        # 3. Create/update application
        app = _ensure_application(api, provider_pk, external_host)
        logger.info("Application OK: slug=%s pk=%s", app["slug"], app.get("pk"))

        # 4. Bind to embedded outpost
        _ensure_outpost_binding(api, provider_pk)

    except HTTPError as exc:
        body = exc.read().decode(errors="replace") if hasattr(exc, "read") else ""
        logger.error("HTTP %s from %s: %s", exc.code, exc.url, body)
        return 1
    except URLError as exc:
        logger.error("Network error reaching %s: %s", args.host, exc.reason)
        return 1

    logger.info("Done. Restart/recreate acropolis-traefik is NOT required; "
                "the docker label provider picks up changes live.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
