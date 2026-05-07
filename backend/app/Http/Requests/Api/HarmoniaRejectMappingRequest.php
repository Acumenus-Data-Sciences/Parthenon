<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 3 Plan 7 Task 2 (T-024B): reject all Harmonia suggestions for a queue row.
 *
 * `rejection_reason` is required so the reviewer audit trail captures
 * intent — "none of these are right" is a valid reason but must be
 * stated explicitly, not implied by absence.
 */
class HarmoniaRejectMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'rejection_reason' => ['required', 'string', 'min:3', 'max:2000'],
        ];
    }
}
