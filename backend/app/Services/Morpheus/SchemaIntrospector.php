<?php

namespace App\Services\Morpheus;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Introspects a Morpheus dataset schema to discover which tables and columns
 * exist. Results are cached for 1 hour since schema structure rarely changes.
 *
 * This enables the patient service to adapt its SQL to schemas with different
 * structures (MIMIC-IV uses anchor_age, Epic/AtlanticHealth uses dob, etc.).
 */
class SchemaIntrospector
{
    private string $conn = 'inpatient';

    private const CACHE_TTL = 3600; // 1 hour

    /**
     * Check if a table exists in the given schema.
     */
    public function hasTable(string $schema, string $table): bool
    {
        return in_array($table, $this->getTables($schema), true);
    }

    /**
     * Check if a column exists on a table in the given schema.
     */
    public function hasColumn(string $schema, string $table, string $column): bool
    {
        return in_array($column, $this->getColumns($schema, $table), true);
    }

    /**
     * Get all table names in a schema.
     */
    public function getTables(string $schema): array
    {
        return Cache::remember("morpheus_schema_tables:{$schema}", self::CACHE_TTL, function () use ($schema) {
            $rows = DB::connection($this->conn)->select(
                'SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name',
                [$schema]
            );

            return array_map(fn ($r) => $r->table_name, $rows);
        });
    }

    /**
     * Get all column names for a table in a schema.
     */
    public function getColumns(string $schema, string $table): array
    {
        return Cache::remember("morpheus_schema_cols:{$schema}:{$table}", self::CACHE_TTL, function () use ($schema, $table) {
            $rows = DB::connection($this->conn)->select(
                'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position',
                [$schema, $table]
            );

            return array_map(fn ($r) => $r->column_name, $rows);
        });
    }

    /**
     * Build the SQL expression for patient age based on available columns.
     * MIMIC-IV: anchor_age column directly.
     * Epic/other: derive from dob.
     */
    public function ageExpression(string $schema, string $alias = 'p'): string
    {
        if ($this->hasColumn($schema, 'patients', 'anchor_age')) {
            return "{$alias}.anchor_age";
        }

        if ($this->hasColumn($schema, 'patients', 'dob')) {
            return "EXTRACT(YEAR FROM AGE(NOW(), {$alias}.dob::date))::int";
        }

        return 'NULL';
    }

    /**
     * Build the SELECT columns for patients based on available columns.
     * Returns a consistent set of aliased columns regardless of source.
     */
    public function patientSelectColumns(string $schema, string $alias = 'p'): string
    {
        $cols = ["{$alias}.subject_id", "{$alias}.gender"];

        // Age
        $cols[] = $this->ageExpression($schema, $alias).' AS anchor_age';

        // anchor_year
        if ($this->hasColumn($schema, 'patients', 'anchor_year')) {
            $cols[] = "{$alias}.anchor_year";
        } else {
            $cols[] = 'NULL AS anchor_year';
        }

        // anchor_year_group
        if ($this->hasColumn($schema, 'patients', 'anchor_year_group')) {
            $cols[] = "{$alias}.anchor_year_group";
        } else {
            $cols[] = "NULL AS anchor_year_group";
        }

        // dod
        $cols[] = "{$alias}.dod";

        return implode(', ', $cols);
    }

    /**
     * Build the GROUP BY columns for patients (matching patientSelectColumns).
     */
    public function patientGroupByColumns(string $schema, string $alias = 'p'): string
    {
        $cols = ["{$alias}.subject_id", "{$alias}.gender"];

        if ($this->hasColumn($schema, 'patients', 'anchor_age')) {
            $cols[] = "{$alias}.anchor_age";
        } elseif ($this->hasColumn($schema, 'patients', 'dob')) {
            $cols[] = "{$alias}.dob";
        }

        if ($this->hasColumn($schema, 'patients', 'anchor_year')) {
            $cols[] = "{$alias}.anchor_year";
        }
        if ($this->hasColumn($schema, 'patients', 'anchor_year_group')) {
            $cols[] = "{$alias}.anchor_year_group";
        }

        $cols[] = "{$alias}.dod";

        return implode(', ', $cols);
    }

    /**
     * Build the age-bucketing CASE expression for demographics.
     */
    public function ageBucketExpression(string $schema, string $alias = 'p'): string
    {
        $ageExpr = $this->ageExpression($schema, $alias);

        return "CASE
            WHEN ({$ageExpr})::int < 20 THEN '<20'
            WHEN ({$ageExpr})::int BETWEEN 20 AND 29 THEN '20-29'
            WHEN ({$ageExpr})::int BETWEEN 30 AND 39 THEN '30-39'
            WHEN ({$ageExpr})::int BETWEEN 40 AND 49 THEN '40-49'
            WHEN ({$ageExpr})::int BETWEEN 50 AND 59 THEN '50-59'
            WHEN ({$ageExpr})::int BETWEEN 60 AND 69 THEN '60-69'
            WHEN ({$ageExpr})::int BETWEEN 70 AND 79 THEN '70-79'
            WHEN ({$ageExpr})::int BETWEEN 80 AND 89 THEN '80-89'
            ELSE '90+' END";
    }
}
