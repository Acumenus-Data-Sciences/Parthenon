---
doc_type: lineage
status: historical
date: 2026-05-22
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_22_120000_add_seen_library_lifecycle_notice_to_users_table.php
  - backend/app/Http/Controllers/Api/V1/UserNoticeController.php
  - frontend/src/hooks/useLibraryLifecycleNotice.ts
  - frontend/src/components/layout/MainLayout.tsx
related_prs: []
---
# 2026-05-22 — One-time library-lifecycle notice (Phase D, Task D9)

Closes the optional D9 item: a one-time, non-blocking toast informing existing
users that library items (concept sets, cohort definitions, analyses) now carry
a Draft / Active / Archived lifecycle and can be managed from each library page.

## Persistence

`app.users.seen_library_lifecycle_notice` (boolean, default false) records the
acknowledgement, mirroring the existing `onboarding_completed` flag. The column
is additive on a parthenon_owner-owned table; parthenon_migrator is a member of
that role, so the ALTER needs no ownership/grant fix (unlike newly-created
tables — see 2026-05-17-library-audit-log-table.md).

`PUT /api/v1/user/library-notice` (`UserNoticeController::acknowledgeLibrary`,
inside the `auth:sanctum` group) sets the flag and returns it. The field flows
to the SPA automatically via the existing `AuthController::user()` / login
payloads — no change to the protected auth controller.

## Trigger logic

`useLibraryLifecycleNotice` (called from `MainLayout`) fires the toast once when
the authenticated user is past the blocking flows — `!must_change_password`,
`onboarding_completed`, and `!seen_library_lifecycle_notice` — then immediately
persists the flag and updates the auth store. A ref guard prevents a double
fire; a failed PUT clears the guard so it can retry on the next mount. The toast
copy lives at `common.libraryLifecycleNotice` across all 11 locales.

## Tests

- `backend/tests/Feature/Api/V1/UserNoticeControllerTest.php` — auth required,
  marks the flag, idempotent.
- `frontend/src/hooks/__tests__/useLibraryLifecycleNotice.test.tsx` — fires +
  persists once when eligible; silent when already seen / mid password-change.
