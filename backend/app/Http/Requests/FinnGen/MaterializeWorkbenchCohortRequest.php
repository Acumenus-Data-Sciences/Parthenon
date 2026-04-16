<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * SP4 Polish 2 — POST /api/v1/finngen/workbench/materialize
 *
 * Laravel creates the cohort_definition row here, compiles the operation tree
 * to a subject-id SQL fragment via CohortOperationCompiler, and hands the
 * payload off to Darkstar's async cohort.materialize worker. Caller polls the
 * returned run id for terminal status + summary.subject_count.
 */
class MaterializeWorkbenchCohortRequest extends FormRequest
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
        // Tree structural validation lives in CohortOperationCompiler; here we
        // only enforce the envelope + required naming fields for the new
        // cohort_definition record.
        return [
            'source_key' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'tree' => ['required', 'array'],
            'tree.kind' => ['required', 'string', 'in:cohort,op'],
            'tree.id' => ['required', 'string'],
            // SP4 Polish #7 — overwrite flow. When the researcher re-materializes
            // an existing cohort, pass the cohort_definition_id so the backend
            // reuses that row (updates name/description/expression) and truncates
            // its rows in cohort before re-inserting. Must belong to the caller.
            'overwrite_cohort_definition_id' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
