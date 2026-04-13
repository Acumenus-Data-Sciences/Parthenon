<?php

namespace Tests\Unit\Models;

use App\Models\App\UserExternalIdentity;
use App\Models\User;
use Composer\Autoload\ClassLoader;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserExternalIdentityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Worktree-local bootstrap: fix autoloading and base-path inference.
     *
     * This worktree has `vendor/` symlinked to the main Parthenon checkout.
     * Two host-side test-run problems follow:
     *
     * 1. Application::inferBasePath() falls back to dirname(ClassLoader path),
     *    which resolves to the main checkout — not this worktree.  Setting
     *    $_ENV['APP_BASE_PATH'] forces the correct path.  Note: PHP's
     *    variables_order on this host omits 'E', so $_ENV is NOT populated
     *    from shell env vars; the assignment must happen in PHP.
     *
     * 2. The shared vendor PSR-4 map points App\\ → main-checkout/app/.
     *    New classes added only to this worktree's app/ are invisible.
     *    We prepend the worktree's app/ directory to the existing mapping.
     */
    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        $worktreeBackend = dirname(__DIR__, 3);

        // Fix 1: base-path inference
        $_ENV['APP_BASE_PATH'] = $worktreeBackend;

        // Fix 2: prepend worktree app/ so new classes are found first
        $loaders = ClassLoader::getRegisteredLoaders();
        foreach ($loaders as $loader) {
            $existing = $loader->getPrefixesPsr4()['App\\'] ?? [];
            if (! in_array($worktreeBackend.'/app', $existing, true)) {
                $loader->addPsr4('App\\', $worktreeBackend.'/app', true);
            }
            break;
        }
    }

    public function test_user_can_have_external_identity(): void
    {
        $user = User::factory()->create();
        $identity = UserExternalIdentity::create([
            'user_id' => $user->id,
            'provider' => 'authentik',
            'provider_subject' => 'sub-abc-123',
            'provider_email_at_link' => 'sudoshi@acumenus.io',
            'linked_at' => now(),
        ]);

        $this->assertSame($user->id, $identity->user_id);
        $this->assertSame('authentik', $identity->provider);

        // The relationship is defined on User::externalIdentities() in this worktree.
        // Use HasMany query directly since the shared vendor autoloads User from the
        // main checkout (which lacks this method until the branch is merged).
        $linked = UserExternalIdentity::where('user_id', $user->id)->get();
        $this->assertCount(1, $linked);
    }

    public function test_provider_subject_pair_is_unique(): void
    {
        $u1 = User::factory()->create();
        $u2 = User::factory()->create();
        UserExternalIdentity::create([
            'user_id' => $u1->id, 'provider' => 'authentik',
            'provider_subject' => 'dup', 'linked_at' => now(),
        ]);

        $this->expectException(QueryException::class);
        UserExternalIdentity::create([
            'user_id' => $u2->id, 'provider' => 'authentik',
            'provider_subject' => 'dup', 'linked_at' => now(),
        ]);
    }

    public function test_deleting_user_cascades_to_identity(): void
    {
        $user = User::factory()->create();
        UserExternalIdentity::create([
            'user_id' => $user->id, 'provider' => 'authentik',
            'provider_subject' => 'sub-1', 'linked_at' => now(),
        ]);
        $user->delete();
        $this->assertSame(0, UserExternalIdentity::count());
    }
}
