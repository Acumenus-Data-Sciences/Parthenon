<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('app.aqueduct_runs');
        Schema::dropIfExists('app.aqueduct_sessions');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Intentionally empty — Aqueduct is permanently removed
    }
};
