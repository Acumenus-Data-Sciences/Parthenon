<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis');
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis_topology');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS postgis_topology CASCADE');
        DB::statement('DROP EXTENSION IF EXISTS postgis CASCADE');
    }
};
