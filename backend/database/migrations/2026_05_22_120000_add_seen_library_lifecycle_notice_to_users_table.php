<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase D · Task D9 — one-time library-lifecycle notice flag.
 *
 * Additive boolean on app.users (mirrors onboarding_completed). The frontend
 * shows an introductory toast about the new Draft/Active/Archived lifecycle
 * exactly once per user; this flag persists that acknowledgement server-side.
 *
 * The users table is owned by parthenon_owner and parthenon_migrator is a
 * member of that role, so ALTER TABLE ... ADD COLUMN needs no ownership/grant
 * fix — the new column inherits the table's existing grants.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('seen_library_lifecycle_notice')
                ->default(false)
                ->after('onboarding_completed');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('seen_library_lifecycle_notice');
        });
    }
};
