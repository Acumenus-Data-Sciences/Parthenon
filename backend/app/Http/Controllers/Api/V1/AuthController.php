<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Mail\TempPasswordMail;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

#[Group('Authentication', weight: 10)]
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
            return response()->json(['message' => 'Account created. Check your email for your temporary password.']);
        }

        $tempPassword = $this->generateTempPassword();

        $user = User::create([
            'name' => trim($request->string('name')),
            'email' => $email,
            'password' => Hash::make($tempPassword),
            'must_change_password' => true,
            'phone_number' => $request->string('phone_number') ?: null,
        ]);

        // Demo site: grant super-admin to all new registrations
        $user->assignRole('super-admin');

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

        return response()->json(['message' => 'Account created. Check your email for your temporary password.']);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', strtolower($request->email))
            ->with('roles.permissions')  // Eager-load upfront — avoids extra queries in formatUser
            ->first();

        // Same error for "not found" and "wrong password" to prevent enumeration
        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        // Defer last_login_at update until after response is sent
        dispatch(function () use ($user) {
            $user->updateQuietly(['last_login_at' => now()]);
        })->afterResponse();

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
            'new_password' => 'required|string|min:8',
        ]);

        /** @var User $user */
        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 401);
        }

        if (Hash::check($request->new_password, $user->password)) {
            return response()->json(['message' => 'New password must differ from the current password'], 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password),
            'must_change_password' => false,
        ]);

        return response()->json([
            'message' => 'Password changed successfully',
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function formatUser(User $user): array
    {
        $user->loadMissing('roles.permissions');

        return [
            ...$user->only(['id', 'name', 'email', 'avatar', 'phone_number', 'last_login_at',
                'must_change_password', 'onboarding_completed', 'created_at', 'updated_at']),
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
}
