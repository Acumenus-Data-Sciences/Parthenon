<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_daimons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('daimon_type');
            $table->string('table_qualifier');
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->unique(['source_id', 'daimon_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_daimons');
    }
};
