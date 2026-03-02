<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('cdm')->hasTable('fact_relationship')) {
            return;
        }

        Schema::connection('cdm')->create('fact_relationship', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('domain_concept_id_1');
            $table->bigInteger('fact_id_1');
            $table->integer('domain_concept_id_2');
            $table->bigInteger('fact_id_2');
            $table->integer('relationship_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('cdm')->dropIfExists('fact_relationship');
    }
};
