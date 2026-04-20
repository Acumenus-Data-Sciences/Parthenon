<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImagingStudy extends Model
{
    protected $fillable = [
        'source_id', 'person_id', 'study_instance_uid', 'accession_number',
        'modality', 'body_part_examined', 'study_description', 'referring_physician',
        'study_date', 'num_series', 'num_images', 'orthanc_study_id', 'wadors_uri',
        'status', 'image_occurrence_id',
        'patient_name_dicom', 'patient_id_dicom', 'institution_name', 'file_dir',
    ];

    protected function casts(): array
    {
        return [
            'study_date' => 'date',
            'num_series' => 'integer',
            'num_images' => 'integer',
            'person_id' => 'integer',
            'image_occurrence_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return HasMany<ImagingSeries, $this> */
    public function series(): HasMany
    {
        return $this->hasMany(ImagingSeries::class, 'study_id')
            ->orderByRaw('series_number IS NULL')
            ->orderBy('series_number')
            ->orderBy('id');
    }

    /** @return HasMany<ImagingProcedureOmopXref, $this> */
    public function omopProcedureXrefs(): HasMany
    {
        return $this->hasMany(ImagingProcedureOmopXref::class, 'study_id');
    }

    /** @return HasMany<ImagingFeature, $this> */
    public function features(): HasMany
    {
        return $this->hasMany(ImagingFeature::class, 'study_id');
    }

    /** @return HasMany<ImagingInstance, $this> */
    public function instances(): HasMany
    {
        return $this->hasMany(ImagingInstance::class, 'study_id');
    }

    /** @return HasMany<ImagingMeasurement, $this> */
    public function measurements(): HasMany
    {
        return $this->hasMany(ImagingMeasurement::class, 'study_id');
    }
}
