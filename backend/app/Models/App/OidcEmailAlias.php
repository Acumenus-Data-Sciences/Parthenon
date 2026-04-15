<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class OidcEmailAlias extends Model
{
    protected $table = 'oidc_email_aliases';

    protected $fillable = ['alias_email', 'canonical_email', 'note'];

    public static function canonicalFor(string $email): ?string
    {
        $row = static::whereRaw('lower(alias_email) = ?', [strtolower($email)])->first();

        return $row?->canonical_email;
    }
}
