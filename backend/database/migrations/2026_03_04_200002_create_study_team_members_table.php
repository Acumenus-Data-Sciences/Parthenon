<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_team_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 50); // principal_investigator, co_investigator, data_scientist, etc.
            $table->foreignId('site_id')->nullable()->constrained('study_sites')->nullOnDelete();
            $table->jsonb('permissions')->nullable();
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('left_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['study_id', 'user_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_team_members');
    }
};
