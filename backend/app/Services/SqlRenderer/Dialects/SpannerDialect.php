<?php

namespace App\Services\SqlRenderer\Dialects;

use RuntimeException;

class SpannerDialect implements DialectInterface
{
    public function dateAdd(string $dateColumn, int $days): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function dateDiff(string $startDate, string $endDate): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function castAs(string $expression, string $type): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function tempTableCreate(string $tableName, string $selectQuery): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function tempTableDrop(string $tableName): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function qualifyTable(string $schema, string $table): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }

    public function limitQuery(string $query, int $limit, int $offset = 0): string
    {
        throw new RuntimeException('Spanner dialect not yet implemented');
    }
}
