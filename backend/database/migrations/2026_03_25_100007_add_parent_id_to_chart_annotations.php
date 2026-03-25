<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('tag')
                ->constrained('app.chart_annotations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
