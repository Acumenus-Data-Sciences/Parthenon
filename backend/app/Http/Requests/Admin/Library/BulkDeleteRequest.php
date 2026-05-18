<?php

namespace App\Http\Requests\Admin\Library;

use App\Http\Controllers\Api\V1\Admin\LibraryController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkDeleteRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->hasRole('super-admin');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1|max:200',
            'items.*.type' => ['required', 'string', Rule::in(array_column(LibraryController::TABLES, 'type'))],
            'items.*.id' => 'required|integer|min:1',
        ];
    }
}
