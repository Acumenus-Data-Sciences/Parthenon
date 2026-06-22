<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soft-delete audit columns on the FHIR-to-OMOP crosswalk tables.
 *
 * The FHIR Ingestion Medgnosis-Parity Port adds soft-delete support: when an
 * inbound FHIR resource is retired, its crosswalk row is tombstoned rather than
 * hard-deleted so the OMOP id is never reissued. These columns capture when and
 * why.
 *
 * Connection note: the `fhir_*_crosswalk` tables are created by
 * 2026_03_05_270001_create_fhir_crosswalk_tables.php and
 * 2026_03_12_010001_add_fhir_ig_crosswalk_tables.php using bare `Schema::create`
 * (default `pgsql` connection, search_path `app,php,public`), and
 * CrosswalkService reads/writes them via bare `DB::table(...)` (also default
 * connection). They therefore live on the DEFAULT connection, NOT on `omop` —
 * verified against CrosswalkService and the two creating migrations. This ALTER
 * targets the default connection to match.
 *
 * Each column add is guarded by `Schema::hasColumn` so the migration is
 * idempotent and safe to re-run.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $crosswalkTables = [
        'fhir_patient_crosswalk',
        'fhir_encounter_crosswalk',
        'fhir_provider_crosswalk',
        'fhir_location_crosswalk',
        'fhir_caresite_crosswalk',
    ];

    public function up(): void
    {
        foreach ($this->crosswalkTables as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'deleted_at')) {
                    $table->timestamp('deleted_at')->nullable();
                }
                if (! Schema::hasColumn($tableName, 'deleted_reason')) {
                    $table->string('deleted_reason', 250)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach ($this->crosswalkTables as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (Schema::hasColumn($tableName, 'deleted_reason')) {
                    $table->dropColumn('deleted_reason');
                }
                if (Schema::hasColumn($tableName, 'deleted_at')) {
                    $table->dropColumn('deleted_at');
                }
            });
        }
    }
};
