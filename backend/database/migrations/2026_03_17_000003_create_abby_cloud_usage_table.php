<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE app.abby_cloud_usage (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES app.users(id),
                department VARCHAR(100),
                tokens_in INTEGER NOT NULL,
                tokens_out INTEGER NOT NULL,
                cost_usd DECIMAL(10,6) NOT NULL,
                model VARCHAR(100) NOT NULL,
                request_hash VARCHAR(64),
                sanitizer_redaction_count INTEGER DEFAULT 0,
                route_reason VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW()
            )
        ");
        DB::statement('CREATE INDEX idx_abby_cloud_usage_user_id ON app.abby_cloud_usage (user_id)');
        DB::statement('CREATE INDEX idx_abby_cloud_usage_created_at ON app.abby_cloud_usage (created_at)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.abby_cloud_usage');
    }
};
