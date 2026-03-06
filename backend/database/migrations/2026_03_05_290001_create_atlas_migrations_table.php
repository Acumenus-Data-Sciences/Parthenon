<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('atlas_migrations', function (Blueprint $table) {
            $table->id();
            $table->string('webapi_url');
            $table->string('webapi_name')->nullable();
            $table->string('auth_type')->default('none');
            $table->text('auth_credentials')->nullable();
            $table->string('status')->default('pending');
            $table->json('selected_entities')->nullable();
            $table->json('discovery_results')->nullable();
            $table->json('import_results')->nullable();
            $table->json('validation_results')->nullable();
            $table->string('current_step')->nullable();
            $table->unsignedInteger('total_entities')->default(0);
            $table->unsignedInteger('imported_entities')->default(0);
            $table->unsignedInteger('failed_entities')->default(0);
            $table->unsignedInteger('skipped_entities')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('atlas_id_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('migration_id')->constrained('atlas_migrations')->cascadeOnDelete();
            $table->string('entity_type');
            $table->unsignedInteger('atlas_id');
            $table->unsignedInteger('parthenon_id')->nullable();
            $table->string('atlas_name');
            $table->string('status')->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['migration_id', 'entity_type', 'atlas_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('atlas_id_mappings');
        Schema::dropIfExists('atlas_migrations');
    }
};
