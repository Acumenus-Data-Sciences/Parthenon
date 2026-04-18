<?php

declare(strict_types=1);

namespace App\Http\Requests\FinnGen;

use Illuminate\Foundation\Http\FormRequest;

class DispatchEndpointGwasRequest extends FormRequest
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
            'source_key' => ['required', 'string', 'max:64', 'regex:/^[A-Z][A-Z0-9_]*$/'],
            'control_cohort_id' => ['required', 'integer', 'min:1', 'max:99999999999'],
            'covariate_set_id' => ['nullable', 'integer', 'min:1'],
            'overwrite' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'source_key.regex' => 'source_key must be uppercase letters, digits, or underscores, and start with a letter (matches app.sources.source_key convention).',
            'control_cohort_id.max' => 'control_cohort_id must be < 100_000_000_000. FinnGen-endpoint-backed cohorts (the 100B-offset range) are case candidates, not controls.',
        ];
    }
}
