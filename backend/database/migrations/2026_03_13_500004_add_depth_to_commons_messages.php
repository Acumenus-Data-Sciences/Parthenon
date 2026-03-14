<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commons_messages', function (Blueprint $table) {
            $table->tinyInteger('depth')->default(0)->after('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('commons_messages', function (Blueprint $table) {
            $table->dropColumn('depth');
        });
    }
};
