#!/usr/bin/env python3
"""
Idempotently provision the `parthenon-oidc` application in Authentik.

Creates:
  - OAuth2/OpenID provider named "Parthenon OIDC"
  - Application slug "parthenon-oidc" linked to the provider
  - Attaches default openid/email/profile scope mappings + a groups claim if
    a managed "groups" mapping exists (Authentik ships one by default)
  - Binds the application to the "Parthenon Admins" group so only that group
    can authenticate (additional group check is also enforced server-side
    by OidcReconciliationService)

After running, prints the generated client_id and client_secret. These MUST
be copied into Parthenon's backend/.env as OIDC_CLIENT_ID / OIDC_CLIENT_SECRET
(they are NOT written to any file by this script).

Reads AUTHENTIK_BOOTSTRAP_TOKEN from /home/smudoshi/Github/Parthenon/acropolis/.env
unless --token is provided. Uses https://auth.acumenus.net by default.
"""

from __future__ import annotations

import argparse
import json
import re
import secrets
import string
import sys
import urllib.error
import urllib.request
from pathlib import Path

APP_SLUG = "parthenon-oidc"
APP_NAME = "Parthenon OIDC"
REDIRECT_URI = "https://parthenon.acumenus.net/api/v1/auth/oidc/callback"
REQUIRED_GROUP = "Parthenon Admins"
DEFAULT_AUTH_URL = "https://auth.acumenus.net"
DEFAULT_ENV_PATH = Path("/home/smudoshi/Github/Parthenon/acropolis/.env")


def read_token_from_env(env_path: Path) -> str:
    if not env_path.exists():
        return ""
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("AUTHENTIK_BOOTSTRAP_TOKEN="):
            return line.split("=", 1)[1].strip()
    return ""


class AuthentikAPI:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        url = f"{self.base_url}{path}"
        data = None
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", "replace")
            raise SystemExit(
                f"HTTP {e.code} on {method} {path}: {body_text[:500]}"
            ) from e

    def get(self, path: str) -> dict:
        return self._request("GET", path)

    def post(self, path: str, body: dict) -> dict:
        return self._request("POST", path, body)

    def patch(self, path: str, body: dict) -> dict:
        return self._request("PATCH", path, body)


def find_flow_pk(api: AuthentikAPI, designation: str, prefer_slug: str) -> str:
    flows = api.get(
        f"/api/v3/flows/instances/?designation={designation}&page_size=50"
    ).get("results", [])
    for flow in flows:
        if prefer_slug in flow.get("slug", ""):
            return flow["pk"]
    if not flows:
        raise SystemExit(f"No {designation} flows found in Authentik")
    return flows[0]["pk"]


PARTHENON_GROUPS_MAPPING_NAME = "Parthenon: OAuth2 groups claim"


def find_or_create_groups_mapping(api: AuthentikAPI, dry_run: bool) -> str | None:
    """Find a scope mapping that emits a `groups` claim, creating a Parthenon-owned
    one if none exists. The mapping's expression walks ak_groups.all() and returns
    a list of group names, which Authentik merges into the ID token as `groups`.
    """
    # Look across ALL scope mappings (managed + custom) for one that emits `groups`.
    results = api.get(
        "/api/v3/propertymappings/provider/scope/?page_size=200"
    ).get("results", [])
    for pm in results:
        if pm.get("scope_name") == "groups":
            return pm["pk"]
        if pm.get("name") == PARTHENON_GROUPS_MAPPING_NAME:
            return pm["pk"]
    if dry_run:
        return None
    # Create one. Authentik expression runs in a sandboxed Python context.
    expression = (
        "return {\n"
        "    \"groups\": [group.name for group in request.user.ak_groups.all()],\n"
        "}\n"
    )
    created = api.post(
        "/api/v3/propertymappings/provider/scope/",
        {
            "name": PARTHENON_GROUPS_MAPPING_NAME,
            "scope_name": "groups",
            "description": (
                "Emits a `groups` claim containing the names of all Authentik "
                "groups the user belongs to. Created by Parthenon SSO installer "
                "so the backend reconciler can enforce Parthenon Admins membership."
            ),
            "expression": expression,
        },
    )
    return created["pk"]


def find_oidc_scope_mappings(api: AuthentikAPI, dry_run: bool) -> tuple[list[str], bool]:
    """Return (scope_mapping_pks, groups_mapping_present).

    Required: openid, email, profile (all ship as managed mappings in Authentik).
    Groups: found if any scope mapping emits the `groups` claim; otherwise created.
    """
    wanted = {
        "goauthentik.io/providers/oauth2/scope-openid": None,
        "goauthentik.io/providers/oauth2/scope-email": None,
        "goauthentik.io/providers/oauth2/scope-profile": None,
    }
    results = api.get(
        "/api/v3/propertymappings/all/?page_size=200&managed__startswith=goauthentik.io/providers/oauth2/"
    ).get("results", [])
    for pm in results:
        managed = pm.get("managed") or ""
        if managed in wanted:
            wanted[managed] = pm["pk"]
    missing = [k for k, v in wanted.items() if v is None]
    if missing:
        raise SystemExit(f"Missing required OIDC scope mappings: {missing}")
    pks = [v for v in wanted.values() if v is not None]

    groups_pk = find_or_create_groups_mapping(api, dry_run)
    if groups_pk is not None:
        pks.append(groups_pk)
    return pks, groups_pk is not None


def find_signing_key(api: AuthentikAPI) -> str | None:
    certs = api.get(
        "/api/v3/crypto/certificatekeypairs/?page_size=50"
    ).get("results", [])
    # Prefer the self-signed "authentik Self-signed Certificate"; else first key with a private key.
    for cert in certs:
        if "Self-signed" in (cert.get("name") or "") and cert.get(
            "private_key_available"
        ):
            return cert["pk"]
    for cert in certs:
        if cert.get("private_key_available"):
            return cert["pk"]
    return None


def find_group_pk(api: AuthentikAPI, name: str) -> str | None:
    groups = api.get(
        f"/api/v3/core/groups/?name={urllib_quote(name)}&page_size=10"
    ).get("results", [])
    for g in groups:
        if g.get("name") == name:
            return g["pk"]
    return None


def urllib_quote(s: str) -> str:
    return urllib.request.quote(s, safe="")


def generate_secret(length: int) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def find_existing_provider(api: AuthentikAPI, name: str) -> dict | None:
    providers = api.get(
        "/api/v3/providers/oauth2/?page_size=200"
    ).get("results", [])
    for p in providers:
        if p.get("name") == name:
            return p
    return None


def find_existing_app(api: AuthentikAPI, slug: str) -> dict | None:
    apps = api.get(
        f"/api/v3/core/applications/?slug={slug}"
    ).get("results", [])
    for a in apps:
        if a.get("slug") == slug:
            return a
    return None


def bind_group_policy(api: AuthentikAPI, app_pk_or_slug: str, group_pk: str) -> None:
    """Bind a group-membership policy to the application so only that group can launch it."""
    # Check if a binding already exists for this app + group
    bindings = api.get(
        f"/api/v3/policies/bindings/?target={app_pk_or_slug}&page_size=50"
    ).get("results", [])
    for b in bindings:
        if b.get("group") == group_pk:
            return
    api.post(
        "/api/v3/policies/bindings/",
        {
            "target": app_pk_or_slug,
            "group": group_pk,
            "order": 0,
            "enabled": True,
            "negate": False,
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=DEFAULT_AUTH_URL,
        help=f"Authentik base URL (default: {DEFAULT_AUTH_URL})",
    )
    parser.add_argument(
        "--token",
        default="",
        help="Authentik API token (default: read AUTHENTIK_BOOTSTRAP_TOKEN from acropolis/.env)",
    )
    parser.add_argument(
        "--env-path",
        type=Path,
        default=DEFAULT_ENV_PATH,
        help="Path to acropolis .env holding AUTHENTIK_BOOTSTRAP_TOKEN",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Inspect + report; do not write"
    )
    args = parser.parse_args()

    token = args.token or read_token_from_env(args.env_path)
    if not token:
        raise SystemExit(
            f"No token found. Pass --token or ensure AUTHENTIK_BOOTSTRAP_TOKEN is set in {args.env_path}"
        )

    api = AuthentikAPI(args.base_url, token)

    print(f"→ Authentik: {args.base_url}")
    print(f"→ App slug:  {APP_SLUG}")
    print(f"→ Redirect:  {REDIRECT_URI}")
    print(f"→ Group:     {REQUIRED_GROUP}")
    print()

    # Look up prerequisites
    print("1/5  Resolving authorization/invalidation flows...")
    auth_flow_pk = find_flow_pk(api, "authorization", "default-provider-authorization")
    inval_flow_pk = find_flow_pk(api, "invalidation", "default-provider-invalidation")
    print(f"     auth_flow={auth_flow_pk[:8]}... inval_flow={inval_flow_pk[:8]}...")

    print("2/5  Resolving OIDC scope mappings (openid, email, profile, groups)...")
    scope_mapping_pks, groups_present = find_oidc_scope_mappings(api, args.dry_run)
    print(
        f"     {len(scope_mapping_pks)} mappings attached "
        f"(groups claim: {'yes' if groups_present else 'MISSING — JIT will reject new users'})"
    )

    print("3/5  Resolving signing keypair...")
    signing_key_pk = find_signing_key(api)
    if signing_key_pk:
        print(f"     signing_key={signing_key_pk[:8]}...")
    else:
        print("     WARNING: no signing keypair found — tokens will be unsigned")

    if args.dry_run:
        print("\n[DRY RUN] stopping before any writes.")
        return 0

    # Provider
    print("4/5  Provider...")
    provider = find_existing_provider(api, APP_NAME)
    redirect_uris = [{"matching_mode": "strict", "url": REDIRECT_URI}]

    if provider:
        print(f"     exists (pk={provider['pk']}) — patching redirect_uris + scopes")
        api.patch(
            f"/api/v3/providers/oauth2/{provider['pk']}/",
            {
                "redirect_uris": redirect_uris,
                "property_mappings": scope_mapping_pks,
            },
        )
        client_id = provider.get("client_id", "")
        client_secret = provider.get("client_secret", "")
    else:
        client_id = generate_secret(40)
        client_secret = generate_secret(64)
        payload: dict = {
            "name": APP_NAME,
            "authorization_flow": auth_flow_pk,
            "invalidation_flow": inval_flow_pk,
            "client_type": "confidential",
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": redirect_uris,
            "property_mappings": scope_mapping_pks,
            "access_code_validity": "minutes=1",
            "access_token_validity": "minutes=10",
            "refresh_token_validity": "days=30",
            "sub_mode": "hashed_user_id",
            "include_claims_in_id_token": True,
        }
        if signing_key_pk:
            payload["signing_key"] = signing_key_pk
        provider = api.post("/api/v3/providers/oauth2/", payload)
        print(f"     created (pk={provider['pk']})")

    # Application
    print("5/5  Application...")
    app = find_existing_app(api, APP_SLUG)
    if app:
        if app.get("provider") != provider["pk"]:
            api.patch(
                f"/api/v3/core/applications/{APP_SLUG}/",
                {"provider": provider["pk"]},
            )
            print(f"     exists — relinked to provider pk={provider['pk']}")
        else:
            print(f"     exists (pk={app['pk']})")
    else:
        app = api.post(
            "/api/v3/core/applications/",
            {
                "name": APP_NAME,
                "slug": APP_SLUG,
                "provider": provider["pk"],
                "meta_launch_url": "https://parthenon.acumenus.net/",
                "policy_engine_mode": "any",
                "open_in_new_tab": False,
            },
        )
        print(f"     created (pk={app['pk']})")

    # Group binding
    group_pk = find_group_pk(api, REQUIRED_GROUP)
    if group_pk is None:
        print(
            f"     NOTE: group '{REQUIRED_GROUP}' not found in Authentik — skipping policy binding."
        )
        print(
            "     Create the group and members, then rerun to attach the access policy."
        )
    else:
        bind_group_policy(api, app["pk"], group_pk)
        print(f"     bound app to group '{REQUIRED_GROUP}' ({group_pk[:8]}...)")

    print()
    print("=" * 64)
    print("Parthenon OIDC is registered.")
    print()
    print("Copy these into /home/smudoshi/Github/Parthenon/backend/.env:")
    print()
    print(f"  OIDC_DISCOVERY_URL={args.base_url}/application/o/{APP_SLUG}/.well-known/openid-configuration")
    print(f"  OIDC_CLIENT_ID={client_id}")
    print(f"  OIDC_CLIENT_SECRET={client_secret}")
    print(f"  OIDC_REDIRECT_URI={REDIRECT_URI}")
    print("  OIDC_ENABLED=false   # flip to true only when ready for Phase 7 smoke test")
    print()
    print("Then: docker compose up -d php  (restart does NOT reload env_file)")
    print("=" * 64)
    return 0


if __name__ == "__main__":
    sys.exit(main())
