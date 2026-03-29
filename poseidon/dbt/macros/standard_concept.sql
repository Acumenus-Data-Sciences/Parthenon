-- poseidon/dbt/macros/standard_concept.sql
-- Follow 'Maps to' relationship to return the standard concept_id for a given concept_id.
-- Returns the input concept_id unchanged when no standard mapping exists.
-- Usage: {{ standard_concept('src.condition_concept_id') }}
{% macro standard_concept(concept_id_expr) %}
(
    SELECT COALESCE(tc.concept_id, {{ concept_id_expr }})
    FROM {{ var('vocab_schema', 'vocab') }}.concept_relationship cr
    JOIN {{ var('vocab_schema', 'vocab') }}.concept tc
        ON tc.concept_id = cr.concept_id_2
        AND tc.standard_concept = 'S'
        AND tc.invalid_reason IS NULL
    WHERE cr.concept_id_1 = {{ concept_id_expr }}
        AND cr.relationship_id = 'Maps to'
        AND cr.invalid_reason IS NULL
    LIMIT 1
)
{% endmacro %}
