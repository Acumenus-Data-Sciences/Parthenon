<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingInstance extends Model
{
    protected $fillable = [
        'study_id',
        'series_id',
        'sop_instance_uid',
        'sop_class_uid',
        'instance_number',
        'slice_location',
        'file_path',
    ];

    protected $casts = [
        'instance_number' => 'integer',
        'slice_location' => 'float',
    ];

    public function study(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class);
    }

    public function series(): BelongsTo
    {
        return $this->belongsTo(ImagingSeries::class);
    }
}
