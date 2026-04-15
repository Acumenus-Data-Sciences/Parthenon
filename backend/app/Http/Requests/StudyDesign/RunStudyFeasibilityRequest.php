<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;

class RunStudyFeasibilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source_ids' => ['required', 'array', 'min:1'],
            'source_ids.*' => ['integer', 'distinct', 'exists:sources,id'],
            'min_cell_count' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
