<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_heel_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id')->index();
            $table->integer('rule_id');
            $table->string('rule_name');
            $table->string('severity', 20); // error, warning, notification
            $table->bigInteger('record_count')->default(0);
            $table->string('attribute_name', 255)->nullable();
            $table->text('attribute_value')->nullable();
            $table->timestamps();

            $table->index(['source_id', 'severity']);
            $table->index(['source_id', 'rule_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_heel_results');
    }
};
