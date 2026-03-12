<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class PhenotypeRecommendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'study_intent' => ['required', 'string', 'min:10', 'max:5000'],
            'search_results' => ['sometimes', 'array'],
        ];
    }
}
