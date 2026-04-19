<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 16-02 (GENOMICS-04) — query-param validation for the regional
 * (full-resolution) Manhattan endpoint
 * `GET /api/v1/finngen/runs/{id}/manhattan/region?chrom=&start=&end=`.
 *
 * Constraints:
 *   - chrom whitelist: 1-22, X, Y, MT. Rejects "chr1", "chr17", "23", etc.
 *   - start/end positive, end > start.
 *   - window ≤ 2,000,000 bp (T-16-S4 DoS guard; enforced in after()).
 */
final class ManhattanRegionQueryRequest extends FormRequest
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
            // Valid human chromosomes: 1-22, X, Y, MT. "23" is a common
            // confound (UCSC-style X encoding) and MUST be rejected —
            // callers should send "X" explicitly.
            'chrom' => ['required', 'string', 'regex:/^([1-9]|1\d|2[0-2]|X|Y|MT)$/'],
            'start' => ['required', 'integer', 'min:1', 'max:300000000'],
            'end' => ['required', 'integer', 'min:1', 'max:300000000', 'gt:start'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'chrom.regex' => 'chrom must be 1-22, X, Y, or MT',
        ];
    }

    /**
     * @return array<int, callable(Validator):void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $start = (int) $this->input('start');
                $end = (int) $this->input('end');
                if (($end - $start) > 2_000_000) {
                    $validator->errors()->add('end', 'window cannot exceed 2,000,000 bp');
                }
            },
        ];
    }
}
