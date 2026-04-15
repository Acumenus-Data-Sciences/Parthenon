<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DraftStudyCohortsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role' => ['nullable', 'string', Rule::in(['target', 'comparator', 'outcome', 'exclusion', 'subgroup', 'event', 'population', 'exposure', 'intervention'])],
        ];
    }
}
