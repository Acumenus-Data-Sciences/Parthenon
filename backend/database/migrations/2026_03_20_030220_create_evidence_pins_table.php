<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('evidence_pins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investigation_id')->constrained('investigations')->cascadeOnDelete();
            $table->string('domain', 20);
            $table->string('section', 40);
            $table->string('finding_type', 40);
            $table->jsonb('finding_payload');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_key_finding')->default(false);
            $table->text('narrative_before')->nullable();
            $table->text('narrative_after')->nullable();
            $table->timestamps();

            $table->index('investigation_id');
            $table->index(['investigation_id', 'domain']);
            $table->index(['investigation_id', 'section']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('evidence_pins');
    }
};
