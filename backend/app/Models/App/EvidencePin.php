<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EvidencePin extends Model
{
    protected $table = 'evidence_pins';

    protected $fillable = [
        'investigation_id',
        'domain',
        'section',
        'finding_type',
        'finding_payload',
        'sort_order',
        'is_key_finding',
        'narrative_before',
        'narrative_after',
    ];

    protected $casts = [
        'finding_payload' => 'array',
        'is_key_finding' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * @return BelongsTo<Investigation, $this>
     */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class);
    }
}
