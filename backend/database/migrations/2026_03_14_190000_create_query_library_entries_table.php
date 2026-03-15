<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('query_library_entries', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('domain')->index();
            $table->string('category')->index();
            $table->string('summary');
            $table->text('description')->nullable();
            $table->longText('sql_template');
            $table->json('parameters_json')->nullable();
            $table->json('tags_json')->nullable();
            $table->json('example_questions_json')->nullable();
            $table->string('template_language')->default('ohdsi_sql');
            $table->boolean('is_aggregate')->default(false);
            $table->string('safety')->default('safe');
            $table->string('source')->default('parthenon_curated');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('query_library_entries');
    }
};
