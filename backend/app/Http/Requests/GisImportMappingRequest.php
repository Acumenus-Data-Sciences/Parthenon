<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisImportMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mapping' => ['required', 'array'],
            'mapping.*.purpose' => ['required', Rule::in([
                'geography_code', 'geography_name', 'latitude', 'longitude',
                'value', 'metadata', 'skip',
            ])],
            'mapping.*.geo_type' => ['nullable', 'string'],
            'mapping.*.exposure_type' => ['nullable', 'string'],
        ];
    }
}
