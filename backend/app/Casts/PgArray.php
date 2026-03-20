<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Cast for PostgreSQL native array columns (e.g. integer[], varchar[]).
 *
 * Converts between PHP arrays and the PostgreSQL literal format
 * {val1,val2,...} needed when binding parameters for native array columns.
 *
 * @implements CastsAttributes<list<mixed>, list<mixed>>
 */
class PgArray implements CastsAttributes
{
    /**
     * Cast the given value (stored DB literal) to a PHP array.
     *
     * @param  array<string, mixed>  $attributes
     * @return list<mixed>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '' || $value === '{}') {
            return [];
        }

        // Strip surrounding braces: {val1,"val two",val3}
        $inner = trim((string) $value, '{}');
        if ($inner === '') {
            return [];
        }

        // Split on commas not inside quotes
        preg_match_all('/"(?:[^"\\\\]|\\\\.)*"|[^,]+/', $inner, $matches);
        $items = $matches[0] ?? [];

        return array_map(function (string $item): string {
            // Remove surrounding quotes and unescape
            if (str_starts_with($item, '"') && str_ends_with($item, '"')) {
                $item = substr($item, 1, -1);
                $item = str_replace('\\"', '"', $item);
            }

            return $item;
        }, $items);
    }

    /**
     * Prepare the given value for storage as a PostgreSQL array literal.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if ($value === null || $value === []) {
            return '{}';
        }

        if (! is_array($value)) {
            return '{}';
        }

        $escaped = array_map(function (mixed $item): string {
            $s = (string) $item;
            // Quote if contains comma, space, brace, backslash, double-quote, or is empty
            if ($s === '' || preg_match('/[,\s{}"\\\\]/', $s)) {
                $s = '"' . str_replace('"', '\\"', $s) . '"';
            }

            return $s;
        }, $value);

        return '{' . implode(',', $escaped) . '}';
    }
}
