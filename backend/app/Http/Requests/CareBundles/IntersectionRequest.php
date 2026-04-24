<?php

declare(strict_types=1);

namespace App\Http\Requests\CareBundles;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IntersectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('care-bundles.view') ?? false;
    }

    /**
     * @return array<string, array<int, string|ValidationRule>>
     */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'bundle_ids' => ['required', 'array', 'min:1', 'max:10'],
            'bundle_ids.*' => ['integer', 'exists:condition_bundles,id'],
            'mode' => ['required', Rule::in(['all', 'any', 'exactly'])],
        ];
    }
}
