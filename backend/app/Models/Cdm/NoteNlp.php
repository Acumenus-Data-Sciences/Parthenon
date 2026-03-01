<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NoteNlp extends CdmModel
{
    protected $table = 'note_nlp';

    protected $primaryKey = 'note_nlp_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Note, $this>
     */
    public function note(): BelongsTo
    {
        return $this->belongsTo(Note::class, 'note_id');
    }
}
