<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auth_provider_settings', function (Blueprint $table) {
            $table->id();
            $table->string('provider_type')->unique(); // ldap | oauth2 | saml2 | oidc
            $table->string('display_name');
            $table->boolean('is_enabled')->default(false);
            $table->integer('priority')->default(0);
            $table->text('settings')->nullable(); // encrypted:array cast stores base64, not JSON
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_provider_settings');
    }
};
