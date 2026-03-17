<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gis_boundary_levels', function (Blueprint $table) {
            $table->id();
            $table->string('code', 10)->unique();
            $table->string('label');
            $table->text('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('gis_admin_boundaries', function (Blueprint $table) {
            $table->id();
            $table->string('gid', 50)->unique();
            $table->string('name');
            $table->string('name_variant')->nullable();
            $table->string('country_code', 3)->index();
            $table->string('country_name');
            $table->foreignId('boundary_level_id')
                ->constrained('gis_boundary_levels');
            $table->string('parent_gid', 50)->nullable()->index();
            $table->string('type')->nullable();
            $table->string('type_en')->nullable();
            $table->string('iso_code', 10)->nullable();
            $table->string('hasc_code', 20)->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->string('source', 20)->default('gadm');
            $table->string('source_version', 20)->nullable();
            $table->timestamps();
        });

        if ($this->postgisAvailable()) {
            // Use ALTER TABLE directly instead of AddGeometryColumn() — the legacy
            // function fails when PostGIS is installed in a non-public schema because
            // it can't find spatial_ref_sys without the correct search_path.
            DB::statement('ALTER TABLE app.gis_admin_boundaries ADD COLUMN geom geometry(MultiPolygon, 4326)');
            DB::statement('CREATE INDEX idx_gis_boundaries_geom ON app.gis_admin_boundaries USING GIST (geom)');
        } else {
            Log::warning('PostGIS not available — skipping geometry column and GIST index on gis_admin_boundaries. GIS features will be limited.');
        }

        DB::statement('CREATE INDEX idx_gis_boundaries_level_country ON gis_admin_boundaries (boundary_level_id, country_code)');
    }

    public function down(): void
    {
        Schema::dropIfExists('gis_admin_boundaries');
        Schema::dropIfExists('gis_boundary_levels');
    }

    private function postgisAvailable(): bool
    {
        try {
            $result = DB::selectOne("SELECT COUNT(*) AS cnt FROM pg_extension WHERE extname = 'postgis'");

            return $result !== null && (int) $result->cnt > 0;
        } catch (\Throwable) {
            return false;
        }
    }
};
