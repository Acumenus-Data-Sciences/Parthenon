<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feasibility_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->string('description', 1000)->nullable();
            $table->json('criteria');
            $table->foreignId('created_by')->constrained('app.users');
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feasibility_templates');
    }
};
