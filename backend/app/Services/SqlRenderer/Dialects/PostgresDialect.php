<?php

namespace App\Services\SqlRenderer\Dialects;

class PostgresDialect implements DialectInterface
{
    public function dateAdd(string $dateColumn, int $days): string
    {
        return "{$dateColumn} + INTERVAL '{$days} days'";
    }

    public function dateDiff(string $startDate, string $endDate): string
    {
        return "({$endDate}::date - {$startDate}::date)";
    }

    public function castAs(string $expression, string $type): string
    {
        return "CAST({$expression} AS {$type})";
    }

    public function tempTableCreate(string $tableName, string $selectQuery): string
    {
        return "CREATE TEMP TABLE {$tableName} AS {$selectQuery}";
    }

    public function tempTableDrop(string $tableName): string
    {
        return "DROP TABLE IF EXISTS {$tableName}";
    }

    public function qualifyTable(string $schema, string $table): string
    {
        return "{$schema}.{$table}";
    }

    public function limitQuery(string $query, int $limit, int $offset = 0): string
    {
        $sql = "{$query} LIMIT {$limit}";
        if ($offset > 0) {
            $sql .= " OFFSET {$offset}";
        }

        return $sql;
    }
}
