<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE evidence_pins ADD COLUMN concept_ids integer[] DEFAULT '{}'");
        DB::statement("ALTER TABLE evidence_pins ADD COLUMN gene_symbols varchar[] DEFAULT '{}'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('evidence_pins', function (Blueprint $table) {
            $table->dropColumn(['concept_ids', 'gene_symbols']);
        });
    }
};
