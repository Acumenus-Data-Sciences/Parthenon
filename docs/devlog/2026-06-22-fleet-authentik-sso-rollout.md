# DEVLOG — Fleet-wide "Login with Authentik" rollout

**Date:** 2026-06-22
**Author:** Sanjay Udoshi (with Claude Code)
**Status:** Complete — all 6 Acumenus apps live
**Scope:** Cross-project. Parthenon itself unchanged (reference implementation +
host of the Authentik provisioning under `acropolis/`).

---

## Summary

All six Acumenus applications now present a working **"Login with Authentik"**
button that federates to the Authentik IdP (`auth.acumenus.net`) and grants admin
access to the same 7 people who administer Parthenon (the **"Parthenon Admins"**:
`sudoshi, ebruno, kpatel, jdawe, dmuraco, gbock, admin`).

Parthenon is the **reference implementation** (Laravel, `firebase/php-jwt`,
auth-driver registry) and was the source of the pattern replicated everywhere.
Parthenon's own auth was not modified by this rollout.

## End state (per app)

| App | Stack | Authentik app slug | Admin group | Callback redirect | Action this rollout |
|-----|-------|--------------------|-------------|-------------------|---------------------|
| **Parthenon** | Laravel + React | `parthenon-oidc` | Parthenon Admins (7) | `/api/v1/auth/oidc/callback` | Reference — unchanged |
| **Medgnosis** | Fastify + React | `medgnosis-oidc` | Medgnosis Users + **Medgnosis Admins (7)** | `/api/v1/auth/oidc/callback` | Added "Medgnosis Admins" group + binding |
| **Aurora** | Laravel + React | `aurora-oidc` | Aurora Admins (7) | `/api/auth/oidc/callback` | Verified live — unchanged |
| **Zephyrus** | Laravel + Inertia | `zephyrus-oidc` | Zephyrus Admins (7) | `/auth/oidc/callback` | Verified live — unchanged |
| **COPE** | Fastify + React | `cope-oidc` | COPE Admins (7) | `/api/v1/auth/oidc/callback` | **Built + shipped** OIDC |
| **MediCosts** | Express + React | `medicosts-oidc` | MediCosts Admins (7) | `/api/auth/oidc/callback` | **Built + shipped** OIDC |

## What was actually built this rollout

Going in, Parthenon, Medgnosis, Aurora and Zephyrus already had OIDC live in
production (the repo `.env.example` defaults said "disabled", but the deployed
`.env` files enable it — verified via live `302` to Authentik). The net-new work:

1. **COPE** — full additive OIDC stack (Fastify, `jose`), migration 020, frontend
   button + callback, Authentik `cope-oidc` app + "COPE Admins" group.
2. **MediCosts** — full additive OIDC stack (Express, `jose`), `oidc-migrate.js`
   (kept out of the protected `db-migrate.js`), frontend button + callback,
   Authentik `medicosts-oidc` app + "MediCosts Admins" group.
3. **Medgnosis** — created the "Medgnosis Admins" group (its config already
   referenced it) so the 7 get admin (not analyst) and the `admin` service
   account can launch.

## Shared pattern (all apps)

Authorization Code + PKCE(S256) + nonce, hand-rolled (firebase/php-jwt on Laravel,
`jose` on Node), server-side single-use handshake store, and a one-time-code → SPA
exchange so tokens never travel in a URL. A `groups` claim mapping
("<App>: OAuth2 groups claim", returns `ak_groups` names) is required — without it
JIT provisioning denies every new user. Each repo carries an idempotent
`scripts/authentik/provision_<app>_oidc.py`. OIDC is **additive** everywhere;
local password auth is untouched and remains the break-glass path.

## Verification

All six `/oidc/redirect` endpoints return `302` to the Authentik authorize endpoint
with PKCE + the `groups` scope; all six admin groups contain the 7 admins; the
Authentik authorize endpoint accepts each client (no `invalid_client` / redirect
mismatch). See `reference_authentik_sso_fleet` in Claude memory.
