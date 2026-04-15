<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oidc_email_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('alias_email', 255)->unique();
            $table->string('canonical_email', 255);
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->index('canonical_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oidc_email_aliases');
    }
};
