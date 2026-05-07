<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 Plan 6 Task 10 (T-024A): app.parthenon_concept_map.
 *
 * Persists reviewer-approved or auto-approved concept mappings produced by
 * the commercial-tier ai_assisted_mapping backend (T-024A). Downstream
 * templates read this table to translate local source codes to OMOP
 * standard concepts without re-running the rerank pipeline.
 *
 * The table lives in `app.*` (cross-tier touch) so the Laravel backend
 * (Plan 7's reviewer UI) can read/write through the same migration runner
 * that owns auth/RBAC/Spatie permissions. Templates SQL stages must NOT
 * write here; only the MappingReviewQueueNode (Task 11) does, and it
 * goes through the same DB connection the Laravel backend owns.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.parthenon_concept_map (
                map_id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                source_code              TEXT NOT NULL,
                source_vocab             TEXT NOT NULL,
                source_text              TEXT,
                omop_concept_id          BIGINT NOT NULL REFERENCES vocab.concept(concept_id),
                confidence               NUMERIC(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
                reviewer_id              BIGINT REFERENCES app.users(id),
                reviewed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                model_version            TEXT NOT NULL,
                candidate_ranking_json   JSONB NOT NULL,
                UNIQUE (source_code, source_vocab)
            )
        SQL);

        DB::statement('CREATE INDEX idx_parthenon_concept_map_omop ON app.parthenon_concept_map (omop_concept_id)');
        DB::statement('CREATE INDEX idx_parthenon_concept_map_vocab ON app.parthenon_concept_map (source_vocab)');
        DB::statement('CREATE INDEX idx_parthenon_concept_map_reviewer ON app.parthenon_concept_map (reviewer_id) WHERE reviewer_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.parthenon_concept_map');
    }
};
