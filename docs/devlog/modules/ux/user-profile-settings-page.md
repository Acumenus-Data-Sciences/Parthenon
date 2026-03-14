# User Profile & Settings Page

**Date:** 2026-03-13
**Phase:** Post-Phase 14

## What Was Built

Added a `/settings` page with three tabs and a header user dropdown menu.

### Backend
- **Migration:** Added `job_title`, `department`, `organization`, `bio` columns to `users` table
- **UserProfileController:** Three endpoints — `PUT /user/profile`, `POST /user/avatar`, `DELETE /user/avatar`
- **Avatar upload:** 5MB max, JPEG/PNG/WebP, image reprocessed via Intervention Image (GD) to strip EXIF/embedded scripts, stored at `storage/app/public/avatars/{user_id}.{ext}`
- **Form Requests:** `UpdateProfileRequest` and `UploadAvatarRequest` with full validation
- **Rate limiting:** `throttle:10,1` on all profile/avatar routes
- **AuthController updates:** `formatUser()` extended with new profile fields; `changePassword()` now uses `confirmed` validation rule
- **Storage/Nginx:** `php artisan storage:link` added to `deploy.sh`; nginx `/storage/` location block serves avatars with 30-day cache

### Frontend
- **SettingsPage** at `/settings` with URL-driven tab state (`?tab=profile|account|notifications`)
- **Profile tab:** Avatar upload/preview/delete, name, phone, job title, department, organization, bio (2000 char)
- **Account & Security tab:** Read-only email display, password change form with client+server confirmation validation
- **Notifications tab:** Reuses existing `NotificationSettings` component
- **Header dropdown:** Replaced inline user name + logout with clickable dropdown (Settings, Logout)

### Files Created
- `backend/database/migrations/2026_03_13_000000_add_profile_fields_to_users_table.php`
- `backend/app/Http/Controllers/Api/V1/UserProfileController.php`
- `backend/app/Http/Requests/UpdateProfileRequest.php`
- `backend/app/Http/Requests/UploadAvatarRequest.php`
- `frontend/src/features/settings/pages/SettingsPage.tsx`
- `frontend/src/features/settings/components/ProfileTab.tsx`
- `frontend/src/features/settings/components/AccountSecurityTab.tsx`
- `frontend/src/features/settings/components/AvatarUpload.tsx`
- `frontend/src/features/settings/api/profileApi.ts`
- `frontend/src/features/settings/hooks/useProfile.ts`

### Files Modified
- `backend/app/Models/User.php` — added 4 fields to `$fillable`
- `backend/app/Http/Controllers/Api/V1/AuthController.php` — `formatUser()` + `changePassword()`
- `backend/routes/api.php` — 3 new routes
- `frontend/src/types/models.ts` — extended `User` interface
- `frontend/src/app/router.tsx` — added `/settings` route
- `frontend/src/components/layout/Header.tsx` — user dropdown
- `deploy.sh` — added `storage:link`
- `docker/nginx/default.conf` — added `/storage/` location

## Key Decisions
- Avatar images reprocessed via GD to prevent polyglot/EXIF attacks
- Separate `UserProfileController` to avoid touching protected `AuthController`
- Notification preferences reused from existing admin component (per-user vs system-wide distinction)
- Tab state via URL query param for direct linking without nested routes

## Test Results
- TypeScript: clean (0 errors)
- ESLint: 1 pre-existing warning (setState-in-effect pattern, same as NotificationSettings)
- Backend: 287 tests passing
- Frontend build: success
