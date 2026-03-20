<?php

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvestigationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'research_question' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
