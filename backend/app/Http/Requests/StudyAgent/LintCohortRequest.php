<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class LintCohortRequest extends FormRequest
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
