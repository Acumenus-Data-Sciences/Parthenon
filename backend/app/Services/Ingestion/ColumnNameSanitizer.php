<?php

namespace App\Services\Ingestion;

use InvalidArgumentException;

/**
 * Pure utility class for sanitizing PostgreSQL identifiers (column and table names).
 *
 * Rules applied in order:
 * 1. Lowercase
 * 2. Replace non-alphanumeric chars (except underscore) with _
 * 3. Collapse multiple consecutive underscores
 * 4. Strip leading/trailing underscores
 * 5. Prefix with col_ if starts with a digit
 * 6. Prefix with col_ if PostgreSQL reserved word
 * 7. Collision check with __row_id
 * 8. Truncate to 63 characters
 * 9. If empty after sanitization, return col_unnamed
 */
final class ColumnNameSanitizer
{
    /** @var list<string> */
    private const RESERVED_WORDS = [
        'select', 'table', 'order', 'group', 'user', 'type', 'index',
        'primary', 'key', 'column', 'constraint', 'check', 'default',
        'create', 'drop', 'alter', 'insert', 'update', 'delete',
        'where', 'from', 'join', 'on', 'in', 'as', 'is', 'not',
        'null', 'and', 'or', 'between', 'like', 'limit', 'offset',
        'having', 'union', 'all', 'any', 'case', 'when', 'then',
        'else', 'end', 'exists', 'foreign', 'references', 'unique',
        'grant', 'revoke', 'trigger', 'view', 'with', 'desc', 'asc',
        'distinct', 'into', 'values', 'set', 'begin', 'commit',
        'rollback', 'true', 'false', 'cast',
    ];

    public static function sanitizeColumnName(string $name): string
    {
        return self::sanitize($name);
    }

    public static function sanitizeTableName(string $name): string
    {
        $result = self::sanitize($name);

        if (! preg_match('/^[a-z][a-z0-9_]{0,62}$/', $result)) {
            throw new InvalidArgumentException(
                "Table name '{$name}' could not be sanitized to a valid PostgreSQL identifier. Result: '{$result}'"
            );
        }

        return $result;
    }

    /**
     * Deduplicate an array of names by appending _2, _3, etc. for collisions.
     *
     * @param  list<string>  $names
     * @return list<string>
     */
    public static function deduplicateNames(array $names): array
    {
        $seen = [];
        $result = [];

        foreach ($names as $name) {
            if (! isset($seen[$name])) {
                $seen[$name] = 1;
                $result[] = $name;
            } else {
                $seen[$name]++;
                $deduplicated = $name.'_'.$seen[$name];
                // Handle edge case: the deduplicated name itself might collide
                while (in_array($deduplicated, $result, true)) {
                    $seen[$name]++;
                    $deduplicated = $name.'_'.$seen[$name];
                }
                $result[] = $deduplicated;
            }
        }

        return $result;
    }

    private static function sanitize(string $name): string
    {
        // 1. Lowercase
        $result = strtolower($name);

        // 2. Replace non-alphanumeric chars (except underscore) with _
        $result = preg_replace('/[^a-z0-9_]/', '_', $result);

        // 3. Collapse multiple consecutive underscores
        $result = preg_replace('/_+/', '_', $result);

        // 4. Strip leading/trailing underscores
        $result = trim($result, '_');

        // 9. If empty after sanitization, return col_unnamed
        if ($result === '') {
            return 'col_unnamed';
        }

        // 5. Prefix with col_ if starts with a digit
        if (preg_match('/^[0-9]/', $result)) {
            $result = 'col_'.$result;
        }

        // 6. Prefix with col_ if PostgreSQL reserved word
        if (in_array($result, self::RESERVED_WORDS, true)) {
            $result = 'col_'.$result;
        }

        // 7. Collision check with __row_id
        if ($result === '__row_id') {
            $result = 'col___row_id';
        }

        // 8. Truncate to 63 characters
        if (strlen($result) > 63) {
            $result = substr($result, 0, 63);
            // Clean up trailing underscore from truncation
            $result = rtrim($result, '_');
        }

        return $result;
    }
}
