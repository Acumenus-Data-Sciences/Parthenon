<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * SP4 Phase B.3 — request body for POST /api/v1/finngen/workbench/preview-counts.
 *
 * The tree itself is validated structurally by CohortOperationCompiler at the
 * service layer; here we only enforce the request envelope shape.
 */
class PreviewWorkbenchCountsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('finngen.workbench.use') ?? false;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'source_key' => ['required', 'string', 'max:64'],
            'tree' => ['required', 'array'],
            'tree.kind' => ['required', 'string', 'in:cohort,op'],
            'tree.id' => ['required', 'string'],
        ];
    }
}
