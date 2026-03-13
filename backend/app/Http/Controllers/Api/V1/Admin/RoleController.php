<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

#[Group('Administration', weight: 220)]
class RoleController extends Controller
{
    /** Protected built-in roles that cannot be deleted. */
    private const PROTECTED = ['super-admin', 'admin', 'researcher', 'data-steward', 'mapping-reviewer', 'viewer'];

    public function index(): JsonResponse
    {
        return response()->json(
            Role::withCount('users')->with('permissions')->orderBy('name')->get()
        );
    }

    public function permissions(): JsonResponse
    {
        // Return all permissions grouped by domain prefix.
        $grouped = Permission::orderBy('name')->get()
            ->groupBy(fn ($p) => explode('.', $p->name)[0]);

        return response()->json($grouped);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json($role->load('permissions'));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);

        if (! empty($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        return response()->json($role->load('permissions'), 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'name' => "sometimes|string|max:100|unique:roles,name,{$role->id}",
            'permissions' => 'sometimes|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        if (isset($validated['name']) && $validated['name'] !== $role->name && in_array($role->name, self::PROTECTED)) {
            return response()->json(['message' => "The '{$role->name}' role name cannot be changed."], 422);
        }

        if (isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        if (array_key_exists('permissions', $validated)) {
            // super-admin always keeps all permissions.
            if ($role->name === 'super-admin') {
                return response()->json(['message' => 'super-admin permissions are managed automatically.'], 422);
            }

            $role->syncPermissions($validated['permissions']);
        }

        return response()->json($role->load('permissions'));
    }

    public function destroy(Role $role): JsonResponse
    {
        if (in_array($role->name, self::PROTECTED)) {
            return response()->json(['message' => "The '{$role->name}' role is protected and cannot be deleted."], 422);
        }

        $role->delete();

        return response()->json(null, 204);
    }
}
