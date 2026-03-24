<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('release_key');
            $table->string('release_name');
            $table->string('release_type', 20);
            $table->string('cdm_version', 20)->nullable();
            $table->string('vocabulary_version', 100)->nullable();
            $table->string('etl_version', 100)->nullable();
            $table->bigInteger('person_count')->default(0);
            $table->bigInteger('record_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['source_id', 'release_key']);
            $table->index(['source_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_releases');
    }
};
