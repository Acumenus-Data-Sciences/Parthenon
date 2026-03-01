<?php

namespace App\Services\SqlRenderer;

use App\Services\SqlRenderer\Dialects\BigQueryDialect;
use App\Services\SqlRenderer\Dialects\DialectInterface;
use App\Services\SqlRenderer\Dialects\OracleDialect;
use App\Services\SqlRenderer\Dialects\PostgresDialect;
use App\Services\SqlRenderer\Dialects\SpannerDialect;
use InvalidArgumentException;

class SqlRendererService
{
    /**
     * @var array<string, DialectInterface>
     */
    private array $dialects = [];

    public function __construct()
    {
        $this->dialects = [
            'postgresql' => new PostgresDialect,
            'bigquery' => new BigQueryDialect,
            'oracle' => new OracleDialect,
            'spanner' => new SpannerDialect,
        ];
    }

    /**
     * Get a dialect instance by name.
     */
    public function dialect(string $name): DialectInterface
    {
        if (! isset($this->dialects[$name])) {
            throw new InvalidArgumentException("Unknown SQL dialect: {$name}");
        }

        return $this->dialects[$name];
    }

    /**
     * Render a parameterized SQL template.
     *
     * @param  array<string, string>  $params
     */
    public function render(string $template, array $params, string $dialectName = 'postgresql'): string
    {
        $dialect = $this->dialect($dialectName);
        $sql = $template;

        // Replace parameter placeholders {@paramName}
        foreach ($params as $key => $value) {
            $sql = str_replace("{@{$key}}", $value, $sql);
        }

        // Replace dialect-specific function calls
        $sql = $this->replaceDialectFunctions($sql, $dialect);

        return $sql;
    }

    /**
     * Replace dialect function placeholders in SQL.
     */
    private function replaceDialectFunctions(string $sql, DialectInterface $dialect): string
    {
        // Replace DATEADD({column}, {days})
        $sql = (string) preg_replace_callback(
            '/DATEADD\(([^,]+),\s*(-?\d+)\)/',
            fn (array $matches) => $dialect->dateAdd(trim($matches[1]), (int) $matches[2]),
            $sql
        );

        // Replace DATEDIFF({start}, {end})
        $sql = (string) preg_replace_callback(
            '/DATEDIFF\(([^,]+),\s*([^)]+)\)/',
            fn (array $matches) => $dialect->dateDiff(trim($matches[1]), trim($matches[2])),
            $sql
        );

        return $sql;
    }
}
