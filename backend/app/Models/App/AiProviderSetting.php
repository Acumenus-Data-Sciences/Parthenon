<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property array<string, mixed>|null $settings
 */
class AiProviderSetting extends Model
{
    protected $table = 'ai_provider_settings';

    protected $fillable = [
        'provider_type',
        'display_name',
        'is_enabled',
        'is_active',
        'model',
        'settings',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'is_active' => 'boolean',
            'settings' => 'encrypted:array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Sentinel character used to mask secret values in API responses. A value
     * containing this character is a redacted placeholder, never a real secret.
     */
    public const MASK_CHAR = '•';

    /**
     * A settings key is treated as a secret when its name implies a credential.
     * Non-secret keys (base_url, timeout, model, budgets) are returned verbatim.
     */
    public static function isSecretSettingKey(string $key): bool
    {
        $needle = strtolower($key);
        foreach (['key', 'secret', 'token', 'password', 'passwd', 'credential'] as $marker) {
            if (str_contains($needle, $marker)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether a candidate value is a redacted mask rather than a real secret.
     */
    public static function isMaskedValue(mixed $value): bool
    {
        return is_string($value) && str_contains($value, self::MASK_CHAR);
    }

    /**
     * Produce a masked metadata representation of a secret value: bullets plus
     * the last four characters so operators can recognise which key is set
     * without the secret ever leaving the server.
     */
    public static function maskSecret(mixed $value): string
    {
        $str = is_string($value) ? $value : '';
        if ($str === '') {
            return '';
        }

        return strlen($str) > 4
            ? str_repeat(self::MASK_CHAR, 8).substr($str, -4)
            : str_repeat(self::MASK_CHAR, 8);
    }

    /**
     * Mask every secret-looking key inside a settings array.
     *
     * @param  array<string, mixed>|null  $settings
     * @return array<string, mixed>
     */
    public static function maskSettings(?array $settings): array
    {
        $masked = [];
        foreach ($settings ?? [] as $key => $value) {
            $masked[$key] = self::isSecretSettingKey((string) $key)
                ? self::maskSecret($value)
                : $value;
        }

        return $masked;
    }

    /**
     * Serialise the model for admin API responses with all secrets masked.
     *
     * @return array<string, mixed>
     */
    public function toSafeArray(): array
    {
        $data = $this->toArray();
        $data['settings'] = self::maskSettings($this->settings);

        return $data;
    }
}
