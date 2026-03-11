<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

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

        DB::statement("SELECT AddGeometryColumn('app', 'gis_admin_boundaries', 'geom', 4326, 'MULTIPOLYGON', 2)");
        DB::statement('CREATE INDEX idx_gis_boundaries_geom ON gis_admin_boundaries USING GIST (geom)');
        DB::statement('CREATE INDEX idx_gis_boundaries_level_country ON gis_admin_boundaries (boundary_level_id, country_code)');
    }

    public function down(): void
    {
        Schema::dropIfExists('gis_admin_boundaries');
        Schema::dropIfExists('gis_boundary_levels');
    }
};
