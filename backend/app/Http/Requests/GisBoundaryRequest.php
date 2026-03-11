<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisBoundaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'level' => ['sometimes', Rule::in(['ADM0', 'ADM1', 'ADM2', 'ADM3', 'ADM4', 'ADM5'])],
            'country_code' => ['sometimes', 'string', 'size:3'],
            'parent_gid' => ['sometimes', 'string'],
            'bbox' => ['sometimes', 'string', 'regex:/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/'],
            'simplify' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
