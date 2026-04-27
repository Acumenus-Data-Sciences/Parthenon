<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class CohortLintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('studies.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'cohort_definition' => ['required', 'array'],
        ];
    }
}
