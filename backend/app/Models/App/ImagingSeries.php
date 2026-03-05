<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingSeries extends Model
{
    protected $fillable = [
        'study_id', 'series_instance_uid', 'series_description', 'modality',
        'body_part_examined', 'series_number', 'num_images', 'slice_thickness_mm',
        'manufacturer', 'manufacturer_model', 'orthanc_series_id',
        'pixel_spacing', 'rows_x_cols', 'kvp', 'file_dir',
    ];

    protected function casts(): array
    {
        return [
            'series_number' => 'integer',
            'num_images' => 'integer',
            'slice_thickness_mm' => 'float',
        ];
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function study(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'study_id');
    }

    /** @return \Illuminate\Database\Eloquent\Relations\HasMany<ImagingInstance, $this> */
    public function instances(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ImagingInstance::class, 'series_id')->orderBy('instance_number');
    }
}
