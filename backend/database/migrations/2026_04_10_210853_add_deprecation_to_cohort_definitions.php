<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->timestamp('deprecated_at')->nullable()->after('quality_tier');
            $table->unsignedBigInteger('superseded_by')->nullable()->after('deprecated_at');

            $table->index('deprecated_at');
            $table->foreign('superseded_by')
                ->references('id')
                ->on('cohort_definitions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropForeign(['superseded_by']);
            $table->dropIndex(['deprecated_at']);
            $table->dropColumn(['deprecated_at', 'superseded_by']);
        });
    }
};
