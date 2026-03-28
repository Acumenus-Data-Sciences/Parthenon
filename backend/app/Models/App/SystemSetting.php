<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class SystemSetting extends Model
{
    protected $table = 'system_settings';

    protected $fillable = [
        'key',
        'value',
        'group',
        'is_secret',
    ];

    protected function casts(): array
    {
        return [
            'is_secret' => 'boolean',
        ];
    }

    /**
     * Get a setting value, decrypting secrets automatically.
     */
    public static function getValue(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();

        if (! $setting || $setting->value === null) {
            return $default;
        }

        if ($setting->is_secret && $setting->value !== '') {
            try {
                return Crypt::decryptString($setting->value);
            } catch (\Throwable) {
                return $default;
            }
        }

        return $setting->value;
    }

    /**
     * Set a setting value, encrypting secrets automatically.
     */
    public static function setValue(string $key, ?string $value, string $group = 'general', bool $isSecret = false): static
    {
        $storedValue = ($isSecret && $value !== null && $value !== '')
            ? Crypt::encryptString($value)
            : $value;

        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $storedValue, 'group' => $group, 'is_secret' => $isSecret],
        );
    }

    /**
     * Get all settings in a group as key => value.
     *
     * @return array<string, mixed>
     */
    public static function getGroup(string $group): array
    {
        $settings = static::where('group', $group)->get();
        $result = [];

        foreach ($settings as $setting) {
            if ($setting->is_secret && $setting->value !== null && $setting->value !== '') {
                try {
                    $result[$setting->key] = Crypt::decryptString($setting->value);
                } catch (\Throwable) {
                    $result[$setting->key] = null;
                }
            } else {
                $result[$setting->key] = $setting->value;
            }
        }

        return $result;
    }
}
