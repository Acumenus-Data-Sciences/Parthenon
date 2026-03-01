<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Note extends CdmModel
{
    protected $table = 'note';

    protected $primaryKey = 'note_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Person, $this>
     */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    /**
     * @return BelongsTo<VisitOccurrence, $this>
     */
    public function visitOccurrence(): BelongsTo
    {
        return $this->belongsTo(VisitOccurrence::class, 'visit_occurrence_id');
    }

    /**
     * @return HasMany<NoteNlp, $this>
     */
    public function noteNlps(): HasMany
    {
        return $this->hasMany(NoteNlp::class, 'note_id');
    }
}
