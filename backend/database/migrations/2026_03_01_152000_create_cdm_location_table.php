<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('cdm')->create('location', function (Blueprint $table) {
            $table->bigInteger('location_id')->primary();
            $table->string('address_1', 50)->nullable();
            $table->string('address_2', 50)->nullable();
            $table->string('city', 50)->nullable();
            $table->string('state', 2)->nullable();
            $table->string('zip', 9)->nullable();
            $table->string('county', 20)->nullable();
            $table->string('location_source_value', 50)->nullable();
            $table->integer('country_concept_id')->nullable();
            $table->decimal('latitude')->nullable();
            $table->decimal('longitude')->nullable();
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('location');
    }
};
