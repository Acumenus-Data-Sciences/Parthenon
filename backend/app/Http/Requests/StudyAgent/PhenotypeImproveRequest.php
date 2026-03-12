<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class PhenotypeImproveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cohort_definition' => ['required', 'array'],
            'study_intent' => ['sometimes', 'string', 'max:5000'],
        ];
    }
}
