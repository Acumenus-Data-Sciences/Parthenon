<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreReleaseRequest extends FormRequest
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
            'release_name' => 'required|string|max:255',
            'release_type' => 'required|string|in:scheduled_etl,snapshot',
            'cdm_version' => 'nullable|string|max:20',
            'vocabulary_version' => 'nullable|string|max:100',
            'etl_version' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ];
    }
}
