<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Replace (name, domain_id) unique index with (name, domain_id, parent_grouping_id)
     * to support HLGT sub-groupings that may share names across different parents.
     * Uses COALESCE to treat NULL parent_grouping_id as 0 for uniqueness.
     */
    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_clinical_groupings_name_domain');
        DB::statement('
            CREATE UNIQUE INDEX idx_clinical_groupings_name_domain
            ON app.clinical_groupings(name, domain_id, COALESCE(parent_grouping_id, 0))
        ');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_clinical_groupings_name_domain');
        DB::statement('CREATE UNIQUE INDEX idx_clinical_groupings_name_domain ON app.clinical_groupings(name, domain_id)');
    }
};
