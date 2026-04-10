<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('similarity_dimensions')->insert([
            'key' => 'temporal',
            'name' => 'Temporal Trajectory',
            'default_weight' => 0.8,
            'description' => 'Lab trajectory similarity using Dynamic Time Warping — compares shape of lab value changes over time',
            'config' => json_encode(['max_days' => 730, 'requires_ai_service' => true]),
            'is_active' => true,
        ]);
    }

    public function down(): void
    {
        DB::table('similarity_dimensions')->where('key', 'temporal')->delete();
    }
};
