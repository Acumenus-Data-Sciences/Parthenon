<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class BundleOverlapRule extends Model
{
    protected $table = 'bundle_overlap_rules';

    protected $fillable = [
        'rule_code',
        'shared_domain',
        'applicable_bundle_codes',
        'canonical_measure_code',
        'description',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'applicable_bundle_codes' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
