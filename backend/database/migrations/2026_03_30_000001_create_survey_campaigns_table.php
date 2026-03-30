<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('survey_campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('survey_instrument_id')->constrained('survey_instruments')->cascadeOnDelete();
            $table->unsignedBigInteger('cohort_generation_id')->nullable();
            $table->string('status', 20)->default('draft');
            $table->string('publish_token', 64)->nullable()->unique();
            $table->text('description')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('survey_instrument_id');
        });

        Schema::table('survey_conduct', function (Blueprint $table) {
            $table->foreignId('campaign_id')->nullable()->constrained('survey_campaigns')->nullOnDelete();
        });

        Schema::table('survey_conduct', function (Blueprint $table) {
            $table->unsignedBigInteger('person_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('survey_conduct', function (Blueprint $table) {
            $table->unsignedBigInteger('person_id')->nullable(false)->change();
            $table->dropConstrainedForeignId('campaign_id');
        });

        Schema::dropIfExists('survey_campaigns');
    }
};
