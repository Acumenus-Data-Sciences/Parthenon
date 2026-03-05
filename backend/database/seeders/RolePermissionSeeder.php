<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /**
     * All platform permissions, grouped by domain.
     *
     * @var array<string, list<string>>
     */
    private const PERMISSIONS = [
        // ── User & role management ────────────────────────────────────────
        'users' => ['view', 'create', 'edit', 'delete', 'impersonate'],
        'roles' => ['view', 'create', 'edit', 'delete'],
        'permissions' => ['view', 'assign'],

        // ── Authentication provider configuration ─────────────────────────
        'auth-providers' => ['view', 'configure'],

        // ── Data sources ──────────────────────────────────────────────────
        'sources' => ['view', 'create', 'edit', 'delete'],

        // ── Vocabulary & ontology ─────────────────────────────────────────
        'vocabulary' => ['view', 'manage'],

        // ── Data ingestion pipeline ───────────────────────────────────────
        'ingestion' => ['view', 'upload', 'run', 'delete'],

        // ── AI concept mapping review ─────────────────────────────────────
        'mapping' => ['view', 'review', 'override'],

        // ── Cohort definitions ────────────────────────────────────────────
        'cohorts' => ['view', 'create', 'edit', 'delete', 'generate'],

        // ── Concept sets ─────────────────────────────────────────────────
        'concept-sets' => ['view', 'create', 'edit', 'delete'],

        // ── Analyses (characterization, IR, pathways, PLE, PLP) ──────────
        'analyses' => ['view', 'create', 'edit', 'run', 'delete'],

        // ── Studies / Strategus ───────────────────────────────────────────
        'studies' => ['view', 'create', 'edit', 'execute', 'delete'],

        // ── Data quality & Achilles ───────────────────────────────────────
        'data-quality' => ['view', 'run', 'delete'],

        // ── Jobs / queue ──────────────────────────────────────────────────
        'jobs' => ['view', 'cancel'],

        // ── Patient profiles ──────────────────────────────────────────────
        'profiles' => ['view'],

        // ── System administration ─────────────────────────────────────────
        'system' => ['view-horizon', 'view-logs', 'manage-config'],
    ];

    /**
     * Role definitions: each key is a role name, value lists the
     * permission names (domain.action) granted to that role.
     *
     * @var array<string, list<string>>
     */
    private const ROLES = [
        // Full platform access — assigned only to the bootstrap admin user.
        'super-admin' => [], // receives all permissions via wildcard below

        // Can manage users, roles, and auth providers; cannot do research.
        'admin' => [
            'users.view', 'users.create', 'users.edit', 'users.delete',
            'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
            'permissions.view', 'permissions.assign',
            'auth-providers.view', 'auth-providers.configure',
            'sources.view', 'sources.create', 'sources.edit', 'sources.delete',
            'jobs.view', 'jobs.cancel',
            'system.view-horizon', 'system.view-logs', 'system.manage-config',
        ],

        // Clinical/epidemiological researcher — primary user persona.
        'researcher' => [
            'vocabulary.view',
            'cohorts.view', 'cohorts.create', 'cohorts.edit', 'cohorts.generate',
            'concept-sets.view', 'concept-sets.create', 'concept-sets.edit',
            'analyses.view', 'analyses.create', 'analyses.edit', 'analyses.run',
            'studies.view', 'studies.create', 'studies.edit', 'studies.execute',
            'data-quality.view',
            'profiles.view',
            'sources.view',
            'jobs.view',
        ],

        // Responsible for data pipelines and CDM quality.
        'data-steward' => [
            'sources.view', 'sources.create', 'sources.edit', 'sources.delete',
            'ingestion.view', 'ingestion.upload', 'ingestion.run', 'ingestion.delete',
            'mapping.view', 'mapping.review', 'mapping.override',
            'vocabulary.view', 'vocabulary.manage',
            'data-quality.view', 'data-quality.run', 'data-quality.delete',
            'jobs.view', 'jobs.cancel',
            'cohorts.view',
            'analyses.view',
        ],

        // Reviews and approves AI concept mapping suggestions.
        'mapping-reviewer' => [
            'vocabulary.view',
            'mapping.view', 'mapping.review',
            'ingestion.view',
            'sources.view',
            'jobs.view',
        ],

        // Read-only access to research outputs.
        'viewer' => [
            'vocabulary.view',
            'cohorts.view',
            'concept-sets.view',
            'analyses.view',
            'studies.view',
            'data-quality.view',
            'profiles.view',
            'sources.view',
            'jobs.view',
        ],
    ];

    public function run(): void
    {
        // Reset cached roles and permissions so changes take effect immediately.
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Create all permissions ────────────────────────────────────────
        $all = [];
        foreach (self::PERMISSIONS as $domain => $actions) {
            foreach ($actions as $action) {
                $name = "{$domain}.{$action}";
                $all[] = Permission::firstOrCreate(
                    ['name' => $name, 'guard_name' => 'web'],
                );
            }
        }

        // ── Create roles and assign permissions ───────────────────────────
        foreach (self::ROLES as $roleName => $permNames) {
            $role = Role::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web'],
            );

            if ($roleName === 'super-admin') {
                // Super-admin gets every permission.
                $role->syncPermissions($all);
            } else {
                $role->syncPermissions(
                    Permission::whereIn('name', $permNames)
                        ->where('guard_name', 'web')
                        ->get(),
                );
            }
        }
    }
}
