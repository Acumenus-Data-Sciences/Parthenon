# ADR-002: OMOP CDM Read-Only Model Pattern

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon stores clinical data in the OMOP Common Data Model (CDM) v5.4 format. This includes patient demographics, conditions, drug exposures, procedures, measurements, and observations -- data that is subject to HIPAA regulations and institutional data governance requirements.

The OMOP CDM is populated through controlled ETL pipelines (WhiteRabbit, FHIR-to-CDM, Morpheus ingest) and must not be modified by application logic. In the standard OHDSI ecosystem, tools like Atlas and WebAPI read CDM data to build cohort definitions and run analyses but never write back to CDM tables. Any accidental write (an UPDATE, DELETE, or INSERT from application code) could corrupt clinical data integrity, invalidate research results, and create compliance violations.

Laravel's Eloquent ORM makes it easy to call `$model->save()`, `$model->delete()`, or `Model::create()` on any model by default. Without explicit protection, a developer could inadvertently write to CDM tables through normal Eloquent operations.

## Decision

Create an abstract base class `CdmModel` that all OMOP CDM Eloquent models extend. This class enforces read-only behavior at the framework level by:

1. Setting `$connection = 'omop'` to route all queries to the OMOP schema
2. Disabling `$timestamps` since CDM tables do not have `created_at`/`updated_at` columns
3. Registering Eloquent lifecycle hooks in `boot()` that throw `RuntimeException` on any `creating`, `updating`, or `deleting` event

```php
abstract class CdmModel extends Model
{
    protected $connection = 'omop';
    public $timestamps = false;

    protected static function boot(): void
    {
        parent::boot();
        static::creating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::updating(fn () => throw new RuntimeException('CDM models are read-only'));
        static::deleting(fn () => throw new RuntimeException('CDM models are read-only'));
    }
}
```

All models representing CDM tables (`Person`, `ConditionOccurrence`, `DrugExposure`, `Measurement`, `Concept`, `VisitOccurrence`, etc.) extend `CdmModel` rather than the base `Model` class.

Write operations to the `omop` schema are performed exclusively through:
- Artisan commands for ETL pipelines (`parthenon:load-eunomia`, ingestion jobs)
- Direct SQL via `DB::connection('omop')->statement()` in controlled service classes
- External tools (WhiteRabbit, FHIR-to-CDM) that connect directly to PostgreSQL

## Consequences

### Positive
- Accidental writes to clinical data fail immediately with a clear error message rather than silently corrupting data
- The read-only constraint is enforced at the ORM level, catching mistakes during development and testing before they reach production
- Developers receive immediate feedback if they attempt `$person->update(...)` or `Concept::create(...)` -- the exception message explicitly states "CDM models are read-only"
- Supports HIPAA audit requirements by ensuring application code cannot modify clinical records through the ORM
- PHPStan static analysis can detect misuse patterns at build time

### Negative
- ETL and ingestion code cannot use Eloquent for bulk inserts into CDM tables -- must use raw `DB::connection('omop')` queries or external tooling
- Developers must understand the distinction between `CdmModel` (read-only) and regular `Model` (read-write) when working with different domains
- The `RuntimeException` approach stops execution rather than returning a boolean failure, which means callers must handle exceptions

### Risks
- A developer could bypass the protection by using `DB::connection('omop')->table('person')->insert(...)` directly. This is an intentional escape hatch for ETL code but could be misused. Mitigated by code review and the HIGHSEC security specification.
- If a new CDM table model is created without extending `CdmModel`, it would lack read-only protection. Mitigated by PHPStan rules and the convention that all models in `App\Models\Cdm\` must extend `CdmModel`.

## Alternatives Considered

1. **Database-level read-only user** -- Create a PostgreSQL role with SELECT-only privileges on the `omop` schema. Rejected because the same database user is used across all connections for operational simplicity (single `DB_USERNAME`), and splitting users would complicate the single-database architecture (ADR-001).

2. **Laravel read-only trait** -- Use a trait instead of a base class. Rejected because a base class also centralizes `$connection` and `$timestamps` configuration, reducing boilerplate across 30+ CDM model files.

3. **No enforcement, rely on code review** -- Trust developers to never write to CDM models. Rejected because human error is inevitable, and the cost of corrupting clinical data far exceeds the cost of a simple base class.

4. **PostgreSQL triggers to reject writes** -- Create `BEFORE INSERT/UPDATE/DELETE` triggers on CDM tables that raise exceptions. Considered as a defense-in-depth layer but not implemented as the primary mechanism because it would not provide developer-friendly error messages and would only surface at query execution time rather than at the ORM level.
