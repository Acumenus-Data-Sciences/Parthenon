<?php

namespace App\Http\Requests\StudyDesign;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class LockStudyDesignVersionRequest extends FormRequest
{
    public function authorize(): bool
    {
        // RBAC enforced at the route via permission:studies.create middleware.
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'if_unmodified_since' => ['nullable', 'string', $this->isoDateRule()],
        ];
    }

    private function isoDateRule(): ValidationRule
    {
        return new class implements ValidationRule
        {
            public function validate(string $attribute, mixed $value, Closure $fail): void
            {
                if (! is_string($value) || $value === '') {
                    $fail("The {$attribute} field must be a valid ISO 8601 timestamp.");

                    return;
                }

                try {
                    CarbonImmutable::parse($value);
                } catch (\Throwable) {
                    $fail("The {$attribute} field must be a valid ISO 8601 timestamp.");
                }
            }
        };
    }
}
