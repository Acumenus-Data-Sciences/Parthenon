<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;

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
            'name'     => 'required|string|max:255',
            'email'    => 'required|email|unique:users',
            'password' => ['required', Password::min(8)->mixedCase()->numbers()],
            'roles'    => 'array',
            'roles.*'  => 'string|exists:roles,name',
        ]);

        $user = User::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        if (! empty($validated['roles'])) {
            $user->syncRoles($validated['roles']);
        }

        return response()->json($user->load('roles'), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => "sometimes|email|unique:users,email,{$user->id}",
            'password' => ['sometimes', Password::min(8)->mixedCase()->numbers()],
            'roles'    => 'sometimes|array',
            'roles.*'  => 'string|exists:roles,name',
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
            'roles'   => 'required|array',
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
