<?php

namespace App\Services\Auth\Oidc;

use App\Models\App\OidcEmailAlias;
use App\Models\App\UserExternalIdentity;
use App\Models\User;
use App\Services\Auth\Oidc\Exceptions\OidcAccessDeniedException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Implements the 4-step account reconciliation algorithm for OIDC login.
 *
 * CRITICAL: Reconciliation is additive-only for roles. Linking an existing
 * user via SSO MUST NOT remove or replace any existing role. JIT-created
 * users receive exactly one role: 'admin' (when in Parthenon Admins).
 * 'super-admin' is NEVER granted through this path.
 *
 * Returns a tuple {user, reason} where reason is one of:
 *   linked_by_sub | linked_by_email | linked_by_alias | created_jit
 */
class OidcReconciliationService
{
    private const PROVIDER = 'authentik';

    /**
     * @param  list<string>  $allowedGroups  Groups that authorize JIT account creation
     *                                       (e.g. ['Parthenon Admins']).
     */
    public function __construct(
        private readonly array $allowedGroups = ['Parthenon Admins'],
    ) {}

    /**
     * @return array{user: User, reason: string}
     *
     * @throws OidcAccessDeniedException
     */
    public function reconcile(ValidatedClaims $claims): array
    {
        /** @var array{user: User, reason: string} $result */
        $result = DB::transaction(function () use ($claims): array {
            // 1. Link by prior sub -> identity row.
            $identity = UserExternalIdentity::query()
                ->where('provider', self::PROVIDER)
                ->where('provider_subject', $claims->sub)
                ->first();

            if ($identity !== null) {
                return ['user' => $identity->user, 'reason' => 'linked_by_sub'];
            }

            $canonical = strtolower($claims->email);

            // 2. Exact email match against users.
            $user = User::query()->whereRaw('lower(email) = ?', [$canonical])->first();
            if ($user !== null) {
                $this->createIdentityLink($user->id, $claims);

                return ['user' => $user, 'reason' => 'linked_by_email'];
            }

            // 3. Approved alias -> canonical email -> users.
            $aliased = OidcEmailAlias::canonicalFor($canonical);
            if ($aliased !== null) {
                $user = User::query()->whereRaw('lower(email) = ?', [$aliased])->first();
                if ($user !== null) {
                    $this->createIdentityLink($user->id, $claims);

                    return ['user' => $user, 'reason' => 'linked_by_alias'];
                }
            }

            // 4. JIT-create gated on group membership.
            if (! $this->isGroupAllowed($claims->groups)) {
                throw new OidcAccessDeniedException(
                    'not_in_allowed_group',
                    'User is not in an allowed Parthenon group'
                );
            }

            $user = User::query()->create([
                'name' => $claims->name,
                'email' => $canonical,
                'password' => bcrypt(Str::random(64)),
                'must_change_password' => false,
            ]);

            // Mark as verified: OIDC user came from a trusted IdP.
            // email_verified_at is not in $fillable, so use the standard helper.
            $user->markEmailAsVerified();

            // New users get exactly 'admin' (never super-admin).
            $user->assignRole('admin');

            $this->createIdentityLink($user->id, $claims);

            return ['user' => $user, 'reason' => 'created_jit'];
        });

        return $result;
    }

    private function createIdentityLink(int $userId, ValidatedClaims $claims): void
    {
        UserExternalIdentity::query()->create([
            'user_id' => $userId,
            'provider' => self::PROVIDER,
            'provider_subject' => $claims->sub,
            'provider_email_at_link' => $claims->email,
            'linked_at' => now(),
        ]);
    }

    /**
     * @param  list<string>  $tokenGroups
     */
    private function isGroupAllowed(array $tokenGroups): bool
    {
        foreach ($this->allowedGroups as $allowed) {
            if (in_array($allowed, $tokenGroups, true)) {
                return true;
            }
        }

        return false;
    }
}
