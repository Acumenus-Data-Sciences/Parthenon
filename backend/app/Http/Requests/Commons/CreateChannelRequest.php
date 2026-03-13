<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'slug' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/', Rule::unique('commons_channels', 'slug')],
            'description' => 'nullable|string|max:500',
            'type' => 'required|string|in:topic,study,custom',
            'visibility' => 'required|string|in:public,private',
            'study_id' => 'nullable|integer|exists:studies,id',
        ];
    }
}
