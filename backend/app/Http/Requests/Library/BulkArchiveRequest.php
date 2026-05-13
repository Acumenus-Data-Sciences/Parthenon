<?php

namespace App\Http\Requests\Library;

use Illuminate\Foundation\Http\FormRequest;

class BulkArchiveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, string|array<int, string>>
     */
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'integer',
        ];
    }
}
