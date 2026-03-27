<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('default_source_id')->nullable()->after('workbench_mode');

            $table->foreign('default_source_id')
                ->references('id')
                ->on('sources')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_source_id']);
            $table->dropColumn('default_source_id');
        });
    }
};
