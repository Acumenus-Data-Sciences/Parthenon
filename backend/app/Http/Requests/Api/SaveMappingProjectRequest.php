<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class SaveMappingProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'source_terms' => ['required', 'array'],
            'results' => ['required', 'array'],
            'decisions' => ['required', 'array'],
            'target_vocabularies' => ['nullable', 'array'],
            'target_domains' => ['nullable', 'array'],
        ];
    }
}
