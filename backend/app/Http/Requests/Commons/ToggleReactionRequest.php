<?php

namespace App\Http\Requests\Commons;

use App\Models\Commons\Reaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ToggleReactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'emoji' => ['required', 'string', Rule::in(Reaction::ALLOWED_EMOJI)],
        ];
    }
}
