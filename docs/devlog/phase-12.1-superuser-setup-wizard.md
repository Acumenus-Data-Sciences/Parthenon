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

---

## Phase 12.1 Enhancement Pass — 2026-03-04

Complete overhaul of the Setup Wizard: all UX improvements, admin panel integration, conditional Change Password step, and font-size corrections. Deployed to `parthenon.acumenus.net`.

### Goals

1. Make the wizard persistent — accessible any time from the Admin panel, not just on first login
2. Integrate the change-password flow for fresh installs (superadmins no longer see `ChangePasswordModal`)
3. Meaningful content improvements across every step
4. Font sizes corrected (were too small throughout)
5. Step indicator spacing fixed (X button was overlapping step 6 circle)

---

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/contexts/SetupWizardContext.tsx` | React Context exposing `openSetupWizard()` — any admin page can trigger the wizard without prop-drilling |
| `frontend/src/features/auth/components/setup-steps/ChangePasswordStep.tsx` | New wizard step: password change form with 5-bar strength meter and installer credentials callout |

---

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/layout/MainLayout.tsx` | Provides `SetupWizardContext`; superadmins bypass `ChangePasswordModal` (wizard handles it); `wizardOpen` state; `onClose` is `undefined` on first launch (marks complete), provided on admin re-open (just closes) |
| `frontend/src/features/auth/components/SetupWizard.tsx` | Complete rewrite — dynamic steps, slide animation, X-button conditional hide, `onGoToStep()` back-nav for CompleteStep |
| `frontend/src/features/auth/components/setup-steps/WelcomeStep.tsx` | Removed org name input (never persisted); two-column layout — "What we'll configure" icon cards + "Before you start" checklist |
| `frontend/src/features/auth/components/setup-steps/SystemHealthStep.tsx` | Added `onGoToAiProvider?` prop; when AI service is down/degraded, shows inline callout with "Configure AI →" shortcut button |
| `frontend/src/features/auth/components/setup-steps/DataSourcesStep.tsx` | `EunomiaCallout` component — displayed when Eunomia source is detected (`source_key === 'EUNOMIA'`); Eunomia source visually separated from other sources |
| `frontend/src/features/auth/components/setup-steps/CompleteStep.tsx` | Two-column layout: setup summary with per-item "Fix →" go-back buttons + "What to do next" quick-start links; `WizardState` gains `passwordChanged`, drops `organizationName` |
| `frontend/src/features/administration/pages/AdminDashboardPage.tsx` | "Platform Setup Wizard" card (Wand2 icon, gold accent) visible to super-admins only; calls `openSetupWizard()` from context |
| `installer/bootstrap.py` | `run_create_admin()` sets `must_change_password = true` via psql UPDATE after admin creation |

---

### Wizard Architecture (After)

```
MainLayout
├─ SetupWizardContext.Provider (openSetupWizard)
├─ {must_change_password && !isSuperAdmin} → <ChangePasswordModal /> (non-superadmins only)
└─ {showWizard} → <SetupWizard mustChangePassword onClose? />
     ├─ buildSteps(mustChangePassword) → dynamic step array
     │    [welcome, ?change-password, system-health, ai-provider, authentication, data-sources, complete]
     ├─ slide animation (CSS keyframes, direction-aware)
     ├─ step indicator: pl-8 pr-14 (gives X button 56px clearance)
     └─ steps pass props down:
          SystemHealthStep → onGoToAiProvider (index computed at runtime)
          CompleteStep → steps[], onGoToStep()
```

### Key Design Details

**Dynamic steps:** `buildSteps(mustChangePassword: boolean)` produces 6 or 7 steps depending on whether the user needs to change their password. The Change Password step (`key: "change-password"`) is injected as index 1 only when the prop is true. All subsequent step indices shift accordingly — cross-links (e.g., SystemHealth → AI Provider) resolve the target index at call time, not hardcoded.

**First-launch vs admin re-open:** Distinguished by the `onClose` prop on `SetupWizard`:
- `undefined` = first launch: closing calls `markComplete()` (PUT `/user/onboarding`)
- function = admin re-open: closing just calls the function (no API call, wizard already marked complete)

**X button hide on fresh installs with `must_change_password=true`:** The X button is hidden until `wizardState.passwordChanged` is true. The Next button on the Change Password step is also disabled until the step is complete. Superadmins cannot dismiss the wizard without first setting a password.

**Eunomia detection:** `source_key?.toUpperCase() === 'EUNOMIA'` — case-insensitive match. The Eunomia source is visually separated from other sources and shown as a callout rather than a regular source row.

**CompleteStep "Fix" buttons:** Each skipped summary item (not done) shows a "↺ Fix" button that calls `onGoToStep(item.stepKey)`. Only shown when the step was part of the current wizard run (fresh installs without password step don't show a "Fix" for Change Password). The wizard tracks direction so the slide animation goes backwards when navigating to a previous step.

**SetupWizardContext:** Exported from `frontend/src/contexts/SetupWizardContext.tsx`. `MainLayout` holds the `wizardOpen` state and provides `openSetupWizard: () => setWizardOpen(true)`. The Admin Dashboard card uses `useSetupWizard().openSetupWizard()` — no router navigation needed.

### UI Corrections

| Issue | Fix |
|-------|-----|
| X close button overlapping step 6 circle | Changed `px-8` → `pl-8 pr-14` on step indicator row (56px right padding) |
| Fonts too small throughout all wizard steps | Systematic one-level bump: labels `text-[10px]`→`text-xs`, body `text-xs`→`text-sm`, content `text-sm`→`text-base`, inputs `text-sm`→`text-base` |
| Step numbers/labels too small in indicator | Bumped to `text-sm` for numbers, `text-xs` for labels |

### Gotchas

1. **`organizationName` was cosmetic-only** — it was stored in `wizardState` and shown on the Complete step but never sent to any API. Removed entirely from WelcomeStep rather than adding a dummy endpoint.

2. **Docker Desktop socket broken during deploy** — `./deploy.sh` failed with `500 Internal Server Error for API route`. Workaround: `DOCKER_HOST=unix:///var/run/docker.sock docker compose exec node sh -c "cd /app && npx vite build"` — bypasses the Desktop proxy and uses the real Docker Engine socket directly. Build succeeded in 4.38s.

3. **`dist/` owned by Docker root** — First attempted local `npx vite build` which failed with `EACCES: permission denied, unlink 'frontend/dist/assets/...'` because `dist/` was created inside the Docker node container and owned by root. Solution: build via Docker node container (above) which has the correct permissions.

4. **`must_change_password` set at installer time** — The psql UPDATE in `run_create_admin()` runs against Docker postgres with `docker compose exec -T postgres psql ...`. The SQL is parameterized by the email string collected during the admin creation flow, so it targets the correct user row even if the admin email was customized.
