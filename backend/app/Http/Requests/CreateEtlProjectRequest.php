<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateEtlProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // RBAC handled by route middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'cdm_version' => ['required', 'string', 'in:5.4,5.3'],
            'scan_profile_id' => ['required', 'integer', 'exists:source_profiles,id'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
