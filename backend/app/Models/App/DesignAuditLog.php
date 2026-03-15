<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Immutable audit log for design entities.
 * Rows are INSERT-only. Never update or delete.
 *
 * @property int $id
 * @property string $entity_type
 * @property int $entity_id
 * @property string $entity_name
 * @property string $action
 * @property int|null $actor_id
 * @property string|null $actor_email
 * @property array|null $old_json
 * @property array|null $new_json
 * @property array|null $changed_fields
 * @property string|null $ip_address
 * @property \Carbon\Carbon $created_at
 */
class DesignAuditLog extends Model
{
    public $timestamps = false; // only created_at, set by DB default

    protected $table = 'design_audit_log';

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'old_json' => 'array',
            'new_json' => 'array',
            'changed_fields' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** @throws \RuntimeException always */
    public function delete(): ?bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    /** @throws \RuntimeException always */
    public function update(array $attributes = [], array $options = []): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    /**
     * Lower-level hook used by Eloquent internally — belt-and-suspenders.
     *
     * @throws \RuntimeException always
     */
    protected function performUpdate(Builder $query): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }
}
