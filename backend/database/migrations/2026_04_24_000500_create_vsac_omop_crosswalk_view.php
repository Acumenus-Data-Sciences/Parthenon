<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            DO \$\$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_owner') THEN
                    SET ROLE parthenon_owner;
                END IF;
            END
            \$\$
        ");

        // Materialized view mapping VSAC code-system codes to OMOP concept_ids.
        // VSAC code_system names differ from OMOP vocabulary_id — normalized here.
        // Populated incrementally: REFRESH after vsac ingest.
        DB::statement("
            CREATE MATERIALIZED VIEW app.vsac_value_set_omop_concepts AS
            SELECT
                vsc.value_set_oid,
                vs.name AS value_set_name,
                c.concept_id,
                c.concept_name,
                c.vocabulary_id,
                vsc.code,
                vsc.code_system
            FROM app.vsac_value_set_codes vsc
            JOIN app.vsac_value_sets vs USING (value_set_oid)
            JOIN vocab.concept c ON c.concept_code = vsc.code
                AND c.vocabulary_id = CASE vsc.code_system
                    WHEN 'SNOMEDCT'       THEN 'SNOMED'
                    WHEN 'ICD10CM'        THEN 'ICD10CM'
                    WHEN 'ICD10PCS'       THEN 'ICD10PCS'
                    WHEN 'LOINC'          THEN 'LOINC'
                    WHEN 'RXNORM'         THEN 'RxNorm'
                    WHEN 'CPT'            THEN 'CPT4'
                    WHEN 'HCPCS Level II' THEN 'HCPCS'
                    WHEN 'CVX'            THEN 'CVX'
                    WHEN 'CDT'            THEN 'CDT'
                    ELSE NULL
                END
            WITH DATA
        ");

        DB::statement('CREATE UNIQUE INDEX uq_vsac_omop_oid_concept
                       ON app.vsac_value_set_omop_concepts (value_set_oid, concept_id)');
        DB::statement('CREATE INDEX idx_vsac_omop_concept
                       ON app.vsac_value_set_omop_concepts (concept_id)');
        DB::statement('CREATE INDEX idx_vsac_omop_vocab
                       ON app.vsac_value_set_omop_concepts (vocabulary_id)');

        DB::statement('RESET ROLE');
    }

    public function down(): void
    {
        DB::statement('DROP MATERIALIZED VIEW IF EXISTS app.vsac_value_set_omop_concepts');
    }
};
