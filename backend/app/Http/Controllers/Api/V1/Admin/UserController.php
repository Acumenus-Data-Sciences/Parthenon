<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\TempPasswordMail;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;

#[Group('Administration', weight: 220)]
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles')
            ->when($request->search, fn ($q, $s) => $q->where('name', 'ilike', "%{$s}%")
                ->orWhere('email', 'ilike', "%{$s}%"))
            ->when($request->role, fn ($q, $r) => $q->role($r))
            ->orderBy($request->sort_by ?? 'created_at', $request->sort_dir ?? 'desc');

        return response()->json($query->paginate($request->per_page ?? 25));
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(
            $user->load('roles.permissions')->append(['all_permissions'])
        );
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

        return response()->json($user->load('roles'), 201);
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

        return response()->json($user->load('roles'));
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

        return response()->json($user->load('roles'));
    }

    /** List all available roles (for populating role dropdowns). */
    public function roles(): JsonResponse
    {
        return response()->json(
            Role::with('permissions')->orderBy('name')->get()
        );
    }
}
