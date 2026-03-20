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
        Schema::table('finngen_runs', function (Blueprint $table) {
            $table->foreignId('investigation_id')->nullable()->constrained('investigations')->nullOnDelete();
            $table->index('investigation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('finngen_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('investigation_id');
        });
    }
};
