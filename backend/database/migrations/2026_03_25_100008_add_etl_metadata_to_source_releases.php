<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('source_releases', function (Blueprint $table) {
            $table->json('etl_metadata')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('source_releases', function (Blueprint $table) {
            $table->dropColumn('etl_metadata');
        });
    }
};
