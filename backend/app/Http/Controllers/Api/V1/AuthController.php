<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Mail\TempPasswordMail;
use App\Models\App\UserAuditLog;
use App\Models\User;
use App\Support\ApiMessage;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * @group Authentication
 */
class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255',
            'phone_number' => 'nullable|string|max:30',
        ]);

        $email = strtolower(trim($request->string('email')));

        // Always return the same message to prevent email enumeration
        if (User::where('email', $email)->exists()) {
            return response()->json(ApiMessage::payload('auth.account_created'));
        }

        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'name' => trim($request->string('name')),
            'email' => $email,
            'password' => Hash::make($tempPassword),
            'must_change_password' => true,
            'phone_number' => $request->string('phone_number') ?: null,
        ]);

        $this->assignDefaultResearcherRole($user);

        try {
            Mail::to($user->email)->send(new TempPasswordMail($user->name, $tempPassword));
        } catch (\Throwable $e) {
            // Non-fatal: log the temp password so admins can retrieve it if email fails
            logger()->warning('Failed to send temp password email', [
                'user_id' => $user->id,
                'email' => $user->email,
                'temp_password' => $tempPassword,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(ApiMessage::payload('auth.account_created'));
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', strtolower($request->email))
            ->with('roles.permissions')  // Eager-load upfront — avoids extra queries in formatUser
            ->first();

        // Same error for "not found" and "wrong password" to prevent enumeration
        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(ApiMessage::payload('auth.invalid_credentials'), 401);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        // Record login timestamp and audit entry
        $user->updateQuietly(['last_login_at' => now()]);
        UserAuditLog::create([
            'user_id' => $user->id,
            'action' => 'login',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('roles.permissions');

        return response()->json($this->formatUser($user));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        /** @var User $user */
        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json(ApiMessage::payload('auth.current_password_incorrect'), 401);
        }

        if (Hash::check($request->new_password, $user->password)) {
            return response()->json(ApiMessage::payload('auth.new_password_must_differ'), 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
            'must_change_password' => false,
        ]);

        UserAuditLog::create([
            'user_id' => $user->id,
            'action' => 'password_changed',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            ...ApiMessage::payload('auth.password_changed'),
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string|email',
        ]);

        $email = strtolower(trim($request->string('email')));
        $user = User::where('email', $email)->first();

        if ($user) {
            $tempPassword = $this->generateTempPassword();

            $user->update([
                'password' => Hash::make($tempPassword),
                'must_change_password' => true,
            ]);

            // Revoke all existing sessions
            $user->tokens()->delete();

            // Audit log (without temp password on success path)
            logger()->info('Password reset requested', [
                'user_id' => $user->id,
                'email' => $user->email,
            ]);

            try {
                Mail::to($user->email)->send(new TempPasswordMail($user->name, $tempPassword));
            } catch (\Throwable $e) {
                logger()->warning('Failed to send password reset email', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'temp_password' => $tempPassword,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json(ApiMessage::payload('auth.temporary_password_sent'));
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        UserAuditLog::create([
            'user_id' => $user->id,
            'action' => 'logout',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $user->currentAccessToken()->delete();

        return response()->json(ApiMessage::payload('auth.logged_out'));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function formatUser(User $user): array
    {
        $user->loadMissing('roles.permissions');

        return [
            ...$user->only(['id', 'name', 'email', 'avatar', 'phone_number', 'job_title',
                'department', 'organization', 'bio', 'last_login_at',
                'must_change_password', 'onboarding_completed', 'default_source_id',
                'theme_preference', 'locale', 'created_at', 'updated_at']),
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }

    /**
     * Generate a cryptographically random temp password.
     * Excludes visually ambiguous characters (0/O, 1/l/I).
     */
    private function generateTempPassword(int $length = 12): string
    {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $result = '';
        $max = strlen($chars) - 1;

        for ($i = 0; $i < $length; $i++) {
            $result .= $chars[random_int(0, $max)];
        }

        return $result;
    }

    /**
     * Registration should not hard-fail if role seed data drifted in a long-lived environment.
     * Attempt to self-heal the default researcher role before assigning it.
     */
    private function assignDefaultResearcherRole(User $user): void
    {
        try {
            if ($this->ensureResearcherRoleExists()) {
                $user->assignRole('researcher');

                return;
            }

            logger()->error('Researcher role unavailable during self-registration', [
                'user_id' => $user->id,
                'email' => $user->email,
            ]);
        } catch (\Throwable $e) {
            logger()->error('Failed to assign default researcher role during self-registration', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function ensureResearcherRoleExists(): bool
    {
        if (Role::where('name', 'researcher')->where('guard_name', 'web')->exists()) {
            return true;
        }

        logger()->warning('Researcher role missing during self-registration; reseeding roles and permissions.', [
            'action' => 'register',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        app(RolePermissionSeeder::class)->run();

        return Role::where('name', 'researcher')->where('guard_name', 'web')->exists();
    }
}
