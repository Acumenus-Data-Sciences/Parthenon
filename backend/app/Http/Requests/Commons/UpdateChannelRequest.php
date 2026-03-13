<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;

class UpdateChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
        ];
    }
}
