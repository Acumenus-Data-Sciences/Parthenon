<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gis_datasets', function (Blueprint $table) {
            $table->tinyInteger('progress_percentage')->default(0);
            $table->text('log_output')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->json('levels_requested')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->foreign('user_id')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::table('gis_datasets', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn([
                'progress_percentage',
                'log_output',
                'user_id',
                'levels_requested',
                'started_at',
                'completed_at',
            ]);
        });
    }
};
