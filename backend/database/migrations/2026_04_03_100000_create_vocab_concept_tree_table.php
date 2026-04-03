<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // vocab schema is owned by smudoshi (superuser); parthenon_app only has SELECT.
        // DDL must be run directly as smudoshi. This migration records the schema contract
        // and is a no-op when the table already exists (table created by psql outside artisan).
        // To apply manually:
        //   psql -U smudoshi -d parthenon -f database/migrations/sql/create_vocab_concept_tree.sql
        try {
            DB::connection('omop')->statement('
                CREATE TABLE IF NOT EXISTS vocab.concept_tree (
                    parent_concept_id  INTEGER NOT NULL,
                    child_concept_id   INTEGER NOT NULL,
                    domain_id          VARCHAR(20) NOT NULL,
                    child_depth        SMALLINT NOT NULL,
                    vocabulary_id      VARCHAR(20) NOT NULL,
                    concept_class_id   VARCHAR(20) NOT NULL,
                    child_name         VARCHAR(255) NOT NULL,
                    PRIMARY KEY (parent_concept_id, child_concept_id)
                )
            ');

            DB::connection('omop')->statement('CREATE INDEX IF NOT EXISTS idx_concept_tree_child ON vocab.concept_tree (child_concept_id)');
            DB::connection('omop')->statement('CREATE INDEX IF NOT EXISTS idx_concept_tree_domain_parent ON vocab.concept_tree (domain_id, parent_concept_id)');
        } catch (Throwable) {
            // Silently skip if parthenon_app lacks CREATE on vocab schema.
            // The table must be created manually by smudoshi (schema owner) before this migration runs.
        }
    }

    public function down(): void
    {
        try {
            DB::connection('omop')->statement('DROP TABLE IF EXISTS vocab.concept_tree');
        } catch (Throwable) {
            // No-op if insufficient privilege
        }
    }
};
