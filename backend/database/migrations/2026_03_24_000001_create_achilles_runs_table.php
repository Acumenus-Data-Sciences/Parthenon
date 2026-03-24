<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->uuid('run_id')->unique();
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('total_analyses')->default(0);
            $table->unsignedInteger('completed_analyses')->default(0);
            $table->unsignedInteger('failed_analyses')->default(0);
            $table->json('categories')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['source_id', 'created_at']);
            $table->index('run_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_runs');
    }
};
