<?php

namespace App\Services\Profiler;

use App\Models\App\SourceProfile;
use Illuminate\Support\Facades\Log;

class PiiDetectionService
{
    /** @var array<string, string> Column name patterns → PII type */
    private const NAME_PATTERNS = [
        '/ssn|social.?sec/i' => 'ssn',
        '/\bemail\b/i' => 'email',
        '/phone|mobile|fax/i' => 'phone',
        '/\bmrn\b|medical.?record/i' => 'mrn',
        '/first.?name|last.?name|full.?name/i' => 'name',
        '/\baddr\b|street|zip.?code|postal/i' => 'address',
        '/\bdob\b|date.?of.?birth|birth.?date/i' => 'dob',
        '/\bip.?addr/i' => 'ip_address',
    ];

    /** @var array<string, string> Sample value patterns → PII type */
    private const VALUE_PATTERNS = [
        '/^\d{3}-\d{2}-\d{4}$/' => 'ssn',
        '/^[^@]+@[^@]+\.[^@]+$/' => 'email',
        '/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/' => 'phone',
        '/^\d{5}(-\d{4})?$/' => 'zip',
    ];

    /** OMOP CDM columns expected to hold source identifiers — not flagged */
    private const CDM_ALLOWLIST_PATTERN = '/_source_value$/';

    public function detectAndFlag(SourceProfile $profile): void
    {
        $fields = $profile->fields()->get();
        $flaggedCount = 0;

        foreach ($fields as $field) {
            // Skip OMOP CDM allowlisted columns
            if (preg_match(self::CDM_ALLOWLIST_PATTERN, $field->column_name)) {
                continue;
            }

            $piiType = $this->detectByName($field->column_name)
                ?? $this->detectByValues($field->sample_values);

            if ($piiType !== null) {
                $field->update([
                    'is_potential_pii' => true,
                    'pii_type' => $piiType,
                    'sample_values' => ['[REDACTED — potential PII]' => 0],
                ]);
                $flaggedCount++;
            }
        }

        if ($flaggedCount > 0) {
            Log::info('PII detection completed', [
                'profile_id' => $profile->id,
                'flagged_columns' => $flaggedCount,
            ]);
        }
    }

    private function detectByName(string $columnName): ?string
    {
        foreach (self::NAME_PATTERNS as $pattern => $type) {
            if (preg_match($pattern, $columnName)) {
                return $type;
            }
        }

        return null;
    }

    /**
     * @param  array<string, int>|null  $sampleValues
     */
    private function detectByValues(?array $sampleValues): ?string
    {
        if (empty($sampleValues)) {
            return null;
        }

        // Check the top 5 sample value keys against patterns
        $keys = array_slice(array_keys($sampleValues), 0, 5);
        foreach ($keys as $value) {
            $value = (string) $value;
            foreach (self::VALUE_PATTERNS as $pattern => $type) {
                if (preg_match($pattern, $value)) {
                    return $type;
                }
            }
        }

        return null;
    }
}
