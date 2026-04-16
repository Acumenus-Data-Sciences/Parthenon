<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * SP4 Phase D — request body for POST /api/v1/finngen/workbench/match.
 *
 * Wraps the existing finngen.cohort.match analysis dispatch with workbench
 * RBAC (finngen.workbench.use). Returns a finngen run id the caller can
 * poll via the standard /api/v1/finngen/runs/{id} endpoint.
 */
class MatchWorkbenchCohortRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('finngen.workbench.use') ?? false;
    }

    /**
     * @return array<string, array<int, string|int>>
     */
    public function rules(): array
    {
        return [
            'source_key' => ['required', 'string', 'max:64'],
            'primary_cohort_id' => ['required', 'integer', 'min:1'],
            'comparator_cohort_ids' => ['required', 'array', 'min:1', 'max:10'],
            'comparator_cohort_ids.*' => ['integer', 'min:1'],
            'ratio' => ['nullable', 'integer', 'min:1', 'max:10'],
            'match_sex' => ['nullable', 'boolean'],
            'match_birth_year' => ['nullable', 'boolean'],
            'max_year_difference' => ['nullable', 'integer', 'min:0', 'max:10'],
        ];
    }
}
