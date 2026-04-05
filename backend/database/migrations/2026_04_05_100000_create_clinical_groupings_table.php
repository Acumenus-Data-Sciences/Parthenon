<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE IF NOT EXISTS app.clinical_groupings (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                domain_id VARCHAR(20) NOT NULL,
                anchor_concept_ids INTEGER[] NOT NULL DEFAULT '{}',
                sort_order INTEGER DEFAULT 0,
                icon VARCHAR(50),
                color VARCHAR(7),
                parent_grouping_id INTEGER REFERENCES app.clinical_groupings(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_clinical_groupings_domain ON app.clinical_groupings(domain_id)');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_groupings_name_domain ON app.clinical_groupings(name, domain_id)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.clinical_groupings CASCADE');
    }
};
