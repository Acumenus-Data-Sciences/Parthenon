<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\AdminBroadcastMail;
use App\Mail\TempPasswordMail;
use App\Models\App\UserAuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;

/**
 * @group Administration
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Subquery: most recent audit event timestamp for each user (= true "last active")
        $lastActiveSubquery = UserAuditLog::select('occurred_at')
            ->whereColumn('user_id', 'users.id')
            ->orderByDesc('occurred_at')
            ->limit(1);

        $allowedSorts = ['name', 'email', 'last_active_at', 'created_at'];
        $sortBy = in_array($request->sort_by, $allowedSorts) ? $request->sort_by : 'created_at';
        $sortDir = $request->sort_dir === 'asc' ? 'asc' : 'desc';

        $query = User::with('roles')
            ->addSelect(['users.*', 'last_active_at' => $lastActiveSubquery])
            ->when($request->search, fn ($q, $s) => $q->where('users.name', 'ilike', "%{$s}%")
                ->orWhere('users.email', 'ilike', "%{$s}%"))
            ->when($request->role, fn ($q, $r) => $q->role($r))
            ->orderBy($sortBy, $sortDir);

        return response()->json(
            $query->paginate($request->per_page ?? 25)->through(fn ($user) => $this->formatUser($user))
        );
    }

    public function show(User $user): JsonResponse
    {
        $user->load('roles.permissions');

        return response()->json([
            'data' => [
                ...$user->toArray(),
                'all_permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'send_temp_password' => 'boolean',
            'password' => ['nullable', Password::min(8)->mixedCase()->numbers()],
            'roles' => 'array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        $sendTemp = $validated['send_temp_password'] ?? true;
        $plainPassword = $sendTemp
            ? $this->generateTempPassword()
            : $validated['password'];

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($plainPassword),
            'must_change_password' => $sendTemp,
        ]);

        if (! empty($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        if ($sendTemp) {
            try {
                Mail::to($user->email)->send(new TempPasswordMail($user->name, $plainPassword));
            } catch (\Throwable $e) {
                logger()->warning('Failed to send temp password email', [
                    'user_id' => $user->id,
                    'temp_password' => $plainPassword,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json($this->formatUser($user->load('roles')), 201);
    }

    /** Format a User for API responses — roles as string names, not full objects. */
    private function formatUser(User $user): array
    {
        // last_active_at is the most recent audit event (or falls back to last_login_at)
        $lastActive = $user->last_active_at ?? $user->last_login_at;
        $isActive = $lastActive !== null && $lastActive >= now()->subDays(30);

        return [
            ...$user->toArray(),
            'roles' => $user->getRoleNames(),
            'last_active_at' => $lastActive?->toIso8601String(),
            'is_active' => $isActive,
        ];
    }

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

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => "sometimes|email|unique:users,email,{$user->id}",
            'password' => ['sometimes', Password::min(8)->mixedCase()->numbers()],
            'roles' => 'sometimes|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update(array_filter($validated, fn ($v, $k) => $k !== 'roles', ARRAY_FILTER_USE_BOTH));

        if (array_key_exists('roles', $validated)) {
            // Prevent removing super-admin from the last super-admin account.
            if ($user->hasRole('super-admin') && ! in_array('super-admin', $validated['roles'])) {
                $remaining = User::role('super-admin')->where('id', '!=', $user->id)->count();
                if ($remaining === 0) {
                    return response()->json(['message' => 'Cannot remove super-admin from the only super-admin account.'], 422);
                }
            }

            $user->syncRoles($validated['roles']);
        }

        return response()->json($this->formatUser($user->load('roles')));
    }

    public function destroy(User $user): JsonResponse
    {
        // Prevent deleting the last super-admin.
        if ($user->hasRole('super-admin')) {
            $remaining = User::role('super-admin')->where('id', '!=', $user->id)->count();
            if ($remaining === 0) {
                return response()->json(['message' => 'Cannot delete the only super-admin account.'], 422);
            }
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(null, 204);
    }

    /** Replace all roles on a user. */
    public function syncRoles(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        if ($user->hasRole('super-admin') && ! in_array('super-admin', $validated['roles'])) {
            $remaining = User::role('super-admin')->where('id', '!=', $user->id)->count();
            if ($remaining === 0) {
                return response()->json(['message' => 'Cannot remove super-admin from the only super-admin account.'], 422);
            }
        }

        $user->syncRoles($validated['roles']);

        return response()->json($this->formatUser($user->load('roles')));
    }

    /** List all available roles (for populating role dropdowns). */
    public function roles(): JsonResponse
    {
        return response()->json(
            Role::with('permissions')->orderBy('name')->get()
        );
    }

    /** Send an individual email to every registered user. Super-admin only. */
    public function broadcastEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'body' => 'required|string|max:10000',
        ]);

        $emails = User::pluck('email')->toArray();

        if (empty($emails)) {
            return response()->json(['message' => 'No registered users to email.'], 422);
        }

        $senderName = $request->user()->name;
        $mailable = new AdminBroadcastMail(
            $validated['subject'],
            $validated['body'],
            $senderName,
        );

        $sent = 0;
        $failed = 0;
        $failedRecipients = [];

        foreach ($emails as $index => $email) {
            try {
                Mail::to($email)->send(clone $mailable);
                $sent++;

                // Respect Resend's 5 req/sec rate limit — pause every 4 sends
                if (($index + 1) % 4 === 0) {
                    usleep(300_000); // 300ms
                }
            } catch (\Throwable $e) {
                $failed++;
                $failedRecipients[] = $email;

                // Logging is non-critical — never let a log failure crash the request
                try {
                    logger()->warning('Admin broadcast email failed for recipient', [
                        'recipient' => $email,
                        'error' => $e->getMessage(),
                    ]);
                } catch (\Throwable) {
                    // Log channel unavailable — silently continue
                }
            }
        }

        return response()->json([
            'message' => $failed === 0
                ? "Email sent successfully to all {$sent} users."
                : "Sent to {$sent} users, {$failed} failed.",
            'recipient_count' => $sent,
            'failed_count' => $failed,
        ]);
    }
}
