<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GenomicUpload extends Model
{
    protected $fillable = [
        'source_id',
        'created_by',
        'filename',
        'file_format',
        'file_size_bytes',
        'status',
        'genome_build',
        'sample_id',
        'total_variants',
        'mapped_variants',
        'review_required',
        'error_message',
        'storage_path',
        'parsed_at',
        'imported_at',
    ];

    protected function casts(): array
    {
        return [
            'file_size_bytes' => 'integer',
            'total_variants' => 'integer',
            'mapped_variants' => 'integer',
            'review_required' => 'integer',
            'parsed_at' => 'datetime',
            'imported_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<GenomicVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(GenomicVariant::class, 'upload_id');
    }
}
