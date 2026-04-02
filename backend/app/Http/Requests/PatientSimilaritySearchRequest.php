<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilaritySearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'person_id' => ['required', 'integer'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'mode' => ['sometimes', 'string', 'in:interpretable,embedding'],
            'weights' => ['sometimes', 'array'],
            'weights.*' => ['numeric', 'min:0', 'max:10'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'filters' => ['sometimes', 'array'],
            'filters.age_range' => ['sometimes', 'array', 'size:2'],
            'filters.age_range.*' => ['integer', 'min:0', 'max:150'],
            'filters.gender_concept_id' => ['sometimes', 'integer'],
        ];
    }
}
