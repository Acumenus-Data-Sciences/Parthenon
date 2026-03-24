<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReleaseRequest extends FormRequest
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
            'release_name' => 'sometimes|string|max:255',
            'cdm_version' => 'nullable|string|max:20',
            'vocabulary_version' => 'nullable|string|max:100',
            'etl_version' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ];
    }
}
