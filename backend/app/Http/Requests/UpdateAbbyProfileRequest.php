<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAbbyProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'research_interests' => ['sometimes', 'array'],
            'research_interests.*' => ['string', 'max:200'],
            'expertise_domains' => ['sometimes', 'array'],
            'interaction_preferences' => ['sometimes', 'array'],
            'interaction_preferences.verbosity' => ['sometimes', 'in:terse,normal,verbose'],
        ];
    }
}
