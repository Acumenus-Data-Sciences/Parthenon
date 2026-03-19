<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::connection('omop')->hasTable('domain')) {
            return;
        }

        Schema::connection('omop')->create('domain', function (Blueprint $table) {
            $table->string('domain_id', 20)->primary();
            $table->string('domain_name', 255);
            $table->integer('domain_concept_id');
        });
    }

    public function down(): void
    {
        Schema::connection('omop')->dropIfExists('domain');
    }
};
