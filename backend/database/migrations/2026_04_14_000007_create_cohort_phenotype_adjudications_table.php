<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cohort_phenotype_adjudications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('validation_id')->constrained('cohort_phenotype_validations')->cascadeOnDelete();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->string('sample_type', 40)->default('cohort_member');
            $table->string('label', 40)->nullable();
            $table->string('status', 40)->default('pending');
            $table->text('notes')->nullable();
            $table->jsonb('payload_json')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['validation_id', 'sample_type']);
            $table->index(['validation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cohort_phenotype_adjudications');
    }
};
