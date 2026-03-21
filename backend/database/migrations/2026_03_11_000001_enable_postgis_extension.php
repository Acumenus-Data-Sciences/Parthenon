<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        // Use a savepoint so a failed CREATE EXTENSION doesn't abort the
        // outer migration transaction (PostGIS may not be installed in CI).
        try {
            DB::unprepared('SAVEPOINT postgis_check');
            DB::unprepared('CREATE EXTENSION IF NOT EXISTS postgis');
            DB::unprepared('RELEASE SAVEPOINT postgis_check');
        } catch (Throwable $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT postgis_check');
            Log::warning('PostGIS extension could not be enabled: '.$e->getMessage());
        }
    }

    public function down(): void
    {
        try {
            DB::unprepared('SAVEPOINT postgis_drop');
            DB::unprepared('DROP EXTENSION IF EXISTS postgis CASCADE');
            DB::unprepared('RELEASE SAVEPOINT postgis_drop');
        } catch (Throwable $e) {
            DB::unprepared('ROLLBACK TO SAVEPOINT postgis_drop');
            Log::warning('PostGIS extension could not be dropped: '.$e->getMessage());
        }
    }
};
