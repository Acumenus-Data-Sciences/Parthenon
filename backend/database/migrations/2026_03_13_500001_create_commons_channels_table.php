<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->string('type', 20)->default('topic');
            $table->string('visibility', 20)->default('public');
            $table->foreignId('study_id')->nullable()->constrained('studies')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index('type');
        });

        DB::statement('CREATE INDEX idx_channels_study ON commons_channels (study_id) WHERE study_id IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_channels');
    }
};
