<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublicationNarrativeRequest extends FormRequest
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
            'section_type' => 'required|string|in:methods,results,discussion,caption',
            'analysis_id' => 'nullable|integer',
            'execution_id' => 'nullable|integer',
            'context' => 'required|array',
        ];
    }
}
