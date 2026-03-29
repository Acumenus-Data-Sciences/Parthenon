-- poseidon/dbt/macros/concept_lookup.sql
-- Look up a standard OMOP concept_id by source code and vocabulary.
-- Usage: {{ concept_lookup('src.diagnosis_code', 'ICD10CM') }}
-- source_only=true returns the source concept_id without following Maps to relationships.
{% macro concept_lookup(source_code_expr, source_vocabulary_id, source_only=false) %}
    (
        SELECT
            {% if source_only %}
                sc.concept_id
            {% else %}
                COALESCE(tc.concept_id, 0)
            {% endif %}
        FROM {{ var('vocab_schema', 'vocab') }}.concept sc
        {% if not source_only %}
        LEFT JOIN {{ var('vocab_schema', 'vocab') }}.concept_relationship cr
            ON cr.concept_id_1 = sc.concept_id
            AND cr.relationship_id = 'Maps to'
            AND cr.invalid_reason IS NULL
        LEFT JOIN {{ var('vocab_schema', 'vocab') }}.concept tc
            ON tc.concept_id = cr.concept_id_2
            AND tc.standard_concept = 'S'
            AND tc.invalid_reason IS NULL
        {% endif %}
        WHERE sc.concept_code = {{ source_code_expr }}
            AND sc.vocabulary_id = '{{ source_vocabulary_id }}'
            AND sc.invalid_reason IS NULL
        LIMIT 1
    )
{% endmacro %}
