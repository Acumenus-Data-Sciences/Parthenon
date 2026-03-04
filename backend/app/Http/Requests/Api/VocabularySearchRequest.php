<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class VocabularySearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => 'required|string|min:2|max:255',
            'domain' => 'sometimes|string|max:20',
            'vocabulary' => 'sometimes|string|max:20',
            'standard' => 'sometimes|string|in:S,C,true,1',
            'limit' => 'sometimes|integer|min:1|max:100',
            'offset' => 'sometimes|integer|min:0',
        ];
    }
}
