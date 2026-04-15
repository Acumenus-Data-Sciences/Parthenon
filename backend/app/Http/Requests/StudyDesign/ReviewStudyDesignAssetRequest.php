<?php

namespace App\Http\Requests\StudyDesign;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewStudyDesignAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['accept', 'reject', 'defer'])],
            'review_notes' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
