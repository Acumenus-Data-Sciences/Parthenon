<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('unmapped_source_codes', function (Blueprint $table) {
            $table->integer('patient_count')->default(0)->after('record_count');
        });
    }

    public function down(): void
    {
        Schema::table('unmapped_source_codes', function (Blueprint $table) {
            $table->dropColumn('patient_count');
        });
    }
};
