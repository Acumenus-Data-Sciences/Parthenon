<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        try {
            DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');
        } catch (\Throwable $e) {
            Log::warning('PostGIS extension could not be enabled: '.$e->getMessage());
        }
    }

    public function down(): void
    {
        try {
            DB::statement('DROP EXTENSION IF EXISTS postgis CASCADE');
        } catch (\Throwable $e) {
            Log::warning('PostGIS extension could not be dropped: '.$e->getMessage());
        }
    }
};
