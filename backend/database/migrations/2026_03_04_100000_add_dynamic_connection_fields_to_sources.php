<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            // Dynamic connection fields — replaces the need to edit config/database.php
            $table->string('db_host', 512)->nullable()->after('source_connection');
            $table->unsignedSmallInteger('db_port')->nullable()->after('db_host');
            $table->string('db_database', 255)->nullable()->after('db_port');
            // Dialect-specific extras: warehouse, role, account, sslmode, etc. (AES encrypted)
            $table->text('db_options')->nullable()->after('db_database');

            // source_connection is now optional when db_host is provided
            $table->text('source_connection')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            $table->dropColumn(['db_host', 'db_port', 'db_database', 'db_options']);
            $table->text('source_connection')->nullable(false)->change();
        });
    }
};
