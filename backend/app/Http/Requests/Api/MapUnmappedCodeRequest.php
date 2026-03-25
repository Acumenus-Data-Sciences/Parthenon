<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class MapUnmappedCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'source_code' => ['required', 'string', 'max:255'],
            'source_vocabulary_id' => ['required', 'string', 'max:100'],
            'target_concept_id' => ['required', 'integer', 'min:1'],
            'mapping_method' => ['required', 'string', 'in:manual,ai_suggestion,usagi'],
            'confidence' => ['nullable', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
