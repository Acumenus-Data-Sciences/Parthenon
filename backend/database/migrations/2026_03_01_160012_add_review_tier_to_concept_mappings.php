<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_mappings', function (Blueprint $table) {
            $table->string('review_tier', 20)->nullable();
            $table->index('review_tier');
        });
    }

    public function down(): void
    {
        Schema::table('concept_mappings', function (Blueprint $table) {
            $table->dropIndex(['review_tier']);
            $table->dropColumn('review_tier');
        });
    }
};
