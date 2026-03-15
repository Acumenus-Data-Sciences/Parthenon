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

    private OhdsiSqlTranslator $translator;

    public function __construct()
    {
        $this->dialects = [
            'postgresql' => new PostgresDialect,
            'bigquery' => new BigQueryDialect,
            'oracle' => new OracleDialect,
            'spanner' => new SpannerDialect,
        ];

        $this->translator = new OhdsiSqlTranslator;
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
     * Render a parameterized OHDSI SQL template.
     *
     * 1. Substitute parameter placeholders ({@paramName})
     * 2. Translate OHDSI SQL (T-SQL) to the target dialect
     *
     * @param  array<string, string>  $params
     */
    public function render(string $template, array $params, string $dialectName = 'postgresql'): string
    {
        $sql = $template;

        // Replace parameter placeholders {@paramName}
        foreach ($params as $key => $value) {
            $sql = str_replace("{@{$key}}", $value, $sql);
        }

        // Translate OHDSI SQL (T-SQL) to target dialect
        $sql = $this->translator->translate($sql, $dialectName);

        return $sql;
    }

    /**
     * Get the list of supported HADES-compliant dialects.
     *
     * @return list<string>
     */
    public function supportedDialects(): array
    {
        return $this->translator->supportedDialects();
    }
}
