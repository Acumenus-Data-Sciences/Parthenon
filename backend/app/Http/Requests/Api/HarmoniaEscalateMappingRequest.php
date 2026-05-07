<?php

declare(strict_types=1);

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Phase 3 Plan 7 Task 2 (T-024B): escalate a queue row to a senior reviewer.
 *
 * Escalation captures uncertainty without forcing a decision. The note
 * is required so the senior reviewer has context (typically: ambiguous
 * source text, multiple plausible candidates, suspected new vocabulary).
 */
class HarmoniaEscalateMappingRequest extends FormRequest
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
            'note' => ['required', 'string', 'min:3', 'max:2000'],
        ];
    }
}
