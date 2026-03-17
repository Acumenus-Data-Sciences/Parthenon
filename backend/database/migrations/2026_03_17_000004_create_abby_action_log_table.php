<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE app.abby_action_log (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES app.users(id),
                action_type VARCHAR(50) NOT NULL,
                tool_name VARCHAR(100) NOT NULL,
                risk_level VARCHAR(10) NOT NULL,
                plan JSONB,
                parameters JSONB,
                result JSONB,
                checkpoint_data JSONB,
                rolled_back BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ');
        DB::statement('CREATE INDEX idx_abby_action_log_user_id ON app.abby_action_log (user_id)');
        DB::statement('CREATE INDEX idx_abby_action_log_created_at ON app.abby_action_log (created_at)');
        DB::statement('CREATE INDEX idx_abby_action_log_tool_name ON app.abby_action_log (tool_name)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.abby_action_log');
    }
};
