# User Profile & Settings Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page with Profile, Account & Security, and Notifications tabs — plus a header user dropdown for navigation.

**Architecture:** New `UserProfileController` handles profile CRUD and avatar upload. Frontend adds a tabbed `SettingsPage` at `/settings` with lazy loading. Header gains a dropdown menu replacing the inline logout button. Existing `NotificationSettings` component is reused in the Notifications tab.

**Tech Stack:** Laravel 11, PHP 8.4, React 19, TypeScript, TanStack Query, Zustand, Tailwind, GD/Imagick

---

## Chunk 1: Backend (Migration, Model, Controller, Routes)

### Task 1: Database Migration

**Files:**
- Create: `backend/database/migrations/2026_03_13_000000_add_profile_fields_to_users_table.php`

- [ ] **Step 1: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('job_title', 100)->nullable()->after('phone_number');
            $table->string('department', 100)->nullable()->after('job_title');
            $table->string('organization', 150)->nullable()->after('department');
            $table->text('bio')->nullable()->after('organization');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['job_title', 'department', 'organization', 'bio']);
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating ... add_profile_fields_to_users_table ... DONE"

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_13_000000_add_profile_fields_to_users_table.php
git commit -m "feat: add profile fields migration (job_title, department, organization, bio)"
```

---

### Task 2: Update User Model

**Files:**
- Modify: `backend/app/Models/User.php:25-38` (add to `$fillable`)

- [ ] **Step 1: Add new fields to `$fillable`**

Add `'job_title'`, `'department'`, `'organization'`, `'bio'` to the `$fillable` array in `backend/app/Models/User.php`.

Updated `$fillable`:
```php
protected $fillable = [
    'name',
    'email',
    'password',
    'avatar',
    'provider',
    'provider_id',
    'last_login_at',
    'must_change_password',
    'onboarding_completed',
    'notification_email',
    'notification_sms',
    'phone_number',
    'notification_preferences',
    'job_title',
    'department',
    'organization',
    'bio',
];
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Models/User.php
git commit -m "feat: add profile fields to User model fillable"
```

---

### Task 3: Update AuthController `formatUser()`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AuthController.php:136-137` (add fields to `only()`)

- [ ] **Step 1: Extend `formatUser()` allowlist**

In `AuthController.php`, update the `formatUser()` method to include the new profile fields. Change line 136-137 from:

```php
...$user->only(['id', 'name', 'email', 'avatar', 'phone_number', 'last_login_at',
    'must_change_password', 'onboarding_completed', 'created_at', 'updated_at']),
```

To:
```php
...$user->only(['id', 'name', 'email', 'avatar', 'phone_number', 'job_title',
    'department', 'organization', 'bio', 'last_login_at',
    'must_change_password', 'onboarding_completed', 'created_at', 'updated_at']),
```

- [ ] **Step 2: Add `confirmed` rule to `changePassword()` validation**

In the same file, update `changePassword()` validation (line 97) from:

```php
'new_password' => 'required|string|min:8',
```

To:
```php
'new_password' => 'required|string|min:8|confirmed',
```

This enables server-side password confirmation validation. The frontend must send `new_password_confirmation` in the request body.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AuthController.php
git commit -m "feat: include profile fields in formatUser() and add password confirmation rule"
```

---

### Task 4: Form Requests

**Files:**
- Create: `backend/app/Http/Requests/UpdateProfileRequest.php`
- Create: `backend/app/Http/Requests/UploadAvatarRequest.php`

- [ ] **Step 1: Create UpdateProfileRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'job_title' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'organization' => ['nullable', 'string', 'max:150'],
            'bio' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
```

- [ ] **Step 2: Create UploadAvatarRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'avatar' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ];
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Requests/UpdateProfileRequest.php backend/app/Http/Requests/UploadAvatarRequest.php
git commit -m "feat: add form requests for profile update and avatar upload"
```

---

### Task 5: UserProfileController

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/UserProfileController.php`

- [ ] **Step 1: Create controller**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadAvatarRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Laravel\Facades\Image;

#[Group('User Profile', weight: 11)]
class UserProfileController extends Controller
{
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update($request->validated());

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user->fresh(),
        ]);
    }

    public function uploadAvatar(UploadAvatarRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Delete old avatar if exists
        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $file = $request->file('avatar');
        $extension = $file->getClientOriginalExtension();
        $filename = "avatars/{$user->id}.{$extension}";

        // Reprocess image via Intervention to strip EXIF/embedded scripts
        $image = Image::read($file->getRealPath());
        $image->scaleDown(width: 400, height: 400);

        // Encode and store
        $encoded = match ($extension) {
            'png' => $image->toPng(),
            'webp' => $image->toWebp(quality: 85),
            default => $image->toJpeg(quality: 85),
        };

        Storage::disk('public')->put($filename, (string) $encoded);

        $user->update(['avatar' => $filename]);

        return response()->json([
            'message' => 'Avatar uploaded successfully',
            'avatar' => $filename,
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $user->update(['avatar' => null]);

        return response()->json(['message' => 'Avatar removed successfully']);
    }
}
```

**Note:** This requires the `intervention/image` package. If not already installed:

```bash
docker compose exec php composer require intervention/image
```

Intervention Image v3 includes Laravel auto-discovery. GD driver is used by default (available in PHP 8.4 Docker image). If GD is not installed in the Docker image, add `php8.4-gd` to the Dockerfile.

- [ ] **Step 2: Verify GD extension is available**

Run: `docker compose exec php php -m | grep -i gd`
Expected: `gd`

If not present, add to `docker/php/Dockerfile`:
```dockerfile
RUN apt-get install -y libpng-dev libjpeg-dev libwebp-dev && docker-php-ext-configure gd --with-jpeg --with-webp && docker-php-ext-install gd
```

- [ ] **Step 3: Install Intervention Image if needed**

Run: `docker compose exec php composer require intervention/image`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/UserProfileController.php backend/composer.json backend/composer.lock
git commit -m "feat: add UserProfileController with avatar upload and image reprocessing"
```

---

### Task 6: Add Routes

**Files:**
- Modify: `backend/routes/api.php:358-363` (add after notification preferences routes)

- [ ] **Step 1: Add use statement at top of api.php**

Add at the top with other imports:
```php
use App\Http\Controllers\Api\V1\UserProfileController;
```

- [ ] **Step 2: Add routes after the notification preferences group (line ~363)**

Insert after the `Route::put('user/onboarding', ...)` line:

```php
// User Profile
Route::put('user/profile', [UserProfileController::class, 'update'])
    ->middleware('throttle:10,1');
Route::post('user/avatar', [UserProfileController::class, 'uploadAvatar'])
    ->middleware('throttle:10,1');
Route::delete('user/avatar', [UserProfileController::class, 'deleteAvatar'])
    ->middleware('throttle:10,1');
```

- [ ] **Step 3: Set up storage symlink**

Run: `docker compose exec php php artisan storage:link`
Expected: "The [public/storage] link has been created..."

- [ ] **Step 4: Verify routes are registered**

Run: `docker compose exec php php artisan route:list --path=user/`
Expected: Shows PUT user/profile, POST user/avatar, DELETE user/avatar

- [ ] **Step 5: Commit**

```bash
git add backend/routes/api.php
git commit -m "feat: add user profile and avatar API routes with rate limiting"
```

---

### Task 7: Storage Symlink and Nginx Config

**Files:**
- Modify: `deploy.sh` (add `storage:link`)
- Modify: `docker/nginx/default.conf` (add `/storage/` location)

- [ ] **Step 1: Create storage symlink**

Run: `docker compose exec php php artisan storage:link`
Expected: "The [public/storage] link has been created..." (or "already exists")

- [ ] **Step 2: Add `storage:link` to `deploy.sh`**

Add this line after the existing `php artisan` commands in `deploy.sh` (idempotent — safe to run repeatedly):

```bash
docker compose exec php php artisan storage:link 2>/dev/null || true
```

- [ ] **Step 3: Add nginx location block for `/storage/`**

In `docker/nginx/default.conf`, add a location block before the main `location /` block:

```nginx
location /storage/ {
    alias /var/www/html/storage/app/public/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

- [ ] **Step 4: Restart nginx**

Run: `docker compose restart nginx`

- [ ] **Step 5: Commit**

```bash
git add deploy.sh docker/nginx/default.conf
git commit -m "feat: add storage symlink and nginx config for avatar serving"
```

---

## Chunk 2: Frontend (Types, API, Components, Router)

### Task 8: Update TypeScript Types

**Files:**
- Modify: `frontend/src/types/models.ts:1-14` (extend User interface)

- [ ] **Step 1: Add new fields to User interface**

Update the `User` interface in `frontend/src/types/models.ts`:

```typescript
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  phone_number: string | null;
  job_title: string | null;
  department: string | null;
  organization: string | null;
  bio: string | null;
  must_change_password: boolean;
  onboarding_completed: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  roles?: string[];
  permissions?: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/models.ts
git commit -m "feat: add profile fields to User TypeScript interface"
```

---

### Task 9: Profile API Hooks

**Files:**
- Create: `frontend/src/features/settings/api/profileApi.ts`

- [ ] **Step 1: Create profile API module**

```typescript
import apiClient from "@/lib/api-client";
import type { User } from "@/types/models";

export interface UpdateProfilePayload {
  name: string;
  phone_number: string | null;
  job_title: string | null;
  department: string | null;
  organization: string | null;
  bio: string | null;
}

interface ProfileResponse {
  message: string;
  user: User;
}

interface AvatarResponse {
  message: string;
  avatar: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
  const { data } = await apiClient.put<ProfileResponse>("/user/profile", payload);
  return data;
}

export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const formData = new FormData();
  formData.append("avatar", file);
  const { data } = await apiClient.post<AvatarResponse>("/user/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteAvatar(): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>("/user/avatar");
  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/api/profileApi.ts
git commit -m "feat: add profile API client functions"
```

---

### Task 10: Profile Hooks

**Files:**
- Create: `frontend/src/features/settings/hooks/useProfile.ts`

- [ ] **Step 1: Create profile hooks**

```typescript
import { useMutation } from "@tanstack/react-query";
import { updateProfile, uploadAvatar, deleteAvatar } from "../api/profileApi";
import type { UpdateProfilePayload } from "../api/profileApi";
import { useAuthStore } from "@/stores/authStore";

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateProfile(data),
    onSuccess: (response) => {
      updateUser(response.user);
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
  });
}

export function useDeleteAvatar() {
  return useMutation({
    mutationFn: () => deleteAvatar(),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/hooks/useProfile.ts
git commit -m "feat: add profile mutation hooks"
```

---

### Task 11: AvatarUpload Component

**Files:**
- Create: `frontend/src/features/settings/components/AvatarUpload.tsx`

- [ ] **Step 1: Create avatar upload component**

```tsx
import { useRef, useState } from "react";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadAvatar, useDeleteAvatar } from "../hooks/useProfile";
import { useAuthStore } from "@/stores/authStore";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ".jpeg,.jpg,.png,.webp";

export function AvatarUpload() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const uploadMutation = useUploadAvatar();
  const deleteMutation = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = user?.avatar ? `/storage/${user.avatar}` : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setError("File must be under 5MB");
      return;
    }

    uploadMutation.mutate(file, {
      onSuccess: (response) => {
        if (user) {
          updateUser({ ...user, avatar: response.avatar });
        }
      },
      onError: () => setError("Upload failed. Please try again."),
    });

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDelete = () => {
    setError(null);
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        if (user) {
          updateUser({ ...user, avatar: null });
        }
      },
      onError: () => setError("Failed to remove avatar."),
    });
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex items-center gap-6">
      {/* Avatar preview */}
      <div className="relative">
        <div
          className={cn(
            "w-[120px] h-[120px] rounded-full border-2 border-[#232328] overflow-hidden",
            "flex items-center justify-center bg-[#1A1A1F] text-[#5A5650]",
          )}
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name ?? "Avatar"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl font-bold">
              {user?.name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "border border-[#232328] bg-[#151518] text-[#C5C0B8] hover:bg-[#1A1A1F] disabled:opacity-50",
          )}
        >
          <Camera size={14} />
          Upload Photo
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "text-[#E85A6B] hover:bg-[#E85A6B]/10 disabled:opacity-50",
            )}
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
        {error && <p className="text-xs text-[#E85A6B]">{error}</p>}
        <p className="text-xs text-[#5A5650]">JPEG, PNG, or WebP. Max 5MB.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/components/AvatarUpload.tsx
git commit -m "feat: add AvatarUpload component with preview and delete"
```

---

### Task 12: ProfileTab Component

**Files:**
- Create: `frontend/src/features/settings/components/ProfileTab.tsx`

- [ ] **Step 1: Create profile tab**

```tsx
import { useState, useEffect } from "react";
import { Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUpdateProfile } from "../hooks/useProfile";
import { AvatarUpload } from "./AvatarUpload";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateMutation = useUpdateProfile();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    job_title: "",
    department: "",
    organization: "",
    bio: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        phone_number: user.phone_number ?? "",
        job_title: user.job_title ?? "",
        department: user.department ?? "",
        organization: user.organization ?? "",
        bio: user.bio ?? "",
      });
    }
  }, [user]);

  const showToast = (message: string, type: "success" | "error") => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        name: form.name,
        phone_number: form.phone_number || null,
        job_title: form.job_title || null,
        department: form.department || null,
        organization: form.organization || null,
        bio: form.bio || null,
      },
      {
        onSuccess: () => showToast("Profile saved successfully", "success"),
        onError: () => showToast("Failed to save profile", "error"),
      },
    );
  };

  const inputClass = cn(
    "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
    "text-[#F0EDE8] placeholder:text-[#5A5650]",
    "focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      {/* Avatar */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6">
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Profile Photo</h3>
        <AvatarUpload />
      </section>

      {/* Profile Details */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-5">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Profile Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Name <span className="text-[#E85A6B]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={inputClass}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              className={inputClass}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Job Title
            </label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => handleChange("job_title", e.target.value)}
              className={inputClass}
              placeholder="e.g. Research Scientist"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Department
            </label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => handleChange("department", e.target.value)}
              className={inputClass}
              placeholder="e.g. Clinical Informatics"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Organization
            </label>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => handleChange("organization", e.target.value)}
              className={inputClass}
              placeholder="e.g. Acumenus Data Sciences"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              rows={4}
              maxLength={2000}
              className={cn(inputClass, "resize-none")}
              placeholder="A brief description about yourself and your research interests..."
            />
            <p className="text-xs text-[#5A5650] text-right">
              {form.bio.length}/2000
            </p>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending || !form.name.trim()}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
            "bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50",
          )}
        >
          {updateMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Profile
        </button>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-2",
              toast.type === "success"
                ? "border-[#2DD4BF]/30 bg-[#151518] text-[#2DD4BF]"
                : "border-[#E85A6B]/30 bg-[#151518] text-[#E85A6B]",
            )}
          >
            {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/components/ProfileTab.tsx
git commit -m "feat: add ProfileTab component with form and toasts"
```

---

### Task 13: AccountSecurityTab Component

**Files:**
- Create: `frontend/src/features/settings/components/AccountSecurityTab.tsx`

- [ ] **Step 1: Create account security tab**

```tsx
import { useState } from "react";
import { Loader2, Lock, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export function AccountSecurityTab() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirmation: "",
  });

  const showToast = (message: string, type: "success" | "error") => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const passwordsMatch =
    form.new_password === form.new_password_confirmation;

  const canSubmit =
    form.current_password.length > 0 &&
    form.new_password.length >= 8 &&
    passwordsMatch &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const { data } = await apiClient.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
        new_password_confirmation: form.new_password_confirmation,
      });
      if (data.user) updateUser(data.user);
      setForm({ current_password: "", new_password: "", new_password_confirmation: "" });
      showToast("Password changed successfully", "success");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to change password";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = cn(
    "w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
    "text-[#F0EDE8] placeholder:text-[#5A5650]",
    "focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      {/* Email (read-only) */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2DD4BF]/10">
            <Mail size={18} className="text-[#2DD4BF]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Email Address</h3>
            <p className="text-xs text-[#8A857D]">Your login email cannot be changed here</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className={cn(inputClass, "opacity-60 cursor-not-allowed")}
          />
          <p className="text-xs text-[#5A5650]">Contact your administrator to change your email address.</p>
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-lg border border-[#232328] bg-[#151518] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#C9A227]/10">
            <Lock size={18} className="text-[#C9A227]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Change Password</h3>
            <p className="text-xs text-[#8A857D]">Update your password regularly for security</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Current Password
            </label>
            <input
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((prev) => ({ ...prev, current_password: e.target.value }))}
              className={inputClass}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              New Password
            </label>
            <input
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((prev) => ({ ...prev, new_password: e.target.value }))}
              className={inputClass}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Confirm New Password
            </label>
            <input
              type="password"
              value={form.new_password_confirmation}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, new_password_confirmation: e.target.value }))
              }
              className={inputClass}
              placeholder="Re-enter new password"
            />
            {form.new_password_confirmation && !passwordsMatch && (
              <p className="text-xs text-[#E85A6B]">Passwords do not match</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
              "bg-[#C9A227] text-[#0E0E11] hover:bg-[#B8911F] disabled:opacity-50",
            )}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Change Password
          </button>
        </div>
      </section>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-bottom-2",
              toast.type === "success"
                ? "border-[#2DD4BF]/30 bg-[#151518] text-[#2DD4BF]"
                : "border-[#E85A6B]/30 bg-[#151518] text-[#E85A6B]",
            )}
          >
            {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/components/AccountSecurityTab.tsx
git commit -m "feat: add AccountSecurityTab with password change form"
```

---

### Task 14: SettingsPage

**Files:**
- Create: `frontend/src/features/settings/pages/SettingsPage.tsx`

- [ ] **Step 1: Create settings page with tab navigation**

```tsx
import { useSearchParams } from "react-router-dom";
import { User, Shield, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileTab } from "../components/ProfileTab";
import { AccountSecurityTab } from "../components/AccountSecurityTab";
import { NotificationSettings } from "../components/NotificationSettings";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "account", label: "Account & Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "profile";

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#2DD4BF]/10">
          <Settings size={20} className="text-[#2DD4BF]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Settings</h1>
          <p className="text-sm text-[#8A857D]">
            Manage your profile, security, and preferences
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#232328]">
        <nav className="flex gap-1" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => handleTabChange(key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === key
                  ? "border-[#2DD4BF] text-[#2DD4BF]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#232328]",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-2">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "account" && <AccountSecurityTab />}
        {activeTab === "notifications" && <NotificationSettings />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/settings/pages/SettingsPage.tsx
git commit -m "feat: add SettingsPage with tabbed navigation"
```

---

### Task 15: Add Route to Router

**Files:**
- Modify: `frontend/src/app/router.tsx:451` (add after GIS route, before admin)

- [ ] **Step 1: Add `/settings` route**

Insert after the GIS children block (line ~451) and before the admin block (line ~452):

```tsx
// ── User Settings ────────────────────────────────────────────────
{
  path: "settings",
  lazy: () =>
    import("@/features/settings/pages/SettingsPage").then((m) => ({
      Component: m.default,
    })),
},
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/router.tsx
git commit -m "feat: add /settings route with lazy loading"
```

---

## Chunk 3: Header Dropdown & Final Integration

### Task 16: Header User Dropdown

> **Note:** After this refactor, `Header` no longer uses `logout` directly — it's only used inside `UserDropdown`. Remove `logout` from the `Header` destructuring to avoid ESLint unused variable warnings.

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Replace inline user info and logout with dropdown**

Replace the entire `Header.tsx` with this updated version. Key changes: imports add `useNavigate`, `useRef`, `useEffect`, `Settings`, `ChevronDown`; user area becomes a dropdown:

Replace lines 71-83 (the user info div and logout button):

```tsx
{/* Old code to remove: */}
<div className="flex items-center gap-2 px-2" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
  <User size={16} />
  <span>{user.name}</span>
</div>

<button
  onClick={logout}
  className="btn btn-ghost btn-sm"
  style={{ gap: "var(--space-1)" }}
>
  <LogOut size={16} />
  <span>Logout</span>
</button>
```

Replace with:

```tsx
<UserDropdown />
```

- [ ] **Step 2: Add UserDropdown component inside Header.tsx**

Add before the `Header` function export, and add the needed imports:

Add to imports at top:
```tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Search, Sparkles, Bell, Settings, ChevronDown } from "lucide-react";
```

Add the `UserDropdown` component before the `Header` export:

```tsx
function UserDropdown() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const avatarUrl = user?.avatar ? `/storage/${user.avatar}` : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="btn btn-ghost btn-sm"
        style={{ gap: "var(--space-1)" }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.name ?? ""}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <User size={16} />
        )}
        <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          {user?.name}
        </span>
        <ChevronDown size={14} style={{ color: "var(--text-ghost)" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-48 rounded-lg border border-[#232328] bg-[#151518] shadow-xl z-50 py-1"
        >
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#C5C0B8] hover:bg-[#1A1A1F] transition-colors"
          >
            <Settings size={14} />
            Settings
          </button>
          <div className="border-t border-[#232328] my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#E85A6B] hover:bg-[#1A1A1F] transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Remove unused `useState` import from original (now combined)**

The original file imports `useState` on line 1 for `aboutAbbyOpen`. The new imports line replaces it entirely:

```tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useAbbyStore } from "@/stores/abbyStore";
import { LogOut, User, Search, Sparkles, Bell, Settings, ChevronDown } from "lucide-react";
import { AboutAbbyModal } from "./AboutAbbyModal";
```

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "feat: add user dropdown menu with Settings and Logout"
```

---

### Task 17: Build and Deploy

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run ESLint**

Run: `cd frontend && npx eslint src/features/settings/ src/components/layout/Header.tsx`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Run backend tests**

Run: `docker compose exec php vendor/bin/pest`
Expected: All tests pass

- [ ] **Step 4: Build frontend**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds

- [ ] **Step 5: Deploy**

Run: `./deploy.sh`
Expected: Deployment completes successfully

- [ ] **Step 6: Final commit with all remaining changes**

```bash
git add -A
git commit -m "feat: user profile and settings page with avatar upload"
```

- [ ] **Step 7: Push**

```bash
git push origin main
```
