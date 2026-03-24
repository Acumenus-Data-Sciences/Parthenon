<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('achilles_runs', function (Blueprint $table) {
            $table->foreignId('release_id')->nullable()->constrained('source_releases')->nullOnDelete();
        });

        Schema::table('dqd_results', function (Blueprint $table) {
            $table->foreignId('release_id')->nullable()->constrained('source_releases')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('dqd_results', function (Blueprint $table) {
            $table->dropConstrainedForeignId('release_id');
        });

        Schema::table('achilles_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('release_id');
        });
    }
};
