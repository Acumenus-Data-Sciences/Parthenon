# Authentik SSO — Phase 3: OIDC Service Layer

**Date:** 2026-04-13
**Branch:** feature/authentik-sso

## What

Four service classes under `App\Services\Auth\Oidc`, no HTTP routes yet:

- `OidcHandshakeStore` — Redis-backed state (5 min TTL) and one-time code (60 s TTL) with single-use semantics. PKCE-ready: `putState` takes `{nonce, code_verifier}` array.
- `OidcDiscoveryService` — fetches and caches (1 h) the Authentik OpenID config + JWKS.
- `OidcTokenValidator` — validates an ID token: JWKS signature, issuer, audience, expiry, nonce, and required claims. Returns a `ValidatedClaims` DTO.
- `OidcReconciliationService` — the 4-step reconciliation algorithm (sub → email → alias → JIT-create). Wrapped in a DB transaction.

Supporting pieces: `ValidatedClaims` readonly DTO, three exception classes (`OidcException`, `OidcTokenInvalidException`, `OidcAccessDeniedException`).

## Reconciliation guarantees (tested)

- **Additive-only roles on existing users.** Linking by sub, email, or alias never calls `assignRole` / `syncRoles` / `removeRole`. Existing users keep their role set byte-for-byte. Regression-tested for `super-admin` survival (5 of 7 C-suite currently hold it in prod).
- **JIT creation requires `Parthenon Admins`.** `authentik Admins` alone does not qualify. Rejected logins produce zero DB mutations.
- **JIT users get exactly `admin`.** Never `super-admin`, never any other role.
- **Idempotent.** Second call with same `sub` hits the `linked_by_sub` path — no duplicate identity rows.
- **Case-insensitive email match** for both direct and alias paths.

## Tests

20 passing: 6 for handshake store, 6 for token validator (signature/iss/aud/exp/nonce/missing-claim), 8 for reconciliation (all four paths + rejection + preservation + idempotency + case-insensitivity + the authentik-Admins-alone rejection).

## Behavior change

**None.** No route wires into these services yet. Phase 4 adds the HTTP surface (still flag-off).
