<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE TABLE app.abby_knowledge_artifacts (
                id BIGSERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(500) NOT NULL,
                summary TEXT,
                tags TEXT[],
                disease_area VARCHAR(100),
                study_design VARCHAR(50),
                created_by BIGINT REFERENCES app.users(id),
                source_conversation_id BIGINT,
                artifact_data JSONB,
                embedding vector(384),
                usage_count INT DEFAULT 0,
                accuracy_score DECIMAL(3,2),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        ");
        DB::statement('CREATE INDEX idx_abby_knowledge_artifacts_type ON app.abby_knowledge_artifacts (type)');
        DB::statement('CREATE INDEX idx_abby_knowledge_artifacts_disease_area ON app.abby_knowledge_artifacts (disease_area)');
        DB::statement('CREATE INDEX idx_abby_knowledge_artifacts_status ON app.abby_knowledge_artifacts (status)');
        DB::statement('CREATE INDEX idx_abby_knowledge_artifacts_created_by ON app.abby_knowledge_artifacts (created_by)');
        DB::statement('CREATE INDEX idx_abby_knowledge_artifacts_embedding ON app.abby_knowledge_artifacts USING hnsw (embedding vector_cosine_ops)');

        DB::statement('
            CREATE TABLE app.abby_corrections (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES app.users(id),
                original_response TEXT NOT NULL,
                correction TEXT NOT NULL,
                context JSONB,
                applied_globally BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ');
        DB::statement('CREATE INDEX idx_abby_corrections_user_id ON app.abby_corrections (user_id)');
        DB::statement('CREATE INDEX idx_abby_corrections_applied_globally ON app.abby_corrections (applied_globally)');

        DB::statement("
            CREATE TABLE app.abby_data_findings (
                id BIGSERIAL PRIMARY KEY,
                discovered_by BIGINT REFERENCES app.users(id),
                affected_domain VARCHAR(100),
                affected_tables TEXT[],
                finding_summary TEXT NOT NULL,
                severity VARCHAR(20) DEFAULT 'info',
                workaround TEXT,
                verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ");
        DB::statement('CREATE INDEX idx_abby_data_findings_discovered_by ON app.abby_data_findings (discovered_by)');
        DB::statement('CREATE INDEX idx_abby_data_findings_severity ON app.abby_data_findings (severity)');
        DB::statement('CREATE INDEX idx_abby_data_findings_verified ON app.abby_data_findings (verified)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.abby_data_findings');
        DB::statement('DROP TABLE IF EXISTS app.abby_corrections');
        DB::statement('DROP TABLE IF EXISTS app.abby_knowledge_artifacts');
    }
};
