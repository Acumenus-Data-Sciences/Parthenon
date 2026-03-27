<?php

namespace App\Services\AI;

use App\Models\App\Source;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DataInterrogationService
{
    private const MAX_ITERATIONS = 5;

    private const MAX_ROWS = 10_000;

    /** Patterns that are NOT allowed on non-temp schemas. */
    private const FORBIDDEN_PATTERNS = [
        '/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|ALTER|TRUNCATE|CREATE\s+TABLE|CREATE\s+INDEX)\b(?!.*temp_abby)/i',
        '/\bpg_/i',
    ];

    public function __construct(
        private readonly AnalyticsLlmService $llm,
    ) {}

    /**
     * @return array{answer: string, tables: array<int, array<string, mixed>>, queries: array<int, string>, iterations: int}
     */
    public function ask(string $question, Source $source, ?User $user = null): array
    {
        /** @var array<string, mixed> $schemaConfig */
        $schemaConfig = config('cdm-interrogation-schema');
        $systemPrompt = $this->buildSystemPrompt($schemaConfig);

        /** @var array<int, array{role: string, content: string}> $messages */
        $messages = [
            ['role' => 'user', 'content' => $question],
        ];

        /** @var array<int, string> $executedQueries */
        $executedQueries = [];
        /** @var array<int, array<string, mixed>> $lastResults */
        $lastResults = [];
        $iterations = 0;

        while ($iterations < self::MAX_ITERATIONS) {
            $iterations++;

            $response = $this->llm->chat($messages, [
                'system' => $systemPrompt,
                'max_tokens' => 4096,
                'temperature' => 0.1,
            ]);

            $messages[] = ['role' => 'assistant', 'content' => $response];

            // Extract SQL from response
            $sql = $this->extractSql($response);

            if ($sql === null) {
                // No SQL found — this is the final answer
                return [
                    'answer' => $response,
                    'tables' => $lastResults,
                    'queries' => $executedQueries,
                    'iterations' => $iterations,
                ];
            }

            // Validate SQL safety
            $violation = $this->checkSqlSafety($sql);
            if ($violation !== null) {
                Log::warning('Data interrogation SQL safety violation', [
                    'sql' => $sql,
                    'violation' => $violation,
                    'user_id' => $user?->id,
                ]);

                $messages[] = [
                    'role' => 'user',
                    'content' => "SQL REJECTED: {$violation}. Rewrite the query using only SELECT statements on the omop and results schemas. You may use temp_abby schema for intermediate tables.",
                ];

                continue;
            }

            // Execute SQL
            $executedQueries[] = $sql;
            $queryResult = $this->executeSql($sql);

            if ($queryResult['error'] !== null) {
                $messages[] = [
                    'role' => 'user',
                    'content' => "SQL ERROR: {$queryResult['error']}\n\nPlease fix the query and try again.",
                ];

                continue;
            }

            $lastResults = $queryResult['rows'];
            $rowCount = count($queryResult['rows']);

            // Format results for the LLM
            $resultText = $this->formatResultsForLlm($queryResult['rows'], $queryResult['columns']);

            $messages[] = [
                'role' => 'user',
                'content' => "Query returned {$rowCount} rows:\n\n{$resultText}\n\nIf you need more data, write another SQL query. Otherwise, provide a clear natural language answer to the original question, using markdown tables for tabular data.",
            ];
        }

        // Max iterations reached — force final answer
        $response = $this->llm->chat(
            array_merge($messages, [
                ['role' => 'user', 'content' => 'You have reached the maximum number of queries. Provide your best answer using the data collected so far.'],
            ]),
            [
                'system' => $systemPrompt,
                'max_tokens' => 4096,
                'temperature' => 0.1,
            ],
        );

        return [
            'answer' => $response,
            'tables' => $lastResults,
            'queries' => $executedQueries,
            'iterations' => $iterations,
        ];
    }

    /**
     * @param  array<string, mixed>  $schemaConfig
     */
    private function buildSystemPrompt(array $schemaConfig): string
    {
        /** @var string $header */
        $header = $schemaConfig['prompt_header'];
        /** @var string $joins */
        $joins = $schemaConfig['common_joins'];

        $tableLines = [];
        /** @var array<string, array{description: string, columns: string}> $tables */
        $tables = $schemaConfig['tables'];
        foreach ($tables as $name => $info) {
            $tableLines[] = "TABLE {$name}: {$info['description']}\n  Columns: {$info['columns']}";
        }
        $tableBlock = implode("\n\n", $tableLines);

        return <<<PROMPT
        {$header}

        SCHEMA REFERENCE:

        {$tableBlock}

        {$joins}

        RESPONSE FORMAT:
        - When you need data, return a single SQL query in a ```sql fenced block
        - After receiving results, either write another query or provide your final answer
        - Final answers should be clear natural language with markdown tables for tabular data
        - State any assumptions you make about the data
        - Do NOT include multiple SQL statements separated by semicolons — one query per response
        PROMPT;
    }

    private function extractSql(string $response): ?string
    {
        // Match ```sql ... ``` blocks
        if (preg_match('/```sql\s*\n(.*?)\n```/s', $response, $matches)) {
            return trim($matches[1]);
        }

        // Match ``` ... ``` blocks that look like SQL
        if (preg_match('/```\s*\n((?:SELECT|WITH|CREATE\s+TEMP).*?)\n```/si', $response, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }

    private function checkSqlSafety(string $sql): ?string
    {
        // Check for multi-statement
        $stripped = preg_replace("/'[^']*'/", '', $sql) ?? $sql;
        if (substr_count($stripped, ';') > 1) {
            return 'Multiple statements are not allowed. Send one query at a time.';
        }

        // Check for forbidden patterns (excluding temp_abby operations)
        foreach (self::FORBIDDEN_PATTERNS as $pattern) {
            if (preg_match($pattern, $sql)) {
                // Allow CREATE/INSERT/DROP on temp_abby schema
                if (preg_match('/temp_abby/i', $sql)) {
                    continue;
                }

                return 'Only SELECT queries are allowed on omop and results schemas. Use temp_abby for intermediate tables.';
            }
        }

        return null;
    }

    /**
     * @return array{rows: array<int, array<string, mixed>>, columns: list<string>, error: ?string}
     */
    private function executeSql(string $sql): array
    {
        try {
            /** @var array<int, \stdClass> $results */
            $results = DB::connection('interrogation')
                ->select(DB::raw($sql));

            /** @var array<int, array<string, mixed>> $rows */
            $rows = array_map(fn (\stdClass $row): array => (array) $row, $results);

            // Cap rows
            if (count($rows) > self::MAX_ROWS) {
                $rows = array_slice($rows, 0, self::MAX_ROWS);
            }

            /** @var list<string> $columns */
            $columns = $rows !== [] ? array_keys($rows[0]) : [];

            return ['rows' => $rows, 'columns' => $columns, 'error' => null];
        } catch (\Throwable $e) {
            return ['rows' => [], 'columns' => [], 'error' => $e->getMessage()];
        }
    }

    /**
     * Format query results as a text table for the LLM context.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @param  list<string>  $columns
     */
    private function formatResultsForLlm(array $rows, array $columns): string
    {
        if ($rows === []) {
            return '(no rows returned)';
        }

        // For large result sets, truncate for LLM context
        $displayRows = array_slice($rows, 0, 100);
        $truncated = count($rows) > 100;

        // Build markdown table
        $header = '| '.implode(' | ', $columns).' |';
        $separator = '| '.implode(' | ', array_fill(0, count($columns), '---')).' |';

        $dataLines = array_map(function (array $row) use ($columns): string {
            $values = array_map(function (string $col) use ($row): string {
                $val = $row[$col] ?? '';

                return mb_substr((string) $val, 0, 50);
            }, $columns);

            return '| '.implode(' | ', $values).' |';
        }, $displayRows);

        $table = implode("\n", [$header, $separator, ...$dataLines]);

        if ($truncated) {
            $table .= "\n\n(Showing first 100 of ".count($rows).' rows)';
        }

        return $table;
    }
}
