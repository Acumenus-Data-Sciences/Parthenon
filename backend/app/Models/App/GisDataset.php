<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GisDataset extends Model
{
    use HasFactory;

    protected $table = 'app.gis_datasets';

    protected $fillable = [
        'name', 'slug', 'description', 'source', 'source_version',
        'source_url', 'data_type', 'geometry_type', 'file_path',
        'feature_count', 'status', 'error_message', 'loaded_at',
    ];

    protected function casts(): array
    {
        return [
            'loaded_at' => 'datetime',
            'feature_count' => 'integer',
        ];
    }
}
