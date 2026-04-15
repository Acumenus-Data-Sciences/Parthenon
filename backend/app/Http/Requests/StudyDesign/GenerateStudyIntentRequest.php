<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;

class GenerateStudyIntentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'research_question' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }
}
