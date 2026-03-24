<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chart_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('chart_type', 50);
            $table->jsonb('chart_context')->default('{}');
            $table->string('x_value', 100);
            $table->float('y_value')->nullable();
            $table->text('annotation_text');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->index(['chart_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chart_annotations');
    }
};
