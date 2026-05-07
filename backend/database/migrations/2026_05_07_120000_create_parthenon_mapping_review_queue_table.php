<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 Plan 7 Task 1 (T-024B): app.parthenon_mapping_review_queue.
 *
 * The reviewer queue that the Harmonia reviewer UI reads from. One row per
 * unmapped (source_code, source_vocab) pair surfaced from per-source unmapped
 * tables (Plan 5's lis_lab_source.unmapped_local_lab_code, Plan 1's
 * unmapped X12 codes, etc.) along with the top-K rerank candidates that
 * the Plan 6 ConceptMappingSuggesterNode (T-024A) produced.
 *
 * The reviewer reads (status='pending'), picks the right candidate, and
 * approve writes a row to app.parthenon_concept_map (Plan 6) and flips
 * this row's status to 'approved'. Reject and Escalate keep the queue
 * row but flip status; the row is never deleted so we have a full
 * provenance trail of every reviewer decision.
 *
 * Like app.parthenon_concept_map, omop_concept_id (when set) and
 * candidate_ranking_json's concept_ids are intentionally NOT FK-constrained
 * to vocab.concept — vocab.* is shared/read-only and reseeded via TRUNCATE,
 * so app.* FKs would break the reseed pipeline. App-layer validation in
 * the Form Request enforces standard_concept = 'S'.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.parthenon_mapping_review_queue (
                queue_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                source_code              TEXT NOT NULL,
                source_vocab             TEXT NOT NULL,
                source_text              TEXT,
                seen_count               INTEGER NOT NULL DEFAULT 1 CHECK (seen_count >= 1),
                candidate_ranking_json   JSONB NOT NULL,
                top1_confidence          NUMERIC(5, 4) NOT NULL CHECK (top1_confidence >= 0 AND top1_confidence <= 1),
                model_version            TEXT NOT NULL,
                status                   TEXT NOT NULL DEFAULT 'pending'
                                              CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
                approved_concept_id      BIGINT,
                approved_map_id          BIGINT,
                rejection_reason         TEXT,
                reviewer_id              BIGINT REFERENCES app.users(id),
                reviewed_at              TIMESTAMPTZ,
                escalated_at             TIMESTAMPTZ,
                created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (source_code, source_vocab)
            )
        SQL);

        DB::statement('CREATE INDEX idx_mapping_review_queue_status ON app.parthenon_mapping_review_queue (status)');
        DB::statement('CREATE INDEX idx_mapping_review_queue_vocab ON app.parthenon_mapping_review_queue (source_vocab)');
        DB::statement('CREATE INDEX idx_mapping_review_queue_confidence ON app.parthenon_mapping_review_queue (top1_confidence)');
        DB::statement('CREATE INDEX idx_mapping_review_queue_reviewer ON app.parthenon_mapping_review_queue (reviewer_id) WHERE reviewer_id IS NOT NULL');
        DB::statement('CREATE INDEX idx_mapping_review_queue_pending_oldest ON app.parthenon_mapping_review_queue (created_at) WHERE status = \'pending\'');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.parthenon_mapping_review_queue');
    }
};
