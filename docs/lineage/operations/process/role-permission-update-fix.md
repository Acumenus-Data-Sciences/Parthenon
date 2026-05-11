# Role Permission Update 422 Fix

**Date:** 2026-03-12
**Scope:** Backend RoleController bug fix

## Problem

Updating permissions for any protected role (admin, researcher, data-steward, mapping-reviewer, viewer) via the Roles & Permissions page returned HTTP 422 "The 'admin' role name cannot be changed."

## Root Cause

The `RoleEditor` frontend component always sends `{ name, permissions }` in the PUT payload — even when only permissions are being changed. The backend `RoleController::update()` checked:

```php
if (isset($validated['name']) && in_array($role->name, self::PROTECTED))
```

This rejected the request whenever `name` was present in the payload for a protected role, regardless of whether the name was actually being changed.

## Fix

**File:** `backend/app/Http/Controllers/Api/V1/Admin/RoleController.php` (line 64)

Changed the condition to only reject when the name is actually different:

```php
if (isset($validated['name']) && $validated['name'] !== $role->name && in_array($role->name, self::PROTECTED))
```

This allows sending the same name back (normal behavior during permission-only edits) while still blocking actual renames of protected roles.

## Verification

- PUT `/api/v1/admin/roles/2` with `{"name":"admin","permissions":[...]}` → 200 OK
- PUT `/api/v1/admin/roles/2` with `{"name":"renamed-admin"}` → 422 (still blocked)
- Admin role restored to all 56 permissions after testing

## Notes

- super-admin and admin both have all 56 permissions currently
- The difference is behavioral: super-admin bypasses all gates via Spatie's `Gate::before()` and can't have permissions modified via API
- admin permissions can be scoped down via the Permission Matrix
