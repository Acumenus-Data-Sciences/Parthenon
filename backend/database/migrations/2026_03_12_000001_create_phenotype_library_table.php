<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phenotype_library', function (Blueprint $table) {
            $table->id();
            $table->integer('cohort_id')->unique()->comment('OHDSI PhenotypeLibrary cohort ID');
            $table->string('cohort_name', 500);
            $table->text('description')->nullable();
            $table->json('expression_json')->nullable()->comment('CIRCE cohort definition JSON');
            $table->string('logic_description', 2000)->nullable();
            $table->json('tags')->nullable();
            $table->string('domain', 100)->nullable();
            $table->string('severity', 100)->nullable();
            $table->boolean('is_imported')->default(false)->comment('Whether imported to local cohort definitions');
            $table->unsignedBigInteger('imported_cohort_id')->nullable()->comment('Local cohort definition ID if imported');
            $table->timestamps();

            $table->index('domain');
            $table->index('is_imported');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phenotype_library');
    }
};
