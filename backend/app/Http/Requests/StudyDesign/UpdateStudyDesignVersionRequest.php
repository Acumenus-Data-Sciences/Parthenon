<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStudyDesignVersionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'spec_json' => ['required', 'array'],
        ];
    }
}
