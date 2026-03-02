<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that foreign key references are valid (referenced record exists in the target table).
 */
class ForeignKeyCheck extends AbstractDqdCheck
{
    /**
     * @param  string  $table  The source table containing the FK column
     * @param  string  $column  The FK column in the source table
     * @param  string  $refTable  The referenced table
     * @param  string  $refColumn  The referenced column (PK in the target table)
     * @param  bool  $nullable  Whether the FK column is nullable (if true, NULLs are excluded from the check)
     * @param  string  $desc  Human-readable description
     */
    public function __construct(
        private string $table,
        private string $column,
        private string $refTable,
        private string $refColumn,
        private bool $nullable,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "conformance_fk_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'conformance';
    }

    public function subcategory(): string
    {
        return 'foreignKey';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return $this->column;
    }

    public function severity(): string
    {
        return 'error';
    }

    public function description(): string
    {
        return $this->desc;
    }

    public function sqlViolated(string $cdmSchema, string $vocabSchema): string
    {
        $nullClause = $this->nullable ? "AND t.{$this->column} IS NOT NULL" : '';

        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table} t
            LEFT JOIN {$cdmSchema}.{$this->refTable} r ON t.{$this->column} = r.{$this->refColumn}
            WHERE r.{$this->refColumn} IS NULL
              {$nullClause}
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        if ($this->nullable) {
            return <<<SQL
                SELECT COUNT(*)::bigint AS count
                FROM {$cdmSchema}.{$this->table}
                WHERE {$this->column} IS NOT NULL
                SQL;
        }

        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table}";
    }
}
