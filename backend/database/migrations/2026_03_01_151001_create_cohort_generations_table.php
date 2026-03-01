<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_generations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cohort_definition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources');
            $table->string('status')->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('person_count')->nullable();
            $table->text('fail_message')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_generations');
    }
};
