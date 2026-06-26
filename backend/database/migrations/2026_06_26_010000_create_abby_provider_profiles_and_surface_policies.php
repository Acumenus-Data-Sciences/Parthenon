<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abby_provider_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('profile_id', 100)->unique();
            $table->string('display_name', 120);
            $table->string('provider_type', 50);
            $table->string('transport', 80);
            $table->string('entitlement_type', 80)->default('local');
            $table->string('model', 200)->default('');
            $table->string('base_url', 500)->nullable();
            $table->string('provider_setting_type', 50)->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->jsonb('capabilities')->nullable();
            $table->jsonb('safety')->nullable();
            $table->jsonb('limits')->nullable();
            $table->jsonb('fallback_profile_ids')->nullable();
            $table->jsonb('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['provider_type', 'transport']);
            $table->index('is_enabled');
        });

        Schema::create('abby_surface_policies', function (Blueprint $table) {
            $table->id();
            $table->string('surface', 80)->unique();
            $table->string('provider_mode', 40)->default('local_only');
            $table->string('default_profile_id', 100)->nullable();
            $table->jsonb('fallback_profile_ids')->nullable();
            $table->boolean('never_send_phi_to_cloud')->default(true);
            $table->boolean('allow_cloud')->default(false);
            $table->jsonb('required_capabilities')->nullable();
            $table->jsonb('settings')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['surface', 'provider_mode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abby_surface_policies');
        Schema::dropIfExists('abby_provider_profiles');
    }
};
