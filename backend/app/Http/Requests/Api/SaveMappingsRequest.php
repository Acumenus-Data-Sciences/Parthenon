<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class SaveMappingsRequest extends FormRequest
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
            'mappings' => ['required', 'array', 'min:1'],
            'mappings.*.source_code' => ['required', 'string', 'max:50'],
            'mappings.*.source_code_description' => ['nullable', 'string', 'max:255'],
            'mappings.*.target_concept_id' => ['required', 'integer'],
            'mappings.*.target_vocabulary_id' => ['required', 'string', 'max:20'],
            'mappings.*.source_vocabulary_id' => ['sometimes', 'string', 'max:20'],
            'mappings.*.source_concept_id' => ['sometimes', 'integer'],
        ];
    }
}
