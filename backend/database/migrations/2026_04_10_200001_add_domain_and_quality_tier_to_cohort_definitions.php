<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('domain', 50)->nullable()->after('share_expires_at')->index();
            $table->string('quality_tier', 20)->nullable()->after('domain')->index();
        });
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropIndex(['quality_tier']);
            $table->dropIndex(['domain']);
            $table->dropColumn(['quality_tier', 'domain']);
        });
    }
};
