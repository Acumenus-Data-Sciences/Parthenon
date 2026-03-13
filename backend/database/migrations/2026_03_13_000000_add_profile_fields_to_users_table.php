<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('job_title', 100)->nullable()->after('phone_number');
            $table->string('department', 100)->nullable()->after('job_title');
            $table->string('organization', 150)->nullable()->after('department');
            $table->text('bio')->nullable()->after('organization');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['job_title', 'department', 'organization', 'bio']);
        });
    }
};
