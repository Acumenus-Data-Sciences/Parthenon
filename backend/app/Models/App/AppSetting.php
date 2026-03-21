<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppSetting extends Model
{
    protected $table = 'app_settings';

    protected $fillable = [
        'default_sql_dialect',
        'updated_by',
    ];

    /**
     * Get the singleton settings row.
     */
    public static function instance(): self
    {
        return self::firstOrCreate(['id' => 1], [
            'default_sql_dialect' => 'postgresql',
        ]);
    }

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Available HADES-compliant SQL dialects.
     *
     * @return list<array{value: string, label: string}>
     */
    public static function availableDialects(): array
    {
        return [
            ['value' => 'postgresql', 'label' => 'PostgreSQL'],
            ['value' => 'sql_server', 'label' => 'SQL Server'],
            ['value' => 'oracle', 'label' => 'Oracle'],
            ['value' => 'redshift', 'label' => 'Amazon Redshift'],
            ['value' => 'bigquery', 'label' => 'Google BigQuery'],
            ['value' => 'snowflake', 'label' => 'Snowflake'],
            ['value' => 'synapse', 'label' => 'Azure Synapse'],
            ['value' => 'spark', 'label' => 'Spark / Databricks'],
            ['value' => 'hive', 'label' => 'Apache Hive'],
            ['value' => 'impala', 'label' => 'Apache Impala'],
            ['value' => 'netezza', 'label' => 'IBM Netezza'],
        ];
    }
}
