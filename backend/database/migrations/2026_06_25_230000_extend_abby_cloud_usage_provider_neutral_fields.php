<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE app.abby_cloud_usage ALTER COLUMN model TYPE VARCHAR(200)');
        DB::statement('ALTER TABLE app.abby_cloud_usage ALTER COLUMN route_reason TYPE VARCHAR(100)');
        DB::statement("ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'anthropic'");
        DB::statement('ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS transport VARCHAR(80)');
        DB::statement('ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS provider_profile_id VARCHAR(100)');
        DB::statement("ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS entitlement_type VARCHAR(80) NOT NULL DEFAULT 'org_api_key'");
        DB::statement("ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS request_surface VARCHAR(80) NOT NULL DEFAULT 'abby_chat'");
        DB::statement("ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'success'");
        DB::statement('ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS error_class VARCHAR(80)');
        DB::statement('ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS fallback_reason VARCHAR(100)');
        DB::statement('ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS response_latency_ms DOUBLE PRECISION');
        DB::statement("ALTER TABLE app.abby_cloud_usage ADD COLUMN IF NOT EXISTS usage_metadata JSONB NOT NULL DEFAULT '{}'::jsonb");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_cloud_usage_provider_created_at ON app.abby_cloud_usage (provider, created_at)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_cloud_usage_status_created_at ON app.abby_cloud_usage (status, created_at)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_abby_cloud_usage_profile_created_at ON app.abby_cloud_usage (provider_profile_id, created_at)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_abby_cloud_usage_profile_created_at');
        DB::statement('DROP INDEX IF EXISTS app.idx_abby_cloud_usage_status_created_at');
        DB::statement('DROP INDEX IF EXISTS app.idx_abby_cloud_usage_provider_created_at');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS usage_metadata');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS response_latency_ms');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS fallback_reason');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS error_class');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS status');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS request_surface');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS entitlement_type');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS provider_profile_id');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS transport');
        DB::statement('ALTER TABLE app.abby_cloud_usage DROP COLUMN IF EXISTS provider');
    }
};
