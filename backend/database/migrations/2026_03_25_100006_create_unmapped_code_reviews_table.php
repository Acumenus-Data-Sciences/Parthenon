<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unmapped_code_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('app.sources')->cascadeOnDelete();
            $table->string('source_code', 255);
            $table->string('source_vocabulary_id', 50);
            $table->string('status', 30)->default('pending');
            $table->text('notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('app.users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unmapped_code_reviews');
    }
};
