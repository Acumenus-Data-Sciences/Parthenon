<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_history', function (Blueprint $table) {
            $table->id('location_history_id');
            $table->bigInteger('entity_id');
            $table->string('domain_id', 50);
            $table->bigInteger('location_id');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->bigInteger('relationship_type_concept_id')->nullable();
            $table->timestamps();

            $table->index(['entity_id', 'domain_id']);
            $table->index('location_id');
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_history');
    }
};
