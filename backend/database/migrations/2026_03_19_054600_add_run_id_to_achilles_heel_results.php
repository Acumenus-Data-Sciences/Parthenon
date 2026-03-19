<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('achilles_heel_results', function (Blueprint $table) {
            $table->uuid('run_id')->nullable()->after('source_id');
            $table->index('run_id');
            $table->index(['run_id', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::table('achilles_heel_results', function (Blueprint $table) {
            $table->dropIndex(['run_id', 'severity']);
            $table->dropIndex(['run_id']);
            $table->dropColumn('run_id');
        });
    }
};
