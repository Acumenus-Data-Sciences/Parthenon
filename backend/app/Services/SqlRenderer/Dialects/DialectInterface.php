<?php

namespace App\Services\SqlRenderer\Dialects;

interface DialectInterface
{
    /**
     * Generate a date addition expression.
     */
    public function dateAdd(string $dateColumn, int $days): string;

    /**
     * Generate a date difference expression (in days).
     */
    public function dateDiff(string $startDate, string $endDate): string;

    /**
     * Generate a CAST expression.
     */
    public function castAs(string $expression, string $type): string;

    /**
     * Generate CREATE TEMP TABLE syntax.
     */
    public function tempTableCreate(string $tableName, string $selectQuery): string;

    /**
     * Generate DROP TEMP TABLE syntax.
     */
    public function tempTableDrop(string $tableName): string;

    /**
     * Qualify a table name with schema.
     */
    public function qualifyTable(string $schema, string $table): string;

    /**
     * Add a LIMIT clause to a query.
     */
    public function limitQuery(string $query, int $limit, int $offset = 0): string;
}
