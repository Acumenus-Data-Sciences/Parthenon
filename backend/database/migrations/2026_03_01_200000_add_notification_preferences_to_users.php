<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('notification_email')->default(true)->after('last_login_at');
            $table->boolean('notification_sms')->default(false)->after('notification_email');
            $table->string('phone_number')->nullable()->after('notification_sms');
            $table->json('notification_preferences')->nullable()->after('phone_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'notification_email',
                'notification_sms',
                'phone_number',
                'notification_preferences',
            ]);
        });
    }
};
