<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Use raw SQL to match spec exactly: TEXT[] for research_interests, JSONB for others
        DB::statement("
            CREATE TABLE app.abby_user_profiles (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE REFERENCES app.users(id) ON DELETE CASCADE,
                research_interests TEXT[] DEFAULT '{}',
                expertise_domains JSONB DEFAULT '{}',
                interaction_preferences JSONB DEFAULT '{}',
                frequently_used JSONB DEFAULT '{}',
                learned_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ");
        DB::statement('CREATE INDEX idx_abby_user_profiles_user_id ON app.abby_user_profiles (user_id)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.abby_user_profiles');
    }
};
