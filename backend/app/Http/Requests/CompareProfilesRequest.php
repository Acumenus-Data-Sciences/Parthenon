<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates a cross-source/project scan-profile comparison. The two profile IDs
 * are global (any source or project), unlike the same-source `compare` endpoint.
 */
class CompareProfilesRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route is protected by permission:profiler.view.
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'current' => ['required', 'integer', 'exists:source_profiles,id'],
            'baseline' => ['required', 'integer', 'exists:source_profiles,id'],
        ];
    }
}
