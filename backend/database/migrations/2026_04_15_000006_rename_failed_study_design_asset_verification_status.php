<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('study_design_assets')
            ->where('verification_status', 'failed')
            ->update(['verification_status' => 'blocked']);
    }

    public function down(): void
    {
        DB::table('study_design_assets')
            ->where('verification_status', 'blocked')
            ->update(['verification_status' => 'failed']);
    }
};
