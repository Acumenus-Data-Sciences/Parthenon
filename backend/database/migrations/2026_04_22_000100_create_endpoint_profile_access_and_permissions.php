<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Exceptions\RoleDoesNotExist;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Phase 18 D-11 + HIGHSEC §4.1 — Create the endpoint-profile access log +
 * seed the two Spatie permissions that gate the new Risteys-style endpoint
 * dashboard.
 *
 * See .planning/phases/18-risteys-style-endpoint-dashboard/18-CONTEXT.md
 * (D-11: warm-signal access log; D-08/D-09: RBAC matrix) and 18-RESEARCH.md
 * §Architecture Patterns / §Security Domain.
 *
 * Performs three related steps inside a single DB::transaction (Phase 13.1
 * D-01 single-transaction pattern — all DDL + seed rows commit atomically or
 * roll back together):
 *
 *   1. Creates `finngen.endpoint_profile_access` — lightweight access log
 *      (endpoint_name, source_key, last_accessed_at, access_count, timestamps)
 *      with a composite PK on (endpoint_name, source_key). Upserted on every
 *      GET /profile by the TrackEndpointProfileAccess middleware (Plan 18-04);
 *      read by WarmEndpointProfilesCommand (Plan 18-07) to select stale
 *      (endpoint × source) pairs for nightly warm.
 *
 *   2. Applies three-tier HIGHSEC §4.1 grants (parthenon_app DML,
 *      parthenon_finngen_rw DML, parthenon_finngen_ro SELECT) via a
 *      role-existence-guarded DO block so this migration is portable across
 *      dev / CI / production where roles may or may not exist yet.
 *
 *   3. Seeds the two Spatie permissions + grants them to the role matrix:
 *        - `finngen.endpoint_profile.view`    → viewer, researcher,
 *          data-steward, admin, super-admin. Viewer is included per D-08/D-09
 *          because cached profile data is aggregate only (not PHI).
 *        - `finngen.endpoint_profile.compute` → researcher, data-steward,
 *          admin, super-admin. Viewer is excluded — matches the
 *          `finngen.prs.compute` precedent from Phase 17.
 *      Role assignment is wrapped in try / catch RoleDoesNotExist so the
 *      migration applies cleanly on fresh bootstraps where the
 *      RolePermissionSeeder has not yet run (the seeder will pick up the
 *      assignments on first run afterward).
 *
 * Threat mitigations covered:
 *   - T-18-01 (EoP via missing permission gate): seeds the permissions that
 *     Plan 18-04 will apply via route middleware.
 *   - T-18-05 (DoS via access-log): composite PK makes upserts cheap;
 *     Plan 18-04 wraps the insert in try-catch to avoid poisoning the
 *     request transaction.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // ------------------------------------------------------------------
            // Step 1 — Access-log table in the finngen.* schema.
            // ------------------------------------------------------------------
            DB::statement(<<<'SQL'
                CREATE TABLE IF NOT EXISTS finngen.endpoint_profile_access (
                    endpoint_name    TEXT        NOT NULL,
                    source_key       TEXT        NOT NULL,
                    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    access_count     INTEGER     NOT NULL DEFAULT 0,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (endpoint_name, source_key)
                )
            SQL);

            DB::statement(
                'CREATE INDEX IF NOT EXISTS endpoint_profile_access_last_accessed_idx
                 ON finngen.endpoint_profile_access (last_accessed_at DESC)'
            );

            DB::statement(<<<'SQL'
                COMMENT ON TABLE finngen.endpoint_profile_access IS
                'Phase 18 D-11 — warm-signal access log. Upserted by TrackEndpointProfileAccess middleware on every GET /profile. Read by WarmEndpointProfilesCommand to select endpoints for nightly warm.'
            SQL);

            // ------------------------------------------------------------------
            // Step 2 — HIGHSEC §4.1 three-tier grants. Pattern mirrors the
            // DO $grants$ block in GwasSchemaProvisioner lines 107-124 and the
            // Phase 13.1 finngen schema-isolation migration.
            // ------------------------------------------------------------------
            DB::statement(<<<'SQL'
                DO $grants$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                        GRANT USAGE ON SCHEMA finngen TO parthenon_app;
                        GRANT SELECT, INSERT, UPDATE, DELETE ON finngen.endpoint_profile_access TO parthenon_app;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_rw') THEN
                        GRANT SELECT, INSERT, UPDATE, DELETE ON finngen.endpoint_profile_access TO parthenon_finngen_rw;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_finngen_ro') THEN
                        GRANT SELECT ON finngen.endpoint_profile_access TO parthenon_finngen_ro;
                    END IF;
                END
                $grants$
            SQL);

            // ------------------------------------------------------------------
            // Step 3 — Spatie permissions + role assignments. firstOrCreate is
            // idempotent; RoleDoesNotExist is caught so fresh CI bootstrap
            // (where RolePermissionSeeder has not yet run) applies cleanly and
            // the seeder later picks up the assignments.
            // ------------------------------------------------------------------
            $view = Permission::firstOrCreate(
                ['name' => 'finngen.endpoint_profile.view', 'guard_name' => 'web'],
            );
            $compute = Permission::firstOrCreate(
                ['name' => 'finngen.endpoint_profile.compute', 'guard_name' => 'web'],
            );

            try {
                foreach (['researcher', 'data-steward', 'admin', 'super-admin', 'viewer'] as $roleName) {
                    Role::findByName($roleName, 'web')->givePermissionTo($view);
                }
                foreach (['researcher', 'data-steward', 'admin', 'super-admin'] as $roleName) {
                    Role::findByName($roleName, 'web')->givePermissionTo($compute);
                }
            } catch (RoleDoesNotExist) {
                // Fresh-bootstrap case — RolePermissionSeeder will pick up
                // these assignments from its ROLES map on first run.
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            Permission::whereIn('name', [
                'finngen.endpoint_profile.view',
                'finngen.endpoint_profile.compute',
            ])
                ->where('guard_name', 'web')
                ->delete();

            DB::statement('DROP TABLE IF EXISTS finngen.endpoint_profile_access');
        });
    }
};
