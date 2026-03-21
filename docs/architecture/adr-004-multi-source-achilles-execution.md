# ADR-004: Multi-Source Achilles via Per-Request search_path Switching

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon supports multiple OMOP CDM data sources simultaneously. Each source (e.g., Acumenus production data, Eunomia demo dataset) has its own Achilles characterization results stored in a separate schema (e.g., `results` for Acumenus, `eunomia_results` for Eunomia). The Source/SourceDaimon model -- inherited from OHDSI WebAPI -- stores the `table_qualifier` (schema name) for each daimon type (CDM, vocabulary, results, temp).

The OHDSI Achilles tool produces standardized output tables (`achilles_results`, `achilles_results_dist`, `achilles_analysis`, `achilles_performance`) that are identical in structure across sources but contain source-specific data. The platform must query the correct schema's results tables based on which source the user has selected, without creating a separate Laravel database connection for each source.

Additionally, some sources may be external -- with their own `db_host`, `db_port`, and credentials -- requiring dynamically constructed connections at runtime.

## Decision

Implement per-request `search_path` switching in `AchillesResultReaderService` through a `setSchemaForSource()` method that is called at the beginning of every public method:

**For local sources** (no `db_host` set): Execute `SET search_path TO "{schema}", public` on the existing `results` connection, where `{schema}` comes from the source's results daimon `table_qualifier`.

**For remote/dynamic sources** (`db_host` set): Use `DynamicConnectionFactory` to register a runtime Laravel connection with the correct host, port, credentials, and `search_path`, then route all Eloquent queries to that connection via `Model::on($connectionName)`.

The service tracks the active connection name in a `$activeConnection` property and provides helper methods (`ar()`, `ard()`, `aa()`, `ap()`) that scope every Eloquent query builder to the active connection:

```php
private function setSchemaForSource(Source $source): void
{
    $daimon = $source->daimons()
        ->where('daimon_type', DaimonType::Results->value)->first();
    $schema = $daimon?->table_qualifier ?? 'results';

    if (! empty($source->db_host)) {
        $this->activeConnection = $this->connectionFactory
            ->connectionForSchema($source, $schema);
    } else {
        $this->activeConnection = 'results';
        DB::connection('results')->statement(
            "SET search_path TO \"{$schema}\", public"
        );
    }
}
```

Every public method (`getRecordCounts`, `getDemographics`, `getDomainSummary`, `getConceptDrilldown`, `getTemporalTrends`, etc.) calls `setSchemaForSource($source)` as its first operation. Concept name resolution always queries the `omop` connection regardless of the active results connection.

## Consequences

### Positive
- No proliferation of database connections -- local sources reuse the single `results` connection with different `search_path` values
- Adding a new local source requires only creating a new schema and a SourceDaimon record, not a new Laravel connection configuration
- Remote sources are supported transparently through `DynamicConnectionFactory`, which constructs connections at runtime from Source metadata
- The approach is stateless per-request: each HTTP request sets its own `search_path`, so concurrent requests for different sources do not interfere (PHP-FPM process isolation)
- Concept name resolution cross-references the `omop` schema vocabulary regardless of which results schema is active

### Negative
- The `SET search_path` statement is executed on every API call that touches Achilles data, adding a small per-request overhead
- If a developer forgets to call `setSchemaForSource()` at the start of a new public method, queries will use whatever `search_path` was set by the previous request in the same PHP-FPM worker (mitigated by the pattern of always calling it first)
- The `search_path` approach is PostgreSQL-specific -- porting to SQL Server or other databases would require a different mechanism
- Dynamic connections registered via `DynamicConnectionFactory` persist in the Laravel config for the lifetime of the request, consuming memory proportional to the number of distinct remote sources queried

### Risks
- SQL injection through `table_qualifier` values: the schema name is interpolated into the `SET search_path` statement. Mitigated by the fact that `table_qualifier` is set by administrators through the Source management UI, not by end users, and validated on input.
- Connection pool exhaustion with many remote sources: each dynamic source creates a new PDO connection. Mitigated by the per-request lifecycle -- connections are released when the PHP-FPM worker finishes the request.
- PHP-FPM persistent connections could carry over a stale `search_path` between requests. Mitigated by always calling `setSchemaForSource()` before any query.

## Alternatives Considered

1. **One Laravel connection per source** -- Define a named connection in `config/database.php` for each source. Rejected because the number of sources is dynamic (users add sources at runtime), and static configuration cannot accommodate runtime-added sources.

2. **Schema-qualified table names** -- Use `"{schema}".achilles_results` in every query instead of `SET search_path`. Rejected because Eloquent models have a single `$table` property, and schema-qualifying every query would require overriding the query builder or using raw SQL throughout.

3. **Separate databases per source** -- Each source gets its own PostgreSQL database. Rejected per ADR-001 (single database architecture) and because cross-source comparisons would require foreign data wrappers.

4. **Application-level query routing** -- Maintain a map of source ID to connection name and select the connection in middleware. Rejected because it would require middleware awareness of the source context, which is determined at the controller/service level, not the request level.
