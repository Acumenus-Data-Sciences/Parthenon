<?php

namespace App\Http\Requests\Aqueduct;

use Illuminate\Foundation\Http\FormRequest;

class AqueductGenerateLookupsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'vocabularies' => ['required', 'array', 'min:1'],
            'vocabularies.*' => ['required', 'string', 'regex:/^[a-z0-9]+$/'],
            'include_source_to_source' => ['sometimes', 'boolean'],
            'vocab_schema' => ['sometimes', 'string', 'regex:/^[a-z0-9_]+$/'],
        ];
    }
}
