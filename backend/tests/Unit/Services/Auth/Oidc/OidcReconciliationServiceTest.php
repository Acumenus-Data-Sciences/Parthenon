<?php

namespace Tests\Unit\Services\Auth\Oidc;

use App\Models\App\UserExternalIdentity;
use App\Models\User;
use App\Services\Auth\Oidc\Exceptions\OidcAccessDeniedException;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\ValidatedClaims;
use Database\Seeders\OidcEmailAliasSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class OidcReconciliationServiceTest extends TestCase
{
    use RefreshDatabase;

    private OidcReconciliationService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = new OidcReconciliationService(['Parthenon Admins']);

        // Ensure the roles we care about exist.
        foreach (['admin', 'super-admin', 'researcher', 'viewer'] as $name) {
            Role::findOrCreate($name, 'web');
        }
    }

    public function test_existing_identity_link_returns_same_user_without_mutation(): void
    {
        $user = User::factory()->create(['email' => 'admin@acumenus.net']);
        $user->assignRole('super-admin');
        UserExternalIdentity::create([
            'user_id' => $user->id,
            'provider' => 'authentik',
            'provider_subject' => 'sub-1',
            'provider_email_at_link' => 'sudoshi@acumenus.io',
            'linked_at' => now(),
        ]);

        $before = User::count();
        $beforeIds = UserExternalIdentity::count();
        $beforeRoles = $user->roles->pluck('name')->sort()->values()->all();

        $result = $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-1',
            email: 'sudoshi@acumenus.io',
            name: 'Sanjay Udoshi',
            groups: ['Parthenon Admins'],
        ));

        $this->assertSame('linked_by_sub', $result['reason']);
        $this->assertSame($user->id, $result['user']->id);
        $this->assertSame($before, User::count());
        $this->assertSame($beforeIds, UserExternalIdentity::count());
        $this->assertSame($beforeRoles, $user->fresh()->roles->pluck('name')->sort()->values()->all());
    }

    public function test_linked_by_email_creates_identity_row_and_preserves_roles(): void
    {
        $user = User::factory()->create(['email' => 'jdawe@acumenus.io']);
        $user->assignRole('super-admin');
        $user->assignRole('researcher');

        $result = $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-john',
            email: 'jdawe@acumenus.io',
            name: 'John Dawe',
            groups: ['Parthenon Admins'],
        ));

        $this->assertSame('linked_by_email', $result['reason']);
        $this->assertSame($user->id, $result['user']->id);
        $this->assertSame(
            ['researcher', 'super-admin'],
            $user->fresh()->roles->pluck('name')->sort()->values()->all(),
            'roles must be preserved byte-for-byte, with no added admin'
        );
        $this->assertSame(1, UserExternalIdentity::where('user_id', $user->id)->count());
    }

    public function test_linked_by_alias_links_to_canonical_row_and_preserves_super_admin(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);

        // Canonical prod user: Sanjay as admin@acumenus.net with super-admin.
        $user = User::factory()->create(['email' => 'admin@acumenus.net']);
        $user->assignRole('super-admin');

        $result = $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-sanjay',
            email: 'sudoshi@acumenus.io', // Authentik work email
            name: 'Sanjay Udoshi',
            groups: ['Parthenon Admins', 'authentik Admins'],
        ));

        $this->assertSame('linked_by_alias', $result['reason']);
        $this->assertSame($user->id, $result['user']->id);
        $this->assertTrue($user->fresh()->hasRole('super-admin'), 'super-admin must survive');
        $this->assertFalse($user->fresh()->hasRole('admin'), 'admin must NOT be auto-added to existing users');
        $this->assertSame(1, UserExternalIdentity::where('user_id', $user->id)->count());
    }

    public function test_jit_creates_user_with_admin_only_when_in_parthenon_admins(): void
    {
        $result = $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-lisa',
            email: 'lmiller@acumenus.net',
            name: 'Lisa Miller',
            groups: ['Parthenon Admins'],
        ));

        $this->assertSame('created_jit', $result['reason']);
        $this->assertSame('lmiller@acumenus.net', $result['user']->email);
        $this->assertSame(
            ['admin'],
            $result['user']->roles->pluck('name')->sort()->values()->all(),
            'JIT users receive exactly admin — never super-admin'
        );
        $this->assertFalse($result['user']->must_change_password);
        $this->assertNotNull($result['user']->email_verified_at);
    }

    public function test_jit_rejected_when_not_in_allowed_group(): void
    {
        $before = User::count();
        $beforeIds = UserExternalIdentity::count();

        $this->expectException(OidcAccessDeniedException::class);

        try {
            $this->svc->reconcile(new ValidatedClaims(
                sub: 'sub-new',
                email: 'stranger@example.com',
                name: 'Stranger',
                groups: ['authentik Admins'], // not Parthenon Admins
            ));
        } finally {
            $this->assertSame($before, User::count(), 'no user created on rejection');
            $this->assertSame($beforeIds, UserExternalIdentity::count(), 'no identity row on rejection');
        }
    }

    public function test_email_comparison_is_case_insensitive_via_alias(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $user = User::factory()->create(['email' => 'david.muraco@gmail.com']);
        $user->assignRole('super-admin');

        $result = $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-david',
            email: 'DMURACO@ACUMENUS.IO',
            name: 'David Muraco',
            groups: ['Parthenon Admins'],
        ));

        $this->assertSame('linked_by_alias', $result['reason']);
        $this->assertSame($user->id, $result['user']->id);
    }

    public function test_idempotent_when_called_twice_with_same_sub(): void
    {
        $user = User::factory()->create(['email' => 'jdawe@acumenus.io']);
        $user->assignRole('researcher');

        $claims = new ValidatedClaims('sub-dup', 'jdawe@acumenus.io', 'John Dawe', ['Parthenon Admins']);

        $r1 = $this->svc->reconcile($claims);
        $r2 = $this->svc->reconcile($claims);

        $this->assertSame($user->id, $r1['user']->id);
        $this->assertSame($user->id, $r2['user']->id);
        $this->assertSame('linked_by_email', $r1['reason']);
        $this->assertSame('linked_by_sub', $r2['reason']);
        $this->assertSame(1, UserExternalIdentity::where('user_id', $user->id)->count());
    }

    public function test_authentik_admins_alone_is_not_sufficient_for_jit(): void
    {
        $this->expectException(OidcAccessDeniedException::class);
        $this->svc->reconcile(new ValidatedClaims(
            sub: 'sub-x', email: 'x@example.com', name: 'X',
            groups: ['authentik Admins'],
        ));
    }
}
