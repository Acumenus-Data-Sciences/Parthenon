<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('vocab')->create('concept_relationships', function (Blueprint $table) {
            $table->integer('concept_id_1');
            $table->integer('concept_id_2');
            $table->string('relationship_id', 20);
            $table->date('valid_start_date');
            $table->date('valid_end_date');
            $table->string('invalid_reason', 1)->nullable();

            $table->primary(['concept_id_1', 'concept_id_2', 'relationship_id']);
        });
    }

    public function down(): void
    {
        Schema::connection('vocab')->dropIfExists('concept_relationships');
    }
};
