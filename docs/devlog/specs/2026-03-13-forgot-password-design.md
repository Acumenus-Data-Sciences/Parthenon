# Forgot Password — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add a "Forgot password?" link to the login page that opens a modal where users can request a new temporary password. Reuses the existing temp-password-via-email pattern from registration — no new token tables or email templates needed.

## Flow

1. User clicks "Forgot password?" link below the password field on LoginPage
2. Modal opens with email input (pre-filled from login form if already typed)
3. User submits → backend generates new temp password, emails via `TempPasswordMail`, sets `must_change_password = true`
4. Modal shows success message: "If an account exists with that email, a new temporary password has been sent."
5. Button disabled after success, modal auto-closes after 5 seconds
6. User logs in with new temp password → forced password change via existing `ChangePasswordModal`

## Backend

### New Endpoint

| Method | Endpoint | Auth | Throttle | Purpose |
|--------|----------|------|----------|---------|
| `POST` | `/api/v1/auth/forgot-password` | Public | `throttle:3,15` | Request temp password reset |

### `AuthController::forgotPassword()`

- Validates `{ email: required|string|email }`
- Looks up user by normalized email (`strtolower(trim(...))`)
- If user found: generates temp password via existing `generateTempPassword()`, updates password hash, sets `must_change_password = true`, revokes all existing Sanctum tokens (`$user->tokens()->delete()`), sends `TempPasswordMail`
- Always returns `{ message: "If an account exists with that email, a new temporary password has been sent." }` with 200 status (prevents email enumeration)
- Mail send wrapped in try/catch with logger fallback (same pattern as `register()`)
- Logs password reset request for audit trail (without logging the temp password on success)

### Route Registration

Added to the public auth group in `routes/api.php` alongside login and register, with its own `throttle:3,15` middleware (stricter than login's `throttle:5,15`).

## Frontend

### ForgotPasswordModal (`features/auth/components/ForgotPasswordModal.tsx`)

- Props: `isOpen: boolean`, `onClose: () => void`, `defaultEmail?: string`
- Glassmorphic modal matching login page dark clinical aesthetic
- Email input pre-filled from `defaultEmail` prop
- Submit button with `Loader2` spinner during request
- On success: shows green checkmark icon + success message, disables form, auto-closes after 5 seconds via `setTimeout` (cleanup in `useEffect` return to prevent state updates on unmount — React 19 strict mode)
- Close via backdrop click or X button (not during loading)
- Calls `POST /api/v1/auth/forgot-password` via `apiClient`
- Error handling: 429 → "Too many requests. Please wait and try again." Other errors → "Something went wrong. Please try again."

### LoginPage Changes

- Add "Forgot password?" link right-aligned below the password field, above the Sign In button
- Styled as subtle text link: `var(--text-muted)` color, `var(--accent)` on hover
- `useState<boolean>` for modal visibility
- Pass current `email` state as `defaultEmail` to modal

## Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `backend/app/Http/Controllers/Api/V1/AuthController.php` — add `forgotPassword()` method |
| Modify | `backend/routes/api.php` — add `POST /auth/forgot-password` route |
| Create | `frontend/src/features/auth/components/ForgotPasswordModal.tsx` |
| Modify | `frontend/src/features/auth/pages/LoginPage.tsx` — add link + modal state |
| Modify | `.claude/rules/auth-system.md` — document new `forgotPassword()` endpoint (addition only) |

## What This Does NOT Change

- No new database migrations
- No new email templates (reuses `TempPasswordMail`)
- No new token/reset tables
- No modifications to existing auth endpoints or `ChangePasswordModal`
- `auth-system.md` updated with new endpoint documentation (addition only, per rule 12)
