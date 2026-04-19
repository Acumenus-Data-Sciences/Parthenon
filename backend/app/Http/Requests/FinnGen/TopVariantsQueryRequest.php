<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Phase 16-03 (GENOMICS-04 / GENOMICS-13) — query-param validation for the
 * top-variants endpoint `GET /api/v1/finngen/runs/{id}/top-variants`.
 *
 * Rule rationale:
 *   - `limit` clamped to [1, 200] (D-18, T-16-S5): a request with limit=10000
 *     could coerce the server into returning thousands of JSON rows per call
 *     → bandwidth DoS. The downstream drawer UI never needs more than ~200.
 *   - `sort` whitelist is the SAME 7 columns enforced in
 *     ManhattanAggregationService::topVariants (T-16-S1 ORDER BY injection
 *     defense-in-depth). The service re-checks via in_array() so a controller
 *     that forgets this FormRequest still can't inject arbitrary SQL.
 *   - `dir` enum allows asc/desc in either case for frontend ergonomics;
 *     ManhattanAggregationService normalises to uppercase before SQL.
 *   - authorize() re-asserts `finngen.workbench.use` alongside the route-level
 *     middleware (HIGHSEC §2 belt-and-suspenders, mirrors Plan 02).
 */
final class TopVariantsQueryRequest extends FormRequest
{
    /**
     * Whitelisted sort columns. MUST match
     * ManhattanAggregationService::topVariants()'s local $allowedSorts.
     */
    public const ALLOWED_SORTS = ['chrom', 'pos', 'af', 'beta', 'se', 'p_value', 'snp_id'];

    public function authorize(): bool
    {
        return $this->user()?->can('finngen.workbench.use') ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort' => ['nullable', 'string', Rule::in(self::ALLOWED_SORTS)],
            'dir' => ['nullable', 'string', Rule::in(['asc', 'desc', 'ASC', 'DESC'])],
        ];
    }
}
