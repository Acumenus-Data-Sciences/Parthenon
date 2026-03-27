<?php

namespace App\Rules;

use App\Models\App\SourceDaimon;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates that a CDM or Results daimon schema is not already
 * registered by another source. Vocabulary schemas are exempt
 * since they are shared reference data.
 */
class UniqueDaimonSchema implements ValidationRule
{
    public function __construct(
        private readonly string $daimonType,
        private readonly ?int $excludeSourceId = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Vocabulary is shared reference data — allow duplicates
        if ($this->daimonType === 'vocabulary') {
            return;
        }

        $query = SourceDaimon::where('daimon_type', $this->daimonType)
            ->where('table_qualifier', $value);

        if ($this->excludeSourceId !== null) {
            $query->where('source_id', '!=', $this->excludeSourceId);
        }

        $conflict = $query->with('source:id,source_name')->first();

        if ($conflict !== null) {
            $sourceName = $conflict->source?->source_name ?? "ID {$conflict->source_id}";
            $fail("Schema '{$value}' is already registered as the {$this->daimonType} schema for source '{$sourceName}' (ID {$conflict->source_id}). Each source must have its own isolated CDM and Results schemas.");
        }
    }
}
