<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('note')) {
            return;
        }

        Schema::connection('omop')->create('note', function (Blueprint $table) {
            $table->bigInteger('note_id')->primary();
            $table->bigInteger('person_id');
            $table->date('note_date');
            $table->timestamp('note_datetime')->nullable();
            $table->integer('note_type_concept_id');
            $table->integer('note_class_concept_id');
            $table->string('note_title', 250)->nullable();
            $table->text('note_text');
            $table->integer('encoding_concept_id');
            $table->integer('language_concept_id');
            $table->bigInteger('provider_id')->nullable();
            $table->bigInteger('visit_occurrence_id')->nullable();
            $table->bigInteger('visit_detail_id')->nullable();
            $table->string('note_source_value', 50)->nullable();
            $table->bigInteger('note_event_id')->nullable();
            $table->integer('note_event_field_concept_id')->default(0);
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('note');
    }
};
