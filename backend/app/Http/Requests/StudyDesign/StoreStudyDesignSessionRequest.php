<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;

class StoreStudyDesignSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'source_mode' => ['nullable', 'string', 'max:80'],
            'settings_json' => ['nullable', 'array'],
        ];
    }
}
