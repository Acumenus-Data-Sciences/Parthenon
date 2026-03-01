<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->string('analysis_type');
            $table->unsignedBigInteger('analysis_id');
            $table->timestamps();

            $table->index(['analysis_type', 'analysis_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_analyses');
    }
};
