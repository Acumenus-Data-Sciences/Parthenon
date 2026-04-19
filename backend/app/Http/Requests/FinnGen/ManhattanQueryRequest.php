<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 16-02 (GENOMICS-04 / GENOMICS-13) — query-param validation for the
 * thinned Manhattan endpoint `GET /api/v1/finngen/runs/{id}/manhattan`.
 *
 * Rule rationale:
 *   - bin_count clamped to [10, 500] (D-27, T-16-S1): a request with bin_count=1
 *     would force the server to return ~10M unbinned rows → OOM + bandwidth DoS.
 *     bin_count=500 is plenty for a readable Manhattan across 22 autosomes + X.
 *   - thin_threshold bounded to [1e-10, 1e-2]: must stay between a realistic
 *     genome-wide significance floor and a liberal suggestive threshold.
 *   - authorize() re-asserts permission alongside the route-level middleware
 *     (HIGHSEC §2 belt-and-suspenders).
 */
final class ManhattanQueryRequest extends FormRequest
{
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
            'bin_count' => ['nullable', 'integer', 'min:10', 'max:500'],
            'thin_threshold' => ['nullable', 'numeric', 'between:1e-10,1e-2'],
        ];
    }
}
