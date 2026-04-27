<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class ConceptSetReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('studies.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'concept_set' => ['required', 'array'],
        ];
    }
}
