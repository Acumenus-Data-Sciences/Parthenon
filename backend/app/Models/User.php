<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * Force Spatie Permission to use the 'web' guard so role lookups
     * work correctly when authenticated via Sanctum (guard 'sanctum').
     */
    protected string $guard_name = 'web';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'provider',
        'provider_id',
        'last_login_at',
        'must_change_password',
        'onboarding_completed',
        'notification_email',
        'notification_sms',
        'phone_number',
        'notification_preferences',
        'job_title',
        'department',
        'organization',
        'bio',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'onboarding_completed' => 'boolean',
            'notification_email' => 'boolean',
            'notification_sms' => 'boolean',
            'notification_preferences' => 'array',
        ];
    }
}
