<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dq_sla_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('app.sources')->cascadeOnDelete();
            $table->string('category', 100);
            $table->decimal('min_pass_rate', 5, 2)->default(80.00);
            $table->timestamps();
            $table->unique(['source_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dq_sla_targets');
    }
};
