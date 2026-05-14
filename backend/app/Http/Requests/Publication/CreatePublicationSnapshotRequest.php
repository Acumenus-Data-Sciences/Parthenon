<?php

namespace App\Http\Requests\Publication;

use Illuminate\Foundation\Http\FormRequest;

class CreatePublicationSnapshotRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route-level auth:sanctum + controller-level authorizeDraftUpdate()
        // enforce access; this request only validates payload shape.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'label' => 'required|string|max:120',
            'comment' => 'nullable|string|max:500',
            'idempotency_key' => 'nullable|uuid',
        ];
    }
}
