# Phase 12.1 — Superuser First-Login Configuration Wizard

**Date:** 2026-03-03
**Branch:** main

---

## Summary

Replaces the generic `OnboardingModal` with a 6-step **Setup Wizard** exclusively for super-admin users on first login. The wizard walks the superuser through verifying system health, configuring the AI provider, setting up SSO authentication, and connecting data sources — all prepopulated with existing seeded values from the database.

Non-superadmin users continue seeing the regular `OnboardingModal` with the guided Joyride tour.

**No backend changes required** — all configuration is performed through existing admin API endpoints.

---

## Architecture

### Flow

```
Login (admin@parthenon.local / superuser)
  ↓
ChangePasswordModal (blocking, non-dismissable)
  ↓ (password changed → must_change_password = false)
MainLayout checks:
  ├─ isSuperAdmin? → SetupWizard (6 steps)
  └─ otherwise     → OnboardingModal (quick tour)
  ↓ (wizard finished → onboarding_completed = true)
Dashboard
```

### Conditional in MainLayout

```tsx
const isSuperAdmin = useAuthStore((s) => (s.user?.roles ?? []).includes("super-admin"));

{user && !user.must_change_password && !user.onboarding_completed && (
  isSuperAdmin ? <SetupWizard /> : <OnboardingModal />
)}
```

Uses an inline role check (not `s.isSuperAdmin()`) to ensure Zustand re-renders on role changes.

---

## Wizard Steps

| # | Step | What It Does | Prepopulated Values |
|---|------|-------------|---------------------|
| 1 | **Welcome** | Organization name input, overview of setup ahead | "Parthenon" |
| 2 | **System Health** | Auto-checks backend, Redis, AI, R, queues | Live service status |
| 3 | **AI Provider** | Active provider config, model select, test connection | Ollama / MedGemma1.5:4b / http://host.docker.internal:11434 |
| 4 | **Authentication** | 4 SSO providers (LDAP, OAuth2, SAML2, OIDC) — toggle, configure, test | Seeded defaults (all disabled, with template settings) |
| 5 | **Data Sources** | Existing sources list + WebAPI import | Any existing sources |
| 6 | **Complete** | Summary checklist + "Launch Parthenon" button | Configured/skipped status per step |

### Navigation

- **Previous / Next** buttons in footer
- **Skip** button per step (except Welcome)
- **X** button to skip entire wizard (marks onboarding complete)
- Final step has no footer — uses its own "Launch Parthenon" CTA

---

## Files Changed

### New (8)

| File | Purpose |
|------|---------|
| `frontend/src/features/auth/components/SetupWizard.tsx` | Main wizard shell: step state, step indicator, navigation, markComplete() |
| `frontend/src/features/auth/components/setup-steps/WelcomeStep.tsx` | Organization name + overview cards |
| `frontend/src/features/auth/components/setup-steps/SystemHealthStep.tsx` | Service health check via `useSystemHealth()` |
| `frontend/src/features/auth/components/setup-steps/AiProviderStep.tsx` | Active provider config, model select, test, switch provider |
| `frontend/src/features/auth/components/setup-steps/AuthenticationStep.tsx` | SSO provider cards with toggle/configure/test |
| `frontend/src/features/auth/components/setup-steps/DataSourcesStep.tsx` | Source list + WebAPI import form |
| `frontend/src/features/auth/components/setup-steps/CompleteStep.tsx` | Summary checklist + launch button |
| `docs/devlog/phase-9.8-superuser-setup-wizard.md` | This devlog |

### Modified (1)

| File | Change |
|------|--------|
| `frontend/src/components/layout/MainLayout.tsx` | Import SetupWizard, add `isSuperAdmin` selector, conditional render |

---

## Existing Hooks Reused (zero new backend)

| Hook | From | Endpoint |
|------|------|----------|
| `useSystemHealth()` | `administration/hooks/useAiProviders.ts` | `GET /v1/admin/system-health` |
| `useAiProviders()` | same | `GET /v1/admin/ai-providers` |
| `useUpdateAiProvider()` | same | `PUT /v1/admin/ai-providers/{type}` |
| `useTestAiProvider()` | same | `POST /v1/admin/ai-providers/{type}/test` |
| `useActivateAiProvider()` | same | `POST /v1/admin/ai-providers/{type}/activate` |
| `useToggleAiProvider()` | same | `POST /v1/admin/ai-providers/{type}/enable|disable` |
| `useAuthProviders()` | `administration/hooks/useAuthProviders.ts` | `GET /v1/admin/auth-providers` |
| `useToggleAuthProvider()` | same | `POST /v1/admin/auth-providers/{type}/enable|disable` |
| `useUpdateAuthProvider()` | same | `PUT /v1/admin/auth-providers/{type}` |
| `useTestAuthProvider()` | same | `POST /v1/admin/auth-providers/{type}/test` |
| `useSources()` | `data-sources/hooks/useSources.ts` | `GET /v1/sources` |
| `useImportFromWebApi()` | same | `POST /v1/sources/import-webapi` |

---

## UI Design

- **Overlay**: `fixed inset-0 z-50`, dark backdrop with blur, centered `max-w-4xl max-h-[90vh]` card
- **Step indicator**: Numbered circles (gold `#C9A227` when completed/active, grey `#323238` when pending) with connecting lines
- **Theme**: Matches existing dark theme — `#151518` card bg, `#1A1A1E` inner cards, `#F0EDE8` text, `#8A857D` muted
- **Buttons**: Gold primary (`#C9A227` bg, `#0E0E11` text), ghost secondary
- **Status badges**: Emerald (healthy), yellow (degraded), red (down) — matches SystemHealthPage pattern
- **Auth provider forms**: Reuses `LdapConfigForm`, `OAuth2ConfigForm`, `Saml2ConfigForm`, `OidcConfigForm` from administration components

---

## Gotchas & Decisions

1. **Organization name is client-side only** — No backend endpoint for persisting it. It's stored in `wizardState` and displayed on the Complete step. If persistence is needed later, a new `PUT /v1/admin/settings` endpoint would be required.

2. **PROVIDER_META duplication** — Both `AiProvidersPage.tsx` and `AiProviderStep.tsx` define model lists per provider. Could be extracted to a shared constant in a follow-up refactor.

3. **Auth provider forms imported cross-feature** — `AuthenticationStep` imports config forms from `features/administration/components/`. Acceptable since the wizard is admin-only and inherently spans all admin concerns.

4. **`@testing-library/dom` was missing** — Pre-existing issue causing all 11 test suites to fail. Installed with `--legacy-peer-deps`. Not related to this feature.

---

## Verification

```
TypeScript:      npx tsc --noEmit → 0 errors
Frontend tests:  npx vitest run → 64/64 pass (11 suites)
```
