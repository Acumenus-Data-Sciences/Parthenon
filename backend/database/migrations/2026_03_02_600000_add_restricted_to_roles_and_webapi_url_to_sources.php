<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            $table->jsonb('restricted_to_roles')->nullable()->after('is_cache_enabled');
            $table->string('imported_from_webapi')->nullable()->after('restricted_to_roles');
        });
    }

    public function down(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            $table->dropColumn(['restricted_to_roles', 'imported_from_webapi']);
        });
    }
};
