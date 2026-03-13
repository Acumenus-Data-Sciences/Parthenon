# User Profile & Settings Page — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add a `/settings` page where users can manage their profile, avatar, password, and notification preferences. Add a user dropdown menu in the header for navigation to settings.

## Database Changes

New migration adds 4 columns to `users` table:

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `job_title` | `string(100)` | yes | New |
| `department` | `string(100)` | yes | New |
| `organization` | `string(150)` | yes | New |
| `bio` | `text` | yes | New |

Existing fields reused: `avatar`, `phone_number`, `name`.

### Avatar Storage

- Disk: `public` (Laravel `storage/app/public/avatars/`)
- Filename: `{user_id}.{ext}`
- Served at: `/storage/avatars/{user_id}.{ext}`
- Max size: 5MB
- Accepted formats: JPEG, PNG, WebP
- Old avatar deleted on re-upload
- Avatar column stores relative path: `avatars/{user_id}.{ext}` — frontend prepends `/storage/` for display URL
- Image reprocessed via GD/Imagick on upload to strip EXIF data, embedded scripts, and polyglot payloads
- Requires `php artisan storage:link` — add to `deploy.sh` and Docker entrypoint
- Nginx needs `location /storage/` block to serve static files directly

## Backend API

New `UserProfileController` (does NOT modify `AuthController`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `PUT` | `/api/v1/user/profile` | Update name, phone, job_title, department, organization, bio |
| `POST` | `/api/v1/user/avatar` | Upload avatar (5MB max, jpeg/png/webp) |
| `DELETE` | `/api/v1/user/avatar` | Remove avatar |

All profile/avatar routes use `throttle:10,1` (10 requests/minute) rate limiting.

Existing endpoints reused:
- `POST /api/v1/auth/change-password` — password changes (add `new_password_confirmation` with `confirmed` rule)
- `GET/PUT /api/v1/user/notification-preferences` — per-user notification preferences (distinct from `/admin/notifications` which is system-wide config)

### AuthController `formatUser()` Update

The `formatUser()` method in `AuthController` must add `job_title`, `department`, `organization`, `bio` to its `$user->only([...])` allowlist. This is an addition-only change, preserving all existing fields. This ensures the frontend receives profile data on login and page refresh via `GET /api/v1/auth/user`.

### Form Requests

- `UpdateProfileRequest` — validates name (required, max 255), phone (nullable, max 20), job_title (nullable, max 100), department (nullable, max 100), organization (nullable, max 150), bio (nullable, max 2000)
- `UploadAvatarRequest` — validates avatar file (required, image, mimes: jpeg/png/webp, max: 5120kb) — `image` rule validates actual content, not just extension

## Frontend

### Header User Dropdown

Replace the current inline user name + logout button with a dropdown menu:
- Trigger: click on user avatar/name area
- Items: "Settings" (navigates to `/settings`), "Logout"

### Settings Page (`/settings`)

Single route inside protected layout. Tab bar with 3 tabs:

1. **Profile** (default, `?tab=profile`)
2. **Account & Security** (`?tab=account`)
3. **Notifications** (`?tab=notifications`)

Active tab stored in URL query param, defaults to `profile`.

### Profile Tab

- Avatar section: circular preview (120px), Upload and Remove buttons
- Form fields: Name, Phone, Job Title, Department, Organization, Bio (textarea)
- Save button with loading state
- Success/error toast notifications
- TanStack Query mutation, updates Zustand auth store on success

### Account & Security Tab

- Email displayed read-only (with note: "Contact admin to change")
- Change password form: Current Password, New Password, Confirm New Password
- Frontend validates password confirmation match before submitting
- Reuses `POST /api/v1/auth/change-password` (updated to accept `new_password_confirmation`)

### Notifications Tab

- Reuses existing notification preferences backend (`GET/PUT /api/v1/user/notification-preferences`)
- Email and SMS notification toggles
- Category preferences from `notification_preferences` JSON

### Styling

- Dark clinical theme (#0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal)
- Card-based sections, consistent with existing page layouts

## Files to Create/Modify

### New Files
- `backend/database/migrations/2026_03_13_000000_add_profile_fields_to_users_table.php`
- `backend/app/Http/Controllers/Api/V1/UserProfileController.php`
- `backend/app/Http/Requests/UpdateProfileRequest.php`
- `backend/app/Http/Requests/UploadAvatarRequest.php`
- `frontend/src/features/settings/pages/SettingsPage.tsx`
- `frontend/src/features/settings/components/ProfileTab.tsx`
- `frontend/src/features/settings/components/AccountSecurityTab.tsx`
- `frontend/src/features/settings/components/AvatarUpload.tsx`
- `frontend/src/features/settings/api.ts` (profile API hooks)

### Modified Files
- `backend/app/Models/User.php` — add `job_title`, `department`, `organization`, `bio` to `$fillable`
- `backend/app/Http/Controllers/Api/V1/AuthController.php` — add new fields to `formatUser()` allowlist (addition only)
- `backend/routes/api.php` — add profile/avatar routes
- `frontend/src/app/router.tsx` — add `/settings` route (lazy loaded)
- `frontend/src/components/layout/Header.tsx` — user dropdown menu
- `frontend/src/types/models.ts` — extend User interface
- `frontend/src/features/settings/notificationApi.ts` — reuse existing
