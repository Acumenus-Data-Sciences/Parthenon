<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilarityComputeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'force' => ['sometimes', 'boolean'],
        ];
    }
}
