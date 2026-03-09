<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PacsConnectionRequest extends FormRequest
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
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');
        $requiredOrSometimes = $isUpdate ? 'sometimes' : 'required';

        return [
            'name' => [$requiredOrSometimes, 'string', 'max:255'],
            'type' => [$requiredOrSometimes, 'string', 'in:orthanc,dicomweb,google_healthcare,cloud_other'],
            'base_url' => [$requiredOrSometimes, 'url', 'max:2000'],
            'auth_type' => ['sometimes', 'string', 'in:none,basic,bearer'],
            'credentials' => ['nullable', 'array'],
            'credentials.username' => ['required_if:auth_type,basic', 'string'],
            'credentials.password' => ['required_if:auth_type,basic', 'string'],
            'credentials.token' => ['required_if:auth_type,bearer', 'string'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'source_id' => ['nullable', 'integer', 'exists:sources,id'],
        ];
    }
}
