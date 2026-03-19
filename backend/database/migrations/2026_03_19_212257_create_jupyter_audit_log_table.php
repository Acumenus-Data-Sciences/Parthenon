<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jupyter_audit_log', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('event', 50);
            $table->jsonb('metadata')->default('{}');
            $table->ipAddress('ip_address')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index('user_id', 'idx_jupyter_audit_user');
            $table->index('event', 'idx_jupyter_audit_event');
            $table->index('created_at', 'idx_jupyter_audit_created');
        });

        DB::statement("COMMENT ON COLUMN app.jupyter_audit_log.user_id IS 'NULL for unauthenticated events (auth.failure)'");
    }

    public function down(): void
    {
        Schema::dropIfExists('jupyter_audit_log');
    }
};
