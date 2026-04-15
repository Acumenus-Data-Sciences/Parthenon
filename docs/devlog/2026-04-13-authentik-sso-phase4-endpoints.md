# Authentik SSO — Phase 4: OIDC HTTP Endpoints (Flag-Off)

**Date:** 2026-04-13
**Branch:** feature/authentik-sso

## What

Three public API routes wired to `OidcController`:

- `GET /api/v1/auth/oidc/redirect` — builds the Authentik authorize URL (PKCE S256, nonce, state) and 302-redirects.
- `GET /api/v1/auth/oidc/callback` — validates state, exchanges auth code for tokens, validates ID token, reconciles user, issues a fresh Sanctum token, stores it under a one-time code, and 302-redirects the SPA to `/auth/callback?code=<opaque>`.
- `POST /api/v1/auth/oidc/exchange` — consumes the one-time code, returns `{token, user}`.

All three return HTTP 404 when `config('services.oidc.enabled')` is false. Default: disabled. Rate-limited at 20/min per IP.

## Feature flag

- `OIDC_ENABLED` env var (default `false`)
- `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
- `config/services.php` exposes these under `services.oidc.*`

## Service bindings

Registered in `AppServiceProvider::register()`:
- `OidcDiscoveryService` (1-hour cached config + JWKS)
- `OidcTokenValidator`
- `OidcReconciliationService`
- `OidcHandshakeStore`

## Security guarantees

- Sanctum token never appears in a URL — one-time code (60 s TTL) exchange pattern.
- State and nonce single-use via `OidcHandshakeStore::consumeState`.
- PKCE S256 code verifier stored alongside state.
- ID token validated by JWKS signature, issuer, audience, expiry, nonce before reconciliation runs.
- Structured error responses (`{error: 'oidc_failed', reason: <machine-readable>}`) — no stack traces leak.
- Existing `auth-token` replaced on login to match local login behavior.

## Tests

10 feature tests passing:
- 3× 404 when disabled (redirect, callback, exchange)
- redirect issues 302 with PKCE params
- callback rejects missing/unknown state
- exchange rejects missing/unknown code
- exchange happy-path returns `{token, user}` with correct roles
- exchange code is single-use

Full callback happy-path (code → ID-token → reconciliation → redirect) requires a live Authentik or a more elaborate HTTP fake with a signed ID token; deferred to Phase 7 live smoke test rather than duplicating Phase 3 unit coverage.

## Behavior change

**None when deployed with `OIDC_ENABLED=false` (the default).** Phase 5 registers the Authentik app; Phase 7 flips the flag for the first live round-trip.
