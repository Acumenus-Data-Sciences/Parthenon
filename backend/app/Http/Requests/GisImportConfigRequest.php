<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisImportConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'layer_name' => ['required', 'string', 'max:100'],
            'exposure_type' => ['required', 'string', 'max:50'],
            'geography_level' => ['required', 'string'],
            'value_type' => ['required', Rule::in(['continuous', 'categorical', 'binary'])],
            'aggregation' => ['required', Rule::in(['sum', 'mean', 'max', 'min', 'latest'])],
        ];
    }
}
