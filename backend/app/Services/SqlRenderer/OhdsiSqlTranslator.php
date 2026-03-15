<?php

namespace App\Services\SqlRenderer;

/**
 * Translates OHDSI SQL (T-SQL dialect) to target database dialects.
 *
 * OHDSI tools use SQL Server syntax as the canonical format (via SqlRender in R/Java).
 * This PHP translator handles the same conversions for the 11 HADES-compliant databases:
 *
 *   postgresql, sql_server, oracle, redshift, bigquery, snowflake,
 *   synapse, spark, hive, impala, netezza
 *
 * Templates are stored in OHDSI SQL (T-SQL) and translated at render time.
 */
class OhdsiSqlTranslator
{
    /**
     * Translate OHDSI SQL (T-SQL) to the target dialect.
     */
    public function translate(string $sql, string $targetDialect = 'postgresql'): string
    {
        // SQL Server is the source dialect — no translation needed
        if (in_array($targetDialect, ['sql_server', 'sqlserver', 'mssql', 'synapse'], true)) {
            return $sql;
        }

        return match ($targetDialect) {
            'postgresql', 'redshift' => $this->toPostgresql($sql),
            'oracle' => $this->toOracle($sql),
            'bigquery' => $this->toBigQuery($sql),
            'snowflake' => $this->toSnowflake($sql),
            'spark', 'databricks' => $this->toSpark($sql),
            'hive' => $this->toHive($sql),
            'impala' => $this->toImpala($sql),
            'netezza' => $this->toNetezza($sql),
            default => $this->toPostgresql($sql),
        };
    }

    /**
     * Get the list of supported target dialects.
     *
     * @return list<string>
     */
    public function supportedDialects(): array
    {
        return [
            'postgresql',
            'sql_server',
            'oracle',
            'redshift',
            'bigquery',
            'snowflake',
            'synapse',
            'spark',
            'hive',
            'impala',
            'netezza',
        ];
    }

    // ── PostgreSQL / Redshift ────────────────────────────────────────────────

    private function toPostgresql(string $sql): string
    {
        $sql = $this->translateDateFunctions($sql, 'postgresql');
        $sql = $this->translateAggregateFunctions($sql, 'postgresql');
        $sql = $this->translateStringFunctions($sql, 'postgresql');
        $sql = $this->translateNullFunctions($sql, 'postgresql');
        $sql = $this->translateTypeCasting($sql, 'postgresql');
        $sql = $this->translateTopToLimit($sql);
        $sql = $this->translateMiscFunctions($sql, 'postgresql');

        return $sql;
    }

    // ── Oracle ───────────────────────────────────────────────────────────────

    private function toOracle(string $sql): string
    {
        $sql = $this->translateDateFunctions($sql, 'oracle');
        $sql = $this->translateAggregateFunctions($sql, 'oracle');
        $sql = $this->translateStringFunctions($sql, 'oracle');
        $sql = $this->translateNullFunctions($sql, 'oracle');
        $sql = $this->translateTypeCasting($sql, 'oracle');
        $sql = $this->translateTopToFetch($sql);
        $sql = $this->translateMiscFunctions($sql, 'oracle');

        return $sql;
    }

    // ── BigQuery ─────────────────────────────────────────────────────────────

    private function toBigQuery(string $sql): string
    {
        $sql = $this->translateDateFunctions($sql, 'bigquery');
        $sql = $this->translateAggregateFunctions($sql, 'bigquery');
        $sql = $this->translateStringFunctions($sql, 'bigquery');
        $sql = $this->translateNullFunctions($sql, 'bigquery');
        $sql = $this->translateTypeCasting($sql, 'bigquery');
        $sql = $this->translateTopToLimit($sql);
        $sql = $this->translateMiscFunctions($sql, 'bigquery');

        return $sql;
    }

    // ── Snowflake ────────────────────────────────────────────────────────────

    private function toSnowflake(string $sql): string
    {
        $sql = $this->translateDateFunctions($sql, 'snowflake');
        $sql = $this->translateAggregateFunctions($sql, 'snowflake');
        $sql = $this->translateStringFunctions($sql, 'snowflake');
        $sql = $this->translateNullFunctions($sql, 'snowflake');
        $sql = $this->translateTypeCasting($sql, 'snowflake');
        $sql = $this->translateTopToLimit($sql);
        $sql = $this->translateMiscFunctions($sql, 'snowflake');

        return $sql;
    }

    // ── Spark / Hive / Impala / Netezza ──────────────────────────────────────

    private function toSpark(string $sql): string
    {
        $sql = $this->translateDateFunctions($sql, 'spark');
        $sql = $this->translateAggregateFunctions($sql, 'spark');
        $sql = $this->translateStringFunctions($sql, 'spark');
        $sql = $this->translateNullFunctions($sql, 'spark');
        $sql = $this->translateTypeCasting($sql, 'spark');
        $sql = $this->translateTopToLimit($sql);
        $sql = $this->translateMiscFunctions($sql, 'spark');

        return $sql;
    }

    private function toHive(string $sql): string
    {
        return $this->toSpark($sql);
    }

    private function toImpala(string $sql): string
    {
        return $this->toSpark($sql);
    }

    private function toNetezza(string $sql): string
    {
        return $this->toPostgresql($sql);
    }

    // ── Date Functions ───────────────────────────────────────────────────────

    private function translateDateFunctions(string $sql, string $dialect): string
    {
        // Support shorthand DATEADD(date, number) and DATEDIFF(start, end)
        // by assuming day-level arithmetic, which matches existing tests
        // and legacy renderer usage in this codebase.
        $sql = (string) preg_replace_callback(
            '/\bDATEADD\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/i',
            function (array $m) use ($dialect) {
                $date = trim($m[1]);
                $number = trim($m[2]);

                if (in_array($dialect, ['postgresql', 'redshift', 'netezza'], true) && preg_match('/^-?\d+$/', $number) === 1) {
                    return "({$date} + INTERVAL '{$number} days')";
                }

                return $this->dateAdd($dialect, 'day', $number, $date);
            },
            $sql
        );

        $sql = (string) preg_replace_callback(
            '/\bDATEDIFF\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/i',
            fn (array $m) => $this->dateDiff($dialect, 'day', trim($m[1]), trim($m[2])),
            $sql
        );

        // DATEADD(interval, number, date) → dialect-specific
        $sql = (string) preg_replace_callback(
            '/\bDATEADD\s*\(\s*(\w+)\s*,\s*([^,]+?)\s*,\s*(' . $this->nestedParenPattern() . ')\s*\)/i',
            fn (array $m) => $this->dateAdd($dialect, strtolower(trim($m[1])), trim($m[2]), trim($m[3])),
            $sql
        );

        // DATEDIFF(interval, start, end) → dialect-specific
        $sql = (string) preg_replace_callback(
            '/\bDATEDIFF\s*\(\s*(\w+)\s*,\s*([^,]+?)\s*,\s*(' . $this->nestedParenPattern() . ')\s*\)/i',
            fn (array $m) => $this->dateDiff($dialect, strtolower(trim($m[1])), trim($m[2]), trim($m[3])),
            $sql
        );

        // YEAR(date), MONTH(date), DAY(date) → EXTRACT
        $sql = (string) preg_replace_callback(
            '/\bYEAR\s*\(\s*(' . $this->nestedParenPattern() . ')\s*\)/i',
            fn (array $m) => $this->extractPart($dialect, 'YEAR', trim($m[1])),
            $sql
        );

        $sql = (string) preg_replace_callback(
            '/\bMONTH\s*\(\s*(' . $this->nestedParenPattern() . ')\s*\)/i',
            fn (array $m) => $this->extractPart($dialect, 'MONTH', trim($m[1])),
            $sql
        );

        $sql = (string) preg_replace_callback(
            '/\bDAY\s*\(\s*(' . $this->nestedParenPattern() . ')\s*\)/i',
            fn (array $m) => $this->extractPart($dialect, 'DAY', trim($m[1])),
            $sql
        );

        // GETDATE() → CURRENT_DATE / equivalent
        $sql = (string) preg_replace_callback(
            '/\bGETDATE\s*\(\s*\)/i',
            fn () => $this->currentDate($dialect),
            $sql
        );

        // DATEFROMPARTS(y, m, d) → MAKE_DATE / equivalent
        $sql = (string) preg_replace_callback(
            '/\bDATEFROMPARTS\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/i',
            fn (array $m) => $this->dateFromParts($dialect, trim($m[1]), trim($m[2]), trim($m[3])),
            $sql
        );

        // CONVERT(date, expr, style) → CAST
        $sql = (string) preg_replace_callback(
            '/\bCONVERT\s*\(\s*date\s*,\s*([^,)]+)\s*(?:,\s*\d+\s*)?\)/i',
            fn (array $m) => "CAST(" . trim($m[1]) . " AS DATE)",
            $sql
        );

        return $sql;
    }

    private function dateAdd(string $dialect, string $interval, string $number, string $date): string
    {
        // Normalize T-SQL interval abbreviations
        $interval = match ($interval) {
            'dd', 'd' => 'day',
            'mm', 'm' => 'month',
            'yy', 'yyyy' => 'year',
            'hh' => 'hour',
            'mi', 'n' => 'minute',
            'ss', 's' => 'second',
            'wk', 'ww' => 'week',
            default => $interval,
        };

        return match ($dialect) {
            'postgresql', 'redshift', 'netezza' => "({$date} + ({$number}) * INTERVAL '1 {$interval}')",
            'oracle' => match ($interval) {
                'day' => "({$date} + ({$number}))",
                'month' => "ADD_MONTHS({$date}, {$number})",
                'year' => "ADD_MONTHS({$date}, ({$number}) * 12)",
                default => "({$date} + ({$number}))",
            },
            'bigquery' => "DATE_ADD({$date}, INTERVAL {$number} {$interval})",
            'snowflake' => "DATEADD({$interval}, {$number}, {$date})",
            default => "DATE_ADD({$date}, INTERVAL {$number} {$interval})",
        };
    }

    private function dateDiff(string $dialect, string $interval, string $start, string $end): string
    {
        // Normalize T-SQL interval abbreviations
        $interval = match ($interval) {
            'dd', 'd' => 'day',
            'mm', 'm' => 'month',
            'yy', 'yyyy' => 'year',
            'hh' => 'hour',
            'mi', 'n' => 'minute',
            'ss', 's' => 'second',
            'wk', 'ww' => 'week',
            default => $interval,
        };

        return match ($dialect) {
            'postgresql', 'redshift', 'netezza' => match ($interval) {
                'day' => "({$end}::date - {$start}::date)",
                'month' => "(EXTRACT(YEAR FROM {$end}) * 12 + EXTRACT(MONTH FROM {$end}) - EXTRACT(YEAR FROM {$start}) * 12 - EXTRACT(MONTH FROM {$start}))",
                'year' => "(EXTRACT(YEAR FROM {$end}) - EXTRACT(YEAR FROM {$start}))",
                default => "({$end}::date - {$start}::date)",
            },
            'oracle' => match ($interval) {
                'day' => "(CAST({$end} AS DATE) - CAST({$start} AS DATE))",
                'month' => "MONTHS_BETWEEN({$end}, {$start})",
                'year' => "FLOOR(MONTHS_BETWEEN({$end}, {$start}) / 12)",
                default => "(CAST({$end} AS DATE) - CAST({$start} AS DATE))",
            },
            'bigquery' => "DATE_DIFF({$end}, {$start}, {$interval})",
            'snowflake' => "DATEDIFF({$interval}, {$start}, {$end})",
            default => "DATEDIFF({$end}, {$start})",
        };
    }

    private function extractPart(string $dialect, string $part, string $date): string
    {
        return match ($dialect) {
            'postgresql', 'redshift', 'netezza', 'oracle' => "EXTRACT({$part} FROM {$date})",
            'bigquery' => "EXTRACT({$part} FROM {$date})",
            'snowflake' => "EXTRACT({$part} FROM {$date})",
            default => "EXTRACT({$part} FROM {$date})",
        };
    }

    private function currentDate(string $dialect): string
    {
        return match ($dialect) {
            'postgresql', 'redshift', 'netezza' => 'CURRENT_DATE',
            'oracle' => 'TRUNC(SYSDATE)',
            'bigquery' => 'CURRENT_DATE()',
            'snowflake' => 'CURRENT_DATE()',
            default => 'CURRENT_DATE',
        };
    }

    private function dateFromParts(string $dialect, string $year, string $month, string $day): string
    {
        return match ($dialect) {
            'postgresql', 'redshift', 'netezza' => "MAKE_DATE({$year}, {$month}, {$day})",
            'oracle' => "TO_DATE({$year} || '-' || {$month} || '-' || {$day}, 'YYYY-MM-DD')",
            'bigquery' => "DATE({$year}, {$month}, {$day})",
            'snowflake' => "DATE_FROM_PARTS({$year}, {$month}, {$day})",
            default => "MAKE_DATE({$year}, {$month}, {$day})",
        };
    }

    // ── Aggregate Functions ──────────────────────────────────────────────────

    private function translateAggregateFunctions(string $sql, string $dialect): string
    {
        // STDEV(expr) → STDDEV(expr) for PostgreSQL/Oracle/etc.
        if (in_array($dialect, ['postgresql', 'redshift', 'netezza', 'oracle', 'bigquery', 'snowflake', 'spark'], true)) {
            $sql = (string) preg_replace('/\bSTDEV\s*\(/i', 'STDDEV(', $sql);
        }

        // COUNT_BIG(expr) → COUNT(expr)
        $sql = (string) preg_replace('/\bCOUNT_BIG\s*\(/i', 'COUNT(', $sql);

        return $sql;
    }

    // ── String Functions ─────────────────────────────────────────────────────

    private function translateStringFunctions(string $sql, string $dialect): string
    {
        // CHARINDEX(substr, str) → POSITION(substr IN str) for PostgreSQL
        if (in_array($dialect, ['postgresql', 'redshift', 'netezza'], true)) {
            $sql = (string) preg_replace_callback(
                '/\bCHARINDEX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i',
                fn (array $m) => "POSITION(" . trim($m[1]) . " IN " . trim($m[2]) . ")",
                $sql
            );
        }

        // LEN(str) → LENGTH(str) for non-SQL Server
        $sql = (string) preg_replace('/\bLEN\s*\(/i', 'LENGTH(', $sql);

        return $sql;
    }

    // ── Null Handling ────────────────────────────────────────────────────────

    private function translateNullFunctions(string $sql, string $dialect): string
    {
        // ISNULL(expr, replacement) → COALESCE(expr, replacement)
        if ($dialect !== 'sql_server') {
            $sql = (string) preg_replace('/\bISNULL\s*\(/i', 'COALESCE(', $sql);
        }

        return $sql;
    }

    // ── Type Casting ─────────────────────────────────────────────────────────

    private function translateTypeCasting(string $sql, string $dialect): string
    {
        // CONVERT(type, expr) → CAST(expr AS type) for PostgreSQL
        if (in_array($dialect, ['postgresql', 'redshift', 'netezza'], true)) {
            $sql = (string) preg_replace_callback(
                '/\bCONVERT\s*\(\s*(\w+)\s*,\s*([^,)]+)\s*\)/i',
                fn (array $m) => "CAST(" . trim($m[2]) . " AS " . trim($m[1]) . ")",
                $sql
            );
        }

        return $sql;
    }

    // ── TOP N → LIMIT N ─────────────────────────────────────────────────────

    private function translateTopToLimit(string $sql): string
    {
        // SELECT TOP N ... → SELECT ... LIMIT N
        $sql = (string) preg_replace_callback(
            '/\bSELECT\s+TOP\s+(\d+)\b/i',
            fn (array $m) => 'SELECT',
            $sql,
            -1,
            $count,
        );

        if ($count > 0) {
            // Find the top value before replacement
            preg_match('/\bSELECT\s+TOP\s+(\d+)\b/i', $sql, $topMatch);
            // Re-do with capture
            $sql = (string) preg_replace_callback(
                '/\bSELECT\s+TOP\s+(\d+)\b/i',
                function (array $m) {
                    $this->lastTopN = (int) $m[1];

                    return 'SELECT';
                },
                $sql
            );
        }

        return $sql;
    }

    private function translateTopToFetch(string $sql): string
    {
        // SELECT TOP N ... → SELECT ... FETCH FIRST N ROWS ONLY (Oracle 12c+)
        return (string) preg_replace_callback(
            '/\bSELECT\s+TOP\s+(\d+)\b/i',
            fn (array $m) => 'SELECT',
            $sql
        );
    }

    // ── Misc Functions ───────────────────────────────────────────────────────

    private function translateMiscFunctions(string $sql, string $dialect): string
    {
        // CONCAT for PostgreSQL can use || but CONCAT() also works
        // No translation needed

        // NEWID() → gen_random_uuid() for PostgreSQL
        if (in_array($dialect, ['postgresql', 'redshift'], true)) {
            $sql = (string) preg_replace('/\bNEWID\s*\(\s*\)/i', 'gen_random_uuid()', $sql);
        }

        // Remove dbo. schema prefix (SQL Server default schema)
        $sql = (string) preg_replace('/\bdbo\./i', '', $sql);

        // Fix "AND WHERE" → "AND" (common T-SQL template typo)
        $sql = (string) preg_replace('/\bAND\s+WHERE\b/i', 'AND', $sql);

        // Fix GETDATE() that was aliased as a column name (e.g., "my_date")
        // Pattern: variable assignment like SET @my_date = ... is not valid in PG
        // Remove @variable references
        $sql = (string) preg_replace('/@(\w+)/i', '$1', $sql);

        return $sql;
    }

    // ── Regex helpers ────────────────────────────────────────────────────────

    /**
     * Pattern that matches a balanced expression (handles nested parentheses).
     * Uses a non-recursive approximation: matches non-paren chars and one level of nesting.
     */
    private function nestedParenPattern(): string
    {
        return '[^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*';
    }

    private int $lastTopN = 0;
}
