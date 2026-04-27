<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class IntentSplitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('studies.view') ?? false;
    }

    public function rules(): array
    {
        return [
            'intent' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }
}
