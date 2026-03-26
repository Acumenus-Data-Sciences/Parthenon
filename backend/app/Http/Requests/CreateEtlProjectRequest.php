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
            'source_id' => ['nullable', 'integer', 'exists:sources,id'],
            'ingestion_project_id' => ['nullable', 'integer', 'exists:ingestion_projects,id'],
            'cdm_version' => ['required', 'string', 'in:5.4,5.3'],
            'scan_profile_id' => ['nullable', 'integer', 'exists:source_profiles,id'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
