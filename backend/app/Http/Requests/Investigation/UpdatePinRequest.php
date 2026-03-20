<?php

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_key_finding' => ['sometimes', 'boolean'],
            'narrative_before' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'narrative_after' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'section' => ['sometimes', 'string'],
        ];
    }
}
