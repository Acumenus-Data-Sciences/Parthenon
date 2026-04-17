<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

/**
 * SP4 Phase D.3 — promote a succeeded cohort.match run's matched output into
 * a first-class app.cohort_definitions row so downstream analyses (SP3) can
 * consume it. The R worker writes matched rows under a phantom cohort id
 * (9,000,000 + primary_id); this request drives the Laravel side that mints
 * the real cohort_definition and migrates the rows.
 */
class PromoteMatchedCohortRequest extends FormRequest
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
            'run_id' => ['required', 'string', 'size:26'],
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
