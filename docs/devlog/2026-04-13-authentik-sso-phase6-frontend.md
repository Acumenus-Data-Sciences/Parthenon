# Authentik SSO — Phase 6: Frontend Callback Page + Conditional Button

**Date:** 2026-04-13
**Branch:** feature/authentik-sso

## What

- New page: `frontend/src/features/auth/pages/OidcCallbackPage.tsx`. Reads `?code` from the URL, POSTs to `/api/v1/auth/oidc/exchange`, calls `useAuthStore.setAuth(token, user)` on success, navigates to `/`. Strict-mode guard against React 19 double-mount (the exchange code is single-use).
- New route: `/auth/callback` in `frontend/src/app/router.tsx` (public, no auth gate).
- New `frontend/src/features/auth/api.ts` with TanStack Query hooks: `useAuthProviders()` and `useExchangeOidcCode()`.
- Login page button: conditional "Sign in with Authentik" link that points to `/api/v1/auth/oidc/redirect`. Rendered only when `useAuthProviders()` reports `oidc_enabled: true`. Local email/password form is untouched.
- New backend route: `GET /api/v1/auth/providers` (public, always reachable) returning `{oidc_enabled, oidc_label, oidc_redirect_path}` — drives button visibility.

## Visibility semantics

- When `OIDC_ENABLED=false` (current default on prod), `/auth/providers` reports `oidc_enabled: false` → button never renders. Local login is unchanged.
- When `OIDC_ENABLED=true`, button renders with an "or" divider above the local form.

## Behavior change

**None with flag off.** Phase 7 flips the flag for the first live round-trip.

## Verification

- `npx tsc --noEmit`: clean
- `npx vite build`: clean (also stricter — per project convention)
- Backend: 38 tests pass across all SSO phases
