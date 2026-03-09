# Authentication System — DO NOT MODIFY

## CRITICAL: Protected Auth Components

The following authentication system is production-deployed and MUST NOT be overwritten, removed, or architecturally changed without explicit user authorization:

### Backend (Laravel)
- `backend/app/Http/Controllers/Api/V1/AuthController.php` — Auth endpoints:
  - `register()` — Generates temp password, sends via TempPasswordMail, no auto-login
  - `login()` — Returns must_change_password flag, updates last_login_at
  - `changePassword()` — Forced password change, sets must_change_password=false
  - `user()` — Returns current user with roles/permissions
  - `logout()` — Deletes current access token
- `backend/app/Mail/TempPasswordMail.php` — Mailable class for temp password delivery
- `backend/resources/views/emails/temp-password.blade.php` — Branded HTML email template
- `backend/app/Models/User.php` — HasRoles (Spatie), HasApiTokens (Sanctum), must_change_password cast
- `backend/routes/api.php` — Auth routes under /api/v1/auth with rate limiting

### Frontend (React SPA)
- `frontend/src/features/auth/pages/LoginPage.tsx` — Login form with "Request access" link to /register
- `frontend/src/features/auth/pages/RegisterPage.tsx` — Registration form (name, email, phone)
- `frontend/src/features/auth/components/ChangePasswordModal.tsx` — Non-dismissable forced password change modal
- `frontend/src/features/auth/components/SetupWizard.tsx` — Superadmin onboarding wizard (includes password change step)
- `frontend/src/components/layout/MainLayout.tsx` — Renders ChangePasswordModal or SetupWizard based on user state
- `frontend/src/stores/authStore.ts` — Zustand store with role/permission helpers

### Database Schema
- `app.users` table includes: must_change_password (boolean, default true), onboarding_completed (boolean)
- Spatie RBAC: app.roles, app.permissions, app.model_has_roles, app.model_has_permissions
- super-admin role assigned to admin@acumenus.net

## Enforced Auth Flow (MediCosts Paradigm)

1. Visitor clicks "Request access" on login page
2. Enters: name, email, phone (optional) — NO password field
3. Backend generates 12-char temp password (excludes I, l, O, 0)
4. Temp password emailed via Resend (MAIL_MAILER=resend in .env)
5. Visitor logs in with email + temp password → receives Sanctum token
6. Regular users: Non-dismissable ChangePasswordModal blocks access
7. Super-admins: SetupWizard with password change step + system configuration
8. After password change: must_change_password = false, full app access

## Rules

1. **NEVER remove the "Request access" link from LoginPage.tsx**
2. **NEVER remove or make the ChangePasswordModal dismissable**
3. **NEVER bypass the must_change_password check in MainLayout**
4. **NEVER remove the SetupWizard for super-admin users**
5. **NEVER change MAIL_MAILER back to 'log' in production** — must be 'resend'
6. **NEVER change the email sender from noreply@acumenus.net**
7. **NEVER hardcode the Resend API key in source code** (use RESEND_API_KEY env var)
8. **NEVER remove email enumeration prevention** on registration
9. **NEVER weaken password requirements** (min 8 chars, bcrypt 12 rounds)
10. **NEVER remove Spatie RBAC** — role/permission system is critical
11. **Superuser account** `admin@acumenus.net` with super-admin role must always exist
12. **If modifying auth**, preserve ALL existing endpoints and their behavior — additions only
13. **NEVER remove the TempPasswordMail class or email template**
14. **NEVER remove the onboarding_completed flow** — it triggers after password change

## Resend Configuration
- MAIL_MAILER=resend in backend/.env
- RESEND_API_KEY in backend/.env
- From: noreply@acumenus.net (MAIL_FROM_ADDRESS)
- Template: backend/resources/views/emails/temp-password.blade.php
