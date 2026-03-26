<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('etl_projects', function (Blueprint $table) {
            $table->unsignedBigInteger('source_id')->nullable()->change();
            $table->unsignedBigInteger('scan_profile_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('etl_projects', function (Blueprint $table) {
            $table->unsignedBigInteger('source_id')->nullable(false)->change();
            $table->unsignedBigInteger('scan_profile_id')->nullable(false)->change();
        });
    }
};
