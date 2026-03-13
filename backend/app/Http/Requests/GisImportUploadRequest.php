<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GisImportUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'max:51200', // 50MB
                'mimes:csv,txt,xlsx,xls,json,zip,kml,gpkg',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'Files over 50MB must be uploaded via CLI: php artisan gis:import <file>',
        ];
    }
}
