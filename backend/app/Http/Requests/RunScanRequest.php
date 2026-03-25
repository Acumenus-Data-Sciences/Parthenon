<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RunScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // RBAC handled by route middleware
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tables' => ['nullable', 'array'],
            'tables.*' => ['string', 'max:255'],
            'sample_rows' => ['nullable', 'integer', 'min:100', 'max:1000000'],
        ];
    }
}
