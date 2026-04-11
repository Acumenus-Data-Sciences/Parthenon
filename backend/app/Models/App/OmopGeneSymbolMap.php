<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class OmopGeneSymbolMap extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'omop_gene_symbol_map';

    protected $primaryKey = 'gene_symbol';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'gene_symbol',
        'hgnc_id',
        'hgnc_symbol',
        'notes',
    ];
}
