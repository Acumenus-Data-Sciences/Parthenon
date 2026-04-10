<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Restore the Morpheus dataset registry.
 *
 * Background: the inpatient_ext schema and its morpheus_dataset registry table
 * were originally created by an Alembic migration inside the morpheus-ingest/
 * directory. That directory was deleted in commit 2023fbd0 (v1.0.3) as part
 * of obsolete-directory cleanup, leaving MorpheusDashboardController and
 * MorpheusPatientController pointing at a table that no longer exists on any
 * fresh database. Every Morpheus API request then 404s on resolveSchema()
 * regardless of whether the underlying per-dataset schema (mimiciv,
 * atlantic_health) is populated.
 *
 * This migration recreates inpatient_ext.morpheus_dataset as a Laravel-owned
 * artifact so it survives deploys and fresh installs, and seeds it with the
 * datasets that actually exist in the database.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->ensureSchemaExists('inpatient_ext');

        // Registry table — column shape matches the SELECTs in
        // MorpheusDatasetController::index/show and the minimal
        // (schema_name, status) shape used by Morpheus feature tests,
        // so both production and test code keep working.
        DB::statement(<<<'SQL'
            CREATE TABLE IF NOT EXISTS inpatient_ext.morpheus_dataset (
                dataset_id    BIGSERIAL PRIMARY KEY,
                name          TEXT NOT NULL,
                schema_name   TEXT NOT NULL UNIQUE,
                description   TEXT,
                source_type   TEXT,
                patient_count INTEGER NOT NULL DEFAULT 0,
                status        TEXT NOT NULL DEFAULT 'active',
                created_at    TIMESTAMP NOT NULL DEFAULT NOW()
            )
        SQL);

        // Seed known datasets with live patient counts. Idempotent — safe
        // to re-run. Only datasets whose schema + patients table actually
        // exist get registered, so a DB missing a dataset won't break the
        // migration.
        foreach ($this->datasetSeeds() as $seed) {
            if (! $this->datasetSchemaIsReady($seed['schema_name'])) {
                continue;
            }

            $patientCount = $this->countPatients($seed['schema_name']);

            DB::statement(<<<'SQL'
                INSERT INTO inpatient_ext.morpheus_dataset
                    (name, schema_name, description, source_type, patient_count, status)
                VALUES (?, ?, ?, ?, ?, 'active')
                ON CONFLICT (schema_name) DO UPDATE SET
                    name          = EXCLUDED.name,
                    description   = EXCLUDED.description,
                    source_type   = EXCLUDED.source_type,
                    patient_count = EXCLUDED.patient_count,
                    status        = 'active'
            SQL, [
                $seed['name'],
                $seed['schema_name'],
                $seed['description'],
                $seed['source_type'],
                $patientCount,
            ]);
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS inpatient_ext.morpheus_dataset');
        // Intentionally not dropping inpatient_ext — other extension tables
        // may live alongside the registry in future.
    }

    /**
     * Create a schema only if it does not already exist.
     *
     * Postgres evaluates the CREATE privilege check before the IF NOT EXISTS
     * existence check, so `CREATE SCHEMA IF NOT EXISTS inpatient_ext` still
     * fails with "permission denied for database" when the role lacks
     * CREATE on the database — even on upgrade paths where the schema is
     * already present. Checking first with information_schema keeps the
     * common "upgrade over existing install" path out of that privilege
     * check entirely, and produces an actionable error for genuine fresh
     * installs that are missing the grant.
     */
    private function ensureSchemaExists(string $schema): void
    {
        $exists = (bool) (DB::selectOne(
            'SELECT EXISTS (
                SELECT 1 FROM information_schema.schemata WHERE schema_name = ?
            ) AS exists',
            [$schema]
        )->exists ?? false);

        if ($exists) {
            return;
        }

        try {
            DB::statement("CREATE SCHEMA {$schema}");
        } catch (QueryException $e) {
            $dbName = DB::connection()->getDatabaseName();
            $username = DB::connection()->getConfig('username');

            throw new RuntimeException(
                "Cannot create schema '{$schema}' in database '{$dbName}': the "
                ."role '{$username}' lacks CREATE privilege on the database. "
                .'As a Postgres superuser, run: '
                ."GRANT CREATE ON DATABASE {$dbName} TO {$username};  "
                .'(Docker-only installs get this grant automatically from '
                .'docker/postgres/init.sql. Host-Postgres installs require a '
                .'one-time manual grant by the DB admin before running '
                .'migrations.) Original PG error: '.$e->getMessage(),
                0,
                $e
            );
        }
    }

    /**
     * Datasets known to be Morpheus-compatible (raw MIMIC-IV shape:
     * patients/admissions/icustays/diagnoses_icd/procedures_icd/labevents).
     * synthetic_ehr uses a different raw-EHR shape and is intentionally
     * excluded until it is ETL'd into the MIMIC-IV shape.
     *
     * @return array<int, array{name: string, schema_name: string, description: string, source_type: string}>
     */
    private function datasetSeeds(): array
    {
        return [
            [
                'name' => 'MIMIC-IV Demo',
                'schema_name' => 'mimiciv',
                'description' => 'MIMIC-IV Clinical Database demo subset (100 de-identified ICU patients) from Beth Israel Deaconess Medical Center.',
                'source_type' => 'MIMIC',
            ],
            [
                'name' => 'Atlantic Health System',
                'schema_name' => 'atlantic_health',
                'description' => 'Synthesized inpatient cohort modeled on Atlantic Health System admissions, rendered in MIMIC-IV table shape for uniform dashboard and patient-journey queries.',
                'source_type' => 'Synthetic',
            ],
        ];
    }

    /**
     * A dataset is ready when its schema exists AND it has a patients table.
     * Guards against partially-loaded or in-flight ETL states.
     */
    private function datasetSchemaIsReady(string $schema): bool
    {
        $row = DB::selectOne(
            'SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = ? AND table_name = ?
            ) AS exists',
            [$schema, 'patients']
        );

        return (bool) ($row->exists ?? false);
    }

    private function countPatients(string $schema): int
    {
        // Schema name is validated against datasetSeeds() — safe to interpolate.
        $row = DB::selectOne("SELECT count(*)::int AS c FROM \"{$schema}\".patients");

        return (int) ($row->c ?? 0);
    }
};
