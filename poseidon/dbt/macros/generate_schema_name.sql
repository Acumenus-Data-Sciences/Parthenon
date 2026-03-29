-- poseidon/dbt/macros/generate_schema_name.sql
-- Route models to the correct OMOP schema based on dbt vars.
-- cdm/ → cdm_schema (omop), staging/ → staging_{project_id},
-- intermediate/ → cdm_schema_transform, quality/ → results_schema
{% macro generate_schema_name(custom_schema_name, node) %}
    {# Route models to the correct OMOP schema based on dbt vars #}
    {% if custom_schema_name %}
        {{ custom_schema_name }}
    {% elif node.fqn[1] == 'cdm' %}
        {{ var('cdm_schema', 'omop') }}
    {% elif node.fqn[1] == 'staging' %}
        {{ var('staging_schema', 'staging_' ~ var('project_id', '0')) }}
    {% elif node.fqn[1] == 'intermediate' %}
        {{ var('cdm_schema', 'omop') }}_transform
    {% elif node.fqn[1] == 'quality' %}
        {{ var('results_schema', 'results') }}
    {% else %}
        {{ target.schema }}
    {% endif %}
{% endmacro %}
