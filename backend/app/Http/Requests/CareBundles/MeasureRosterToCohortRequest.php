<?php

declare(strict_types=1);

namespace App\Http\Requests\CareBundles;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MeasureRosterToCohortRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('care-bundles.create-cohort') ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id,deleted_at,NULL'],
            'bucket' => ['required', Rule::in(['non_compliant', 'compliant', 'excluded'])],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_public' => ['nullable', 'boolean'],
        ];
    }
}
