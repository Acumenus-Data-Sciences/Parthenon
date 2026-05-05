<?php

declare(strict_types=1);

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

/**
 * Audit row for a single NER inference invocation. Records the model name,
 * prompt version, token offsets, and concept mappings so a clinical reviewer
 * can replay the inference. Raw note text is kept encrypted (Laravel's
 * encrypted cast) for 30 days then truncated by the daily prune command
 * (Phase 2 Plan 1, decision Q5).
 */
class NoteNlpAudit extends Model
{
    protected $table = 'app.note_nlp_audit';

    public $timestamps = false;

    protected $fillable = [
        'note_nlp_id',
        'model_name',
        'prompt_version',
        'token_offsets',
        'concept_mappings',
        'raw_input',
        'ttl_at',
    ];

    protected $casts = [
        'token_offsets' => 'array',
        'concept_mappings' => 'array',
        'raw_input' => 'encrypted',
        'created_at' => 'datetime',
        'ttl_at' => 'datetime',
    ];
}
