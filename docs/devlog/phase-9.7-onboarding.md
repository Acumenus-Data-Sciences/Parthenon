# Phase 9.7 — In-App Onboarding Overlay + Guided Tour

**Date:** 2026-03-03
**Branch:** master

---

## What Was Built

First-login onboarding experience for new Parthenon users. Shown once after account creation (when `onboarding_completed = false`), dismissed by completing or skipping.

---

## Files Changed

### New
| File | Description |
|------|-------------|
| `backend/database/migrations/2026_03_03_000000_add_onboarding_completed_to_users_table.php` | Adds `onboarding_completed BOOL DEFAULT false` to users |
| `backend/app/Http/Controllers/Api/V1/OnboardingController.php` | `PUT /api/v1/user/onboarding` → marks completed |
| `frontend/src/features/auth/components/OnboardingModal.tsx` | Full-screen overlay + joyride tour |

### Modified
| File | Change |
|------|--------|
| `backend/app/Models/User.php` | Add `onboarding_completed` to `$fillable` + casts |
| `backend/app/Http/Controllers/Api/V1/AuthController.php` | Include `onboarding_completed` in `formatUser()` |
| `backend/routes/api.php` | Add `PUT /v1/user/onboarding` route |
| `frontend/src/types/models.ts` | Add `onboarding_completed: boolean` to User interface |
| `frontend/src/components/layout/MainLayout.tsx` | Mount `<OnboardingModal />` when not completed |
| `frontend/src/components/layout/Sidebar.tsx` | Add `data-tour` attrs to sidebar + nav links |
| `frontend/src/components/layout/Header.tsx` | Add `data-tour="cmd-palette"` to search button |

---

## UI Design

### Welcome Overlay
- Full-screen backdrop with centered 2xl card
- "X" dismiss button (top right) to skip
- Header: "Welcome to Parthenon"
- 3 action cards:
  - **Explore Vocabulary** → `/vocabulary` (blue)
  - **Build a Cohort** → `/cohort-definitions` (purple)
  - **Read the Quick Start** → `/data-explorer` (amber)
- **"Start Quick Tour"** CTA — gold button, dismisses overlay + starts joyride
- "I'm already familiar — skip" small link

### Joyride Tour (5 steps)
1. Sidebar — overview of navigation
2. Command Palette (⌘K) — keyboard shortcut intro
3. Data Sources — connect CDM sources
4. Cohort Definitions — core research tool
5. Vocabulary — OMOP concept search

Tour styled to match dark theme: gold primary, dark backgrounds, 65% overlay.

### Dismissal logic
- Clicking any action card → marks complete + navigates
- "Start Quick Tour" → marks complete + runs joyride
- "X" or "skip" → marks complete, stays on current page
- `PUT /api/v1/user/onboarding` called on any dismiss path

### Condition in MainLayout
```tsx
{user && !user.must_change_password && !user.onboarding_completed && (
  <OnboardingModal />
)}
```
Change-password modal takes precedence (order: must_change_password first, then onboarding).

---

## Verification

```
Migration: 2026_03_03_000000 runs clean
PUT /api/v1/user/onboarding → 200, {onboarding_completed: true}
GET /api/v1/auth/user → includes onboarding_completed field
npx tsc --noEmit → 0 errors
```

---

## Gotchas

- **react-joyride** requires `--legacy-peer-deps` to install with React 19 (peer dep expects React 16-18). Works fine at runtime.
- The joyride tour runs **on top of** the rest of the app (z-index 10000), not inside the modal. When "Start Quick Tour" is clicked, the overlay hides first, then joyride spotlights sidebar elements.
- `onboarding_completed` defaults to `false` for all existing users — they will see the overlay once. To skip for existing super-admin: `UPDATE users SET onboarding_completed = true WHERE email = 'admin@parthenon.local'`, or just dismiss it in the UI.
