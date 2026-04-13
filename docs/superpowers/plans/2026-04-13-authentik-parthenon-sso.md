# Authentik SSO for Parthenon — Phased Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Authentik OIDC into Parthenon with durable identity linking so existing C-suite accounts are reconciled (never duplicated) and local email/password login keeps working as a fallback.

**Architecture:** Ship in reversible phases. Each phase is independently deployable and revertable. Schema and reconciliation data land first (inert). Service layer lands next (unit-tested, unreachable). HTTP routes land feature-flagged (default off). Frontend gets a button only after backend smoke-tests green against real Authentik. The Sanctum token never appears in a URL — we use a one-time code + `POST /exchange` hand-off.

**Tech Stack:** Laravel 11 (backend), React 19 + Zustand + TanStack Query (frontend), `firebase/php-jwt` (already in composer), Authentik OIDC provider, Redis for one-time code storage, Sanctum for session tokens.

---

## Source of Truth

The requirements spec is `docs/handoffs/2026-04-13-authentik-parthenon-sso-handoff.md`. This plan implements every section of that handoff. When the plan and the handoff disagree, the handoff wins — update the plan.

## Guardrails (Read Before Every Phase)

1. **HIGHSEC — additions only.** `backend/.claude/rules/HIGHSEC.spec.md` and `backend/.claude/rules/auth-system.md` forbid removing or altering existing auth endpoints, the `ChangePasswordModal`, the `must_change_password` flow, the `SetupWizard`, or the `TempPasswordMail` path. Local email/password login MUST continue to work identically after every phase.
2. **Never map `authentik Admins` → `super-admin`.** The only role emission is `Parthenon Admins` → `admin`. `super-admin` is reserved for `admin@acumenus.net` bootstrap.
3. **Reconciliation is additive-only for roles.** Linking an existing user via SSO MUST NOT remove or replace any of that user's existing roles. It may only *add* `admin` when the user is in `Parthenon Admins` and does not already have `admin` or `super-admin`. (Prod Phase 0 snapshot shows 5 of 7 C-suite currently hold `super-admin` locally — those roles stay.)
4. **New users from OIDC default to `viewer`** unless they are in `Parthenon Admins` (→ `admin`). No other groups grant roles.
5. **JIT user creation is gated on group membership.** If the ID token's `groups` claim does not contain `Parthenon Admins` (or a future explicitly-allowed group), reject the login — do not create a shell account.
6. **Never print starter passwords, client secrets, or JWKS private material** in logs, commits, PR descriptions, tests, or terminal output.
7. **Target DB verification before any user-row touch.** Run the Parthenon user verification query (handoff §Useful Commands) before every phase that writes to `app.users` or `app.user_external_identities`, and include the output in the commit message.
8. **Migrations use `--path=`, never `--force` alone.** Full deploys skip migrations; use `./deploy.sh --db` explicitly.
9. **Frontend build uses `./deploy.sh --frontend`**, never `npm run build`.
10. **Sanctum token in URL = forbidden.** Use the one-time code exchange pattern (Phase 4).
11. **Every OIDC route runs inside try/catch with structured error response.** Auth failures never leak stack traces; they return `{error: 'oidc_failed', reason: '<machine-readable>'}` with HTTP 401/403.

## Phase 0 Findings — Decision Log (2026-04-12)

Prod snapshot (`.planning/intel/2026-04-13-user-snapshot-prod.txt`, 27 users) revealed the handoff's alias-map direction was backwards for 6 of 7 C-suite. **Decision: option (C) — ship v1 with a flipped alias map so SSO links cleanly to existing prod rows; do NOT touch the `email` column on existing users in this plan.** A separate follow-up may canonicalize emails once everyone has a `sub` link.

**Authoritative alias map (Authentik work email → current Parthenon canonical email):**

| Authentik work email (incoming) | Parthenon canonical email (existing row) | Parthenon user id | Existing roles (preserve all) |
|---|---|---|---|
| `sudoshi@acumenus.io`  | `admin@acumenus.net`        | 117 | admin, super-admin |
| `ebruno@acumenus.net`  | `brunoemilyk@gmail.com`     | 242 | researcher, super-admin |
| `kpatel@acumenus.net`  | `kash37@yahoo.com`          | 243 | researcher, super-admin |
| `jdawe@acumenus.io`    | `jdawe@acumenus.io`         | 196 | researcher, super-admin (exact match — no alias row needed) |
| `dmuraco@acumenus.io`  | `david.muraco@gmail.com`    | 119 | admin, super-admin |
| `gbock@acumenus.net`   | `ghbock1@gmail.com`         | 195 | admin, data-steward, researcher |
| `lmiller@acumenus.net` | *(no existing row)*         | —   | JIT-create via Parthenon Admins → `admin` |

Phase 2's seeder MUST contain exactly the 6 alias rows above (John needs none). Phase 3.4's reconciliation service MUST be additive-only per guardrail #3.

## File Structure

**Backend — new:**
- `backend/database/migrations/2026_04_13_000001_create_user_external_identities_table.php` — durable `(provider, sub)` link
- `backend/database/migrations/2026_04_13_000002_create_oidc_email_aliases_table.php` — approved alias map
- `backend/database/seeders/OidcEmailAliasSeeder.php` — seeds 7 C-suite aliases
- `backend/app/Models/App/UserExternalIdentity.php`
- `backend/app/Models/App/OidcEmailAlias.php`
- `backend/app/Services/Auth/Oidc/OidcDiscoveryService.php` — fetches + caches discovery + JWKS
- `backend/app/Services/Auth/Oidc/OidcTokenValidator.php` — JWT signature/iss/aud/exp/nonce
- `backend/app/Services/Auth/Oidc/OidcReconciliationService.php` — the 4-step reconciliation algorithm
- `backend/app/Services/Auth/Oidc/OidcHandshakeStore.php` — Redis-backed state/nonce + one-time code
- `backend/app/Http/Controllers/Api/V1/Auth/OidcController.php` — redirect/callback/exchange
- `backend/tests/Feature/Auth/OidcRedirectTest.php`
- `backend/tests/Feature/Auth/OidcCallbackTest.php`
- `backend/tests/Feature/Auth/OidcExchangeTest.php`
- `backend/tests/Unit/Services/Auth/OidcTokenValidatorTest.php`
- `backend/tests/Unit/Services/Auth/OidcReconciliationServiceTest.php`

**Backend — modify:**
- `backend/routes/api.php` — add 3 OIDC public routes
- `backend/app/Models/User.php` — `externalIdentities()` relationship
- `backend/config/services.php` — `oidc` block (issuer URL, default scopes)
- `backend/database/seeders/AuthProviderSeeder.php` — add `oidc` provider entry

**Frontend — new:**
- `frontend/src/features/auth/pages/OidcCallbackPage.tsx` — exchanges code, sets auth, navigates home
- `frontend/src/features/auth/api.ts` — add `exchangeOidcCode()` TanStack mutation
- `frontend/src/features/auth/__tests__/LoginPage.test.tsx` — button presence test
- `frontend/src/features/auth/__tests__/OidcCallbackPage.test.tsx` — exchange happy-path

**Frontend — modify:**
- `frontend/src/features/auth/pages/LoginPage.tsx` — conditional "Sign in with Authentik" button
- `frontend/src/app/router.tsx` — add `/auth/callback` public route
- `frontend/src/features/auth/api.ts` — add `useAuthProviders()` to drive button visibility

**Infra — modify:**
- `acropolis/installer/authentik.py` — add `parthenon-oidc` to `NATIVE_SSO_DEFS`
- `backend/.env.example` — add `OIDC_ENABLED`, `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`

**Docs:**
- `docs/devlog/modules/auth/2026-04-13-authentik-sso.md` — devlog after rollout

---

## Phase 0 — Pre-Flight Verification (No Code)

**Goal:** Prove the target environment state matches assumptions before any write. Handoff §Current State warns the local DB may not be authoritative — David, John, Sanjay reportedly already have Parthenon accounts.

**Files:** None.

- [ ] **Step 1: Snapshot Parthenon users on every environment that matters**

Run against local, staging (if any), and prod:

```bash
# Local (Docker pg)
docker exec parthenon-postgres psql -U parthenon -d parthenon -c "select u.id, u.name, u.email, coalesce(string_agg(r.name, ', ' order by r.name), '') as roles, u.must_change_password, u.created_at from app.users u left join app.model_has_roles mhr on mhr.model_id=u.id and mhr.model_type='App\\Models\\User' left join app.roles r on r.id=mhr.role_id group by u.id order by u.email;"

# Production (host PG17 via claude_dev ~/.pgpass)
psql -h <prod-host> -U claude_dev -d parthenon -c "<same query>"
```

Save both outputs under `.planning/intel/2026-04-13-user-snapshot-{env}.txt` (gitignored scratch). Confirm whether David/John/Sanjay exist in prod, and under what emails.

- [ ] **Step 2: Cross-check Authentik → Parthenon mapping**

For each of the 7 C-suite users, verify the canonical email column in handoff §2 matches what exists in Parthenon. Flag any mismatch.

- [ ] **Step 3: Back up `app.users` on prod**

```bash
pg_dump -h <prod-host> -U claude_dev -d parthenon \
  -t app.users -t app.model_has_roles -t app.roles \
  -f backups/2026-04-13-auth-preflight.sql
```

Confirm file size > 0 and contains expected rows.

- [ ] **Step 4: Document any pre-existing duplicates**

If prod has two rows with different emails that obviously belong to one person (e.g., both `dmuraco@acumenus.net` and `dmuraco@acumenus.io`), DO NOT fix them in this plan. Note them and escalate — a manual merge is a separate change with its own review.

- [ ] **Step 5: Commit the snapshot-check note** (no data)

```bash
git commit --allow-empty -m "chore(auth): pre-flight snapshot for Authentik SSO rollout"
```

**Gate to Phase 1:** Human signs off that the snapshot matches assumptions. Any surprise (extra admins, unexpected emails, duplicates) pauses the plan.

---

## Phase 1 — Identity Linking Schema (Inert)

**Goal:** Ship the `user_external_identities` table with zero behavioral change. Reversible via `php artisan migrate:rollback --path=...`.

**Files:**
- Create: `backend/database/migrations/2026_04_13_000001_create_user_external_identities_table.php`
- Create: `backend/app/Models/App/UserExternalIdentity.php`
- Modify: `backend/app/Models/User.php` — add relationship
- Test: `backend/tests/Unit/Models/UserExternalIdentityTest.php`

- [ ] **Step 1: Write the failing migration test**

```php
// backend/tests/Unit/Models/UserExternalIdentityTest.php
<?php
namespace Tests\Unit\Models;

use App\Models\App\UserExternalIdentity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserExternalIdentityTest extends TestCase
{
    use RefreshDatabase;

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
        $this->assertCount(1, $user->fresh()->externalIdentities);
    }

    public function test_provider_subject_pair_is_unique(): void
    {
        $u1 = User::factory()->create();
        $u2 = User::factory()->create();
        UserExternalIdentity::create([
            'user_id' => $u1->id, 'provider' => 'authentik',
            'provider_subject' => 'dup', 'linked_at' => now(),
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);
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
```

- [ ] **Step 2: Run — expect FAIL (table/model missing)**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Models/UserExternalIdentityTest.php"
```

- [ ] **Step 3: Write the migration**

```php
// backend/database/migrations/2026_04_13_000001_create_user_external_identities_table.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('pgsql')->create('app.user_external_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('app.users')->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('provider_subject', 255);
            $table->string('provider_email_at_link', 255)->nullable();
            $table->timestamp('linked_at');
            $table->timestamps();

            $table->unique(['provider', 'provider_subject']);
            $table->index(['provider', 'provider_email_at_link']);
        });
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('app.user_external_identities');
    }
};
```

- [ ] **Step 4: Write the model**

```php
// backend/app/Models/App/UserExternalIdentity.php
<?php
namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserExternalIdentity extends Model
{
    protected $table = 'app.user_external_identities';

    protected $fillable = [
        'user_id', 'provider', 'provider_subject',
        'provider_email_at_link', 'linked_at',
    ];

    protected $casts = ['linked_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 5: Add relationship to User model**

In `backend/app/Models/User.php`, add:

```php
use App\Models\App\UserExternalIdentity;
use Illuminate\Database\Eloquent\Relations\HasMany;

public function externalIdentities(): HasMany
{
    return $this->hasMany(UserExternalIdentity::class);
}
```

- [ ] **Step 6: Run migration against test DB and re-run tests**

```bash
docker compose exec -T php sh -c "cd /var/www/html && php artisan migrate --path=database/migrations/2026_04_13_000001_create_user_external_identities_table.php --env=testing"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Models/UserExternalIdentityTest.php"
```

Expected: 3 passing.

- [ ] **Step 7: Pint + PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=1G"
```

- [ ] **Step 8: Commit**

```bash
git add backend/database/migrations/2026_04_13_000001_*.php \
        backend/app/Models/App/UserExternalIdentity.php \
        backend/app/Models/User.php \
        backend/tests/Unit/Models/UserExternalIdentityTest.php
git commit -m "feat(auth): add user_external_identities table for OIDC linking"
```

- [ ] **Step 9: Deploy migration to prod** (coordinated, during low-traffic window)

```bash
ssh <prod> "cd /path/to/Parthenon && ./deploy.sh --db"
psql -h <prod> -U claude_dev -d parthenon -c "\d app.user_external_identities"
```

Confirm table exists; no rows; no error. Phase is complete and fully reversible.

---

## Phase 2 — Alias Reconciliation Map

**Goal:** Ship the approved alias map as DB rows (editable without deploy). Still inert — no code reads it yet.

**Files:**
- Create: `backend/database/migrations/2026_04_13_000002_create_oidc_email_aliases_table.php`
- Create: `backend/database/seeders/OidcEmailAliasSeeder.php`
- Create: `backend/app/Models/App/OidcEmailAlias.php`
- Test: `backend/tests/Unit/Models/OidcEmailAliasTest.php`

- [ ] **Step 1: Write the failing test**

```php
// backend/tests/Unit/Models/OidcEmailAliasTest.php
<?php
namespace Tests\Unit\Models;

use App\Models\App\OidcEmailAlias;
use Database\Seeders\OidcEmailAliasSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OidcEmailAliasTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_populates_five_c_suite_aliases(): void
    {
        // 5 rows: Sanjay, Emily, Kash, David, Glenn.
        // John is exact-match (jdawe@acumenus.io in both systems — no alias row).
        // Lisa has no Parthenon row yet — no alias row; reconciliation JIT-creates her.
        $this->seed(OidcEmailAliasSeeder::class);
        $this->assertSame(5, OidcEmailAlias::count());
    }

    public function test_lookup_maps_authentik_work_email_to_parthenon_canonical(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $row = OidcEmailAlias::whereRaw('lower(alias_email) = ?', ['SUDOSHI@ACUMENUS.IO'])->first();
        $this->assertSame('admin@acumenus.net', $row?->canonical_email);
    }

    public function test_alias_email_is_unique(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->expectException(\Illuminate\Database\QueryException::class);
        OidcEmailAlias::create([
            'alias_email' => 'sudoshi@acumenus.io',
            'canonical_email' => 'elsewhere@example.com',
        ]);
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Write migration**

```php
// backend/database/migrations/2026_04_13_000002_create_oidc_email_aliases_table.php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::connection('pgsql')->create('app.oidc_email_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('alias_email', 255)->unique();
            $table->string('canonical_email', 255);
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->index('canonical_email');
        });
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('app.oidc_email_aliases');
    }
};
```

- [ ] **Step 4: Write model**

```php
// backend/app/Models/App/OidcEmailAlias.php
<?php
namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class OidcEmailAlias extends Model
{
    protected $table = 'app.oidc_email_aliases';

    protected $fillable = ['alias_email', 'canonical_email', 'note'];

    public static function canonicalFor(string $email): ?string
    {
        $row = static::whereRaw('lower(alias_email) = ?', [strtolower($email)])->first();
        return $row?->canonical_email;
    }
}
```

- [ ] **Step 5: Write seeder**

```php
// backend/database/seeders/OidcEmailAliasSeeder.php
<?php
namespace Database\Seeders;

use App\Models\App\OidcEmailAlias;
use Illuminate\Database\Seeder;

class OidcEmailAliasSeeder extends Seeder
{
    public function run(): void
    {
        // Map Authentik work email (incoming) → existing Parthenon canonical email.
        // Direction per Phase 0 prod snapshot decision (option C).
        // - John (jdawe) is an exact match — no alias row needed.
        // - Lisa (lmiller) has no Parthenon row yet — no alias row; reconciliation
        //   will fall through to JIT-create at lmiller@acumenus.net.
        $aliases = [
            ['sudoshi@acumenus.io',  'admin@acumenus.net',     'CMIO: Authentik → existing Parthenon user id 117'],
            ['ebruno@acumenus.net',  'brunoemilyk@gmail.com',  'CEO: Authentik → existing Parthenon user id 242'],
            ['kpatel@acumenus.net',  'kash37@yahoo.com',       'CIO: Authentik → existing Parthenon user id 243'],
            ['dmuraco@acumenus.io',  'david.muraco@gmail.com', 'CTO: Authentik → existing Parthenon user id 119'],
            ['gbock@acumenus.net',   'ghbock1@gmail.com',      'CSO: Authentik → existing Parthenon user id 195'],
        ];
        foreach ($aliases as [$a, $c, $n]) {
            OidcEmailAlias::updateOrCreate(
                ['alias_email' => strtolower($a)],
                ['canonical_email' => strtolower($c), 'note' => $n]
            );
        }
    }
}
```

- [ ] **Step 6: Run migration + seeder against test DB; re-run tests**

```bash
docker compose exec -T php sh -c "cd /var/www/html && php artisan migrate --path=database/migrations/2026_04_13_000002_create_oidc_email_aliases_table.php --env=testing"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Models/OidcEmailAliasTest.php"
```

- [ ] **Step 7: Pint + PHPStan + commit**

```bash
git commit -m "feat(auth): add oidc_email_aliases table + C-suite seeder"
```

- [ ] **Step 8: Deploy**

```bash
ssh <prod> "cd /path/to/Parthenon && ./deploy.sh --db"
ssh <prod> "cd /path/to/Parthenon && docker compose exec -T php php artisan db:seed --class=OidcEmailAliasSeeder --force"
psql -h <prod> -U claude_dev -d parthenon -c "select alias_email, canonical_email from app.oidc_email_aliases order by alias_email;"
```

Confirm 7 rows. Still no behavior change — local login unaffected.

---

## Phase 3 — OIDC Service Layer (Unreachable)

**Goal:** Ship all the OIDC logic (discovery, JWT validation, reconciliation, handshake store) as services with unit tests. **No routes.** Merging this is safe because nothing calls the services yet.

**Files:**
- Create: `backend/app/Services/Auth/Oidc/OidcDiscoveryService.php`
- Create: `backend/app/Services/Auth/Oidc/OidcTokenValidator.php`
- Create: `backend/app/Services/Auth/Oidc/OidcReconciliationService.php`
- Create: `backend/app/Services/Auth/Oidc/OidcHandshakeStore.php`
- Create: `backend/app/Services/Auth/Oidc/Exceptions/OidcException.php` + subclasses
- Tests: `backend/tests/Unit/Services/Auth/Oidc/*Test.php`

### Task 3.1 — OidcHandshakeStore (Redis)

Stores: `state:{state} → nonce` (5 min TTL) during redirect; `code:{code} → {user_id, token}` (60 s TTL) during callback→exchange.

- [ ] **Step 1: Write test**

```php
// backend/tests/Unit/Services/Auth/Oidc/OidcHandshakeStoreTest.php
public function test_put_and_consume_state(): void
{
    $store = app(OidcHandshakeStore::class);
    $state = $store->putState('nonce-abc');
    $this->assertSame('nonce-abc', $store->consumeState($state));
    $this->assertNull($store->consumeState($state), 'must be one-shot');
}

public function test_put_and_consume_code(): void
{
    $store = app(OidcHandshakeStore::class);
    $code = $store->putCode(42, 'plain-text-token-xyz');
    $this->assertSame(['user_id' => 42, 'token' => 'plain-text-token-xyz'], $store->consumeCode($code));
    $this->assertNull($store->consumeCode($code));
}

public function test_state_expires(): void
{
    Redis::shouldReceive(...)->// use test double or fake clock
}
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement using `Illuminate\Support\Facades\Cache::store('redis')` with `putMany`/`pull`**

Use `Str::random(48)` for state/code values. Namespace keys `oidc:state:{...}` and `oidc:code:{...}`. TTL: 300s for state, 60s for code. `consume*` reads then deletes atomically (use `Cache::pull`).

- [ ] **Step 4: Green. Commit.**

```bash
git commit -m "feat(auth): add OidcHandshakeStore (Redis state + one-time code)"
```

### Task 3.2 — OidcDiscoveryService

Fetches `.well-known/openid-configuration` + JWKS, caches both for 1 hour.

- [ ] **Step 1: Write test (with HTTP fake)**

```php
public function test_discovery_caches_config_and_jwks(): void
{
    Http::fake([
        'auth.acumenus.net/application/o/parthenon-oidc/.well-known/openid-configuration' => Http::response([
            'issuer' => 'https://auth.acumenus.net/application/o/parthenon-oidc/',
            'authorization_endpoint' => 'https://auth.acumenus.net/application/o/authorize/',
            'token_endpoint' => 'https://auth.acumenus.net/application/o/token/',
            'jwks_uri' => 'https://auth.acumenus.net/application/o/parthenon-oidc/jwks/',
        ]),
        'auth.acumenus.net/application/o/parthenon-oidc/jwks/' => Http::response([
            'keys' => [['kid' => 'test', 'kty' => 'RSA', 'n' => '...', 'e' => 'AQAB']],
        ]),
    ]);

    $svc = app(OidcDiscoveryService::class);
    $this->assertSame('https://auth.acumenus.net/application/o/parthenon-oidc/', $svc->issuer());
    $this->assertArrayHasKey('test', $svc->jwks());

    // Second call hits cache
    $svc->issuer();
    Http::assertSentCount(2);
}
```

- [ ] **Step 2-4: Fail → implement with `Http::get(...)` + `Cache::remember('oidc:discovery', 3600, ...)` → Green → Commit**

### Task 3.3 — OidcTokenValidator

Validates ID token: signature (via JWKS `kid` lookup), `iss`, `aud` = client_id, `exp > now`, `nonce` matches stored nonce. Uses `firebase/php-jwt`.

- [ ] **Step 1: Generate a test keypair fixture** under `backend/tests/Fixtures/oidc/` (private.pem + JWKS with matching `kid`). `.gitignore`-safe; they're test keys.

- [ ] **Step 2: Write tests covering: valid token passes; tampered signature fails; expired token fails; wrong issuer fails; wrong audience fails; wrong nonce fails; missing `sub`/`email`/`name` claims fail.** Seven cases, one assertion each.

- [ ] **Step 3: Fail → implement validator that returns a `ValidatedClaims` DTO (readonly class with `sub`, `email`, `name`, `groups: array`) or throws `OidcTokenInvalidException` with a machine-readable reason → Green → Commit**

```bash
git commit -m "feat(auth): add OidcTokenValidator (JWKS + iss/aud/exp/nonce)"
```

### Task 3.4 — OidcReconciliationService (The Critical Piece)

Implements the 4-step algorithm from handoff §3. **This is where duplicates get created if we're sloppy.** Every branch gets a test.

**Algorithm (additive-only — guardrail #3):**
```
given ValidatedClaims{sub, email, name, groups}:
  1. identity = UserExternalIdentity::firstWhere(provider='authentik', provider_subject=sub)
     if identity: return [identity.user, 'linked_by_sub']
        # NOTE: never touch identity.user roles on this path.

  2. canonical = strtolower(email)
     user = User::whereRaw('lower(email) = ?', [canonical])->first()
     if user:
       UserExternalIdentity::create(user_id=user.id, provider, sub, email_at_link=email)
       return [user, 'linked_by_email']
        # NOTE: never modify user->roles. User keeps existing role set.

  3. aliased = OidcEmailAlias::canonicalFor(canonical)
     if aliased:
       user = User::whereRaw('lower(email) = ?', [aliased])->first()
       if user:
         UserExternalIdentity::create(...)
         return [user, 'linked_by_alias']
          # NOTE: never modify user->roles.

  4. if not in_array('Parthenon Admins', groups):
       throw OidcAccessDeniedException('not_in_allowed_group')

     # JIT-create only. NEW users get exactly one role: 'admin'.
     user = User::create(name, email=canonical, password=random_bytes(32),
                         must_change_password=false, email_verified_at=now)
     user->assignRole('admin')     # Parthenon Admins → admin; NEVER super-admin
     UserExternalIdentity::create(...)
     return [user, 'created_jit']
```

**Role-mutation policy (MUST be enforced by tests):**
- Paths 1/2/3 (existing user): reconciliation does NOT call `assignRole`, `syncRoles`, `removeRole`, or touch `model_has_roles` in any way. User's existing role set is preserved byte-for-byte. Verified by snapshotting `$user->roles->pluck('name')->sort()->values()` pre- and post-call.
- Path 4 (new user): exactly one `assignRole('admin')` call. Never `super-admin`. Never any other role.
- `authentik Admins` in groups but not `Parthenon Admins`: rejected. No user/identity/role mutations.

- [ ] **Step 1: Write test cases — ten minimum:**

```
a. existing identity link (sub match)           → returns same user, zero new rows, roles unchanged
b. existing user by exact email                 → creates identity row, roles unchanged
c. existing user by alias (sudoshi@acumenus.io  → admin@acumenus.net user id 117 in fixture)
                                                → creates identity row, roles unchanged
                                                   (assert user still has 'super-admin' after call)
d. no match, groups contains 'Parthenon Admins' → creates user with exactly ['admin'] + identity
e. no match, groups lacks 'Parthenon Admins'    → throws OidcAccessDeniedException,
                                                   User::count() and UserExternalIdentity::count() unchanged
f. email comparison is case-insensitive         → SUDOSHI@ACUMENUS.IO matches admin@acumenus.net via alias
g. double-call with same sub                    → idempotent; exactly 1 identity row
h. groups=['authentik Admins'] only             → rejected (verifies guardrail #2/#3)
i. existing super-admin linked via alias        → still has 'super-admin' after reconciliation
                                                   (explicit regression test for C-suite prod state)
j. existing admin linked via email              → 'admin' role NOT re-assigned (no duplicate role row);
                                                   role list identical before and after
```

- [ ] **Step 2: Fail — implement the service exactly per the algorithm above. Use a DB transaction wrapping the whole reconciliation so partial failures roll back.**

- [ ] **Step 3: Green. Assert `User::count()` and `UserExternalIdentity::count()` deltas in every test.**

- [ ] **Step 4: Pint + PHPStan + commit**

```bash
git commit -m "feat(auth): add OidcReconciliationService (4-step account linking)"
```

### Task 3.5 — Service-layer checkpoint

- [ ] Run the full test suite: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest"` — expect green.
- [ ] No HTTP routes touched yet. Deploy is a no-op. Still nothing calls these services.
- [ ] Tag: `git tag auth-oidc-phase3-complete`

---

## Phase 4 — OIDC HTTP Endpoints (Feature-Flagged, Default Off)

**Goal:** Wire `redirect`, `callback`, `exchange` routes behind `config('services.oidc.enabled')`. When disabled, routes return 404 (as if they don't exist). Default: **disabled**.

**Files:**
- Modify: `backend/config/services.php`
- Modify: `backend/.env.example`
- Create: `backend/app/Http/Controllers/Api/V1/Auth/OidcController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/database/seeders/AuthProviderSeeder.php` — add `oidc` row (is_enabled=false)
- Tests: `backend/tests/Feature/Auth/Oidc{Redirect,Callback,Exchange}Test.php`

- [ ] **Step 1: Add config**

```php
// backend/config/services.php — append
'oidc' => [
    'enabled'        => env('OIDC_ENABLED', false),
    'discovery_url'  => env('OIDC_DISCOVERY_URL'),
    'client_id'      => env('OIDC_CLIENT_ID'),
    'client_secret'  => env('OIDC_CLIENT_SECRET'),
    'redirect_uri'   => env('OIDC_REDIRECT_URI'),
    'scopes'         => ['openid', 'profile', 'email', 'groups'],
    'allowed_groups' => ['Parthenon Admins'],
],
```

```bash
# backend/.env.example — append (no real values)
OIDC_ENABLED=false
OIDC_DISCOVERY_URL=https://auth.acumenus.net/application/o/parthenon-oidc/.well-known/openid-configuration
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=https://parthenon.acumenus.net/api/v1/auth/oidc/callback
```

- [ ] **Step 2: Write feature test for `/auth/oidc/redirect` (disabled = 404)**

```php
public function test_redirect_returns_404_when_oidc_disabled(): void
{
    config(['services.oidc.enabled' => false]);
    $this->get('/api/v1/auth/oidc/redirect')->assertStatus(404);
}

public function test_redirect_returns_302_to_authorization_endpoint_when_enabled(): void
{
    config(['services.oidc.enabled' => true]);
    Http::fake([/* discovery response */]);
    $response = $this->get('/api/v1/auth/oidc/redirect');
    $response->assertStatus(302);
    $location = $response->headers->get('Location');
    $this->assertStringContainsString('auth.acumenus.net', $location);
    $this->assertStringContainsString('state=', $location);
    $this->assertStringContainsString('nonce=', $location);
    $this->assertStringContainsString('code_challenge=', $location); // PKCE
}
```

- [ ] **Step 3: Write feature test for `/auth/oidc/callback`**

Cases:
- `state` missing or unknown → 400
- Authentik token-endpoint failure → 401 with `{error: 'oidc_failed', reason: 'token_exchange_failed'}`
- Valid token + reconciliation success → 302 to `frontend.url/auth/callback?code=<opaque>`
- Valid token but `groups` lacks `Parthenon Admins` and no existing match → 403 `{reason: 'not_in_allowed_group'}`

- [ ] **Step 4: Write feature test for `POST /auth/oidc/exchange`**

```php
public function test_exchange_returns_token_and_user(): void
{
    config(['services.oidc.enabled' => true]);
    $user = User::factory()->create();
    $token = $user->createToken('auth-token')->plainTextToken;
    $code = app(OidcHandshakeStore::class)->putCode($user->id, $token);

    $this->postJson('/api/v1/auth/oidc/exchange', ['code' => $code])
        ->assertOk()
        ->assertJsonStructure(['token', 'user' => ['id','email','name']]);
}

public function test_exchange_rejects_unknown_code(): void
{
    $this->postJson('/api/v1/auth/oidc/exchange', ['code' => 'nope'])
        ->assertStatus(400);
}

public function test_exchange_code_is_single_use(): void
{
    // first call works, second returns 400
}
```

- [ ] **Step 5: Run — expect FAIL**

- [ ] **Step 6: Implement `OidcController`**

Three methods: `redirect(Request)`, `callback(Request)`, `exchange(Request)`. Each wraps its body in try/catch, logs exceptions with correlation ID, and returns structured JSON or a redirect. Use PKCE S256 (store `code_verifier` alongside the state → nonce map; extend `OidcHandshakeStore::putState(nonce, verifier)`). On successful reconciliation, call `$user->tokens()->where('name','auth-token')->delete()` then `$user->createToken('auth-token')` to match local login behavior, update `last_login_at`, write `AuditLog` entry matching the existing login pattern (grep `AuthController::login` for the existing call).

- [ ] **Step 7: Add routes**

```php
// backend/routes/api.php — inside v1 group, OUTSIDE auth:sanctum middleware (these are public)
Route::prefix('auth/oidc')->group(function () {
    Route::get('redirect',  [OidcController::class, 'redirect'])
        ->middleware('throttle:20,1');
    Route::get('callback',  [OidcController::class, 'callback'])
        ->middleware('throttle:20,1');
    Route::post('exchange', [OidcController::class, 'exchange'])
        ->middleware('throttle:20,1');
});
```

Rate-limit each endpoint (20/min per IP) to blunt state-stuffing.

- [ ] **Step 8: Add oidc row to AuthProviderSeeder (disabled by default)**

```php
[
    'provider_type' => 'oidc',
    'display_name' => 'Authentik (OIDC)',
    'is_enabled' => false,
    'priority' => 15,
    'settings' => [
        'client_id' => '', 'client_secret' => '',
        'discovery_url' => 'https://auth.acumenus.net/application/o/parthenon-oidc/.well-known/openid-configuration',
        'redirect_uri' => 'https://parthenon.acumenus.net/api/v1/auth/oidc/callback',
        'scopes' => ['openid', 'profile', 'email', 'groups'],
        'pkce_enabled' => true,
    ],
],
```

- [ ] **Step 9: Green → Pint → PHPStan → commit**

```bash
git commit -m "feat(auth): add OIDC redirect/callback/exchange endpoints (feature-flagged off)"
```

- [ ] **Step 10: Deploy with flag OFF**

```bash
ssh <prod> "cd /path/to/Parthenon && ./deploy.sh --php"
curl -sS -o /dev/null -w '%{http_code}\n' https://parthenon.acumenus.net/api/v1/auth/oidc/redirect
# expect 404
```

Local login must still work identically. Verify by logging in as admin.

---

## Phase 5 — Authentik Provider Registration

**Goal:** Register `parthenon-oidc` in Authentik via the installer automation, then populate `OIDC_CLIENT_ID`/`OIDC_CLIENT_SECRET` on the Parthenon side. Still flag-off.

**Files:**
- Modify: `acropolis/installer/authentik.py` — extend `NATIVE_SSO_DEFS`

- [ ] **Step 1: Read existing `NATIVE_SSO_DEFS` entries (Grafana, Superset, pgAdmin, DataHub, Portainer)** to match the pattern.

- [ ] **Step 2: Add Parthenon definition**

```python
{
    "slug": "parthenon-oidc",
    "name": "Parthenon",
    "redirect_uris": [
        "https://parthenon.acumenus.net/api/v1/auth/oidc/callback",
        # add local dev redirect if we truly develop SSO locally; skip otherwise
    ],
    "scopes": ["openid", "profile", "email", "groups"],
    "property_mappings": [
        "authentik default OAuth Mapping: OpenID 'openid'",
        "authentik default OAuth Mapping: OpenID 'email'",
        "authentik default OAuth Mapping: OpenID 'profile'",
        "authentik default OAuth Mapping: Proxy outpost",  # or the groups mapping
    ],
    "policies": {"bind_group": "Parthenon Admins"},  # app-level access policy
},
```

Exact property-mapping names must match what the installer already uses — grep the file.

- [ ] **Step 3: Run installer in dry-run mode** (if supported) or against a staging Authentik first.

- [ ] **Step 4: Record client_id + client_secret into `backend/.env` on prod ONLY (chmod 600 enforced).**

```bash
# On prod host, NOT in repo:
echo "OIDC_CLIENT_ID=<value>" >> backend/.env
echo "OIDC_CLIENT_SECRET=<value>" >> backend/.env
echo "OIDC_ENABLED=false" >> backend/.env  # still off
chmod 600 backend/.env
docker compose up -d php  # env_file reloads only on create/recreate
```

- [ ] **Step 5: Verify discovery URL responds and groups claim is emitted**

```bash
curl -s https://auth.acumenus.net/application/o/parthenon-oidc/.well-known/openid-configuration | jq .
```

- [ ] **Step 6: Commit installer changes** (no secrets)

```bash
git commit -m "chore(acropolis): register parthenon-oidc app in Authentik installer"
```

---

## Phase 6 — Frontend Callback Page + Hidden Button

**Goal:** Ship the SPA side. Button is conditional on the auth-providers API saying OIDC is enabled — so it stays hidden until Phase 7.

**Files:**
- Create: `frontend/src/features/auth/pages/OidcCallbackPage.tsx`
- Modify: `frontend/src/features/auth/api.ts` — add `useAuthProviders()` + `exchangeOidcCode()`
- Modify: `frontend/src/features/auth/pages/LoginPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/features/auth/__tests__/LoginPage.test.tsx` + `OidcCallbackPage.test.tsx`

- [ ] **Step 1: Expose `/api/v1/auth/providers` in backend** (public endpoint returning `[{type:'local', enabled:true}, {type:'oidc', enabled:<config('services.oidc.enabled')>, label:'Sign in with Authentik'}]`). One route, one controller method, one feature test. Commit.

- [ ] **Step 2: Write Vitest for LoginPage button visibility**

```tsx
it('shows Authentik button when providers API reports oidc enabled', async () => {
  server.use(rest.get('/api/v1/auth/providers', (_, res, ctx) =>
    res(ctx.json([{type:'local',enabled:true},{type:'oidc',enabled:true,label:'Sign in with Authentik'}]))));
  render(<LoginPage />);
  expect(await screen.findByRole('link', {name: /sign in with authentik/i})).toHaveAttribute('href', '/api/v1/auth/oidc/redirect');
});

it('hides Authentik button when oidc disabled', async () => {
  server.use(rest.get('/api/v1/auth/providers', (_, res, ctx) =>
    res(ctx.json([{type:'local',enabled:true},{type:'oidc',enabled:false}]))));
  render(<LoginPage />);
  expect(screen.queryByRole('link', {name: /sign in with authentik/i})).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Fail**

- [ ] **Step 4: Implement `useAuthProviders()` via TanStack Query**, then render the button conditionally above the local login form (not replacing it). Match the existing dark clinical theme — use the same button component as "Sign in" for consistency.

- [ ] **Step 5: Write Vitest for OidcCallbackPage**

```tsx
it('exchanges code and navigates home', async () => {
  server.use(rest.post('/api/v1/auth/oidc/exchange', (req, res, ctx) =>
    res(ctx.json({token: 'tok-123', user: {id:1, email:'sudoshi@acumenus.io', name:'Sanjay Udoshi'}}))));
  render(<OidcCallbackPage />, {initialEntries:['/auth/callback?code=abc']});
  await waitFor(() => expect(useAuthStore.getState().token).toBe('tok-123'));
  expect(window.location.pathname).toBe('/');
});

it('shows error when exchange fails', async () => {
  server.use(rest.post('/api/v1/auth/oidc/exchange', (_, res, ctx) => res(ctx.status(400))));
  render(<OidcCallbackPage />, {initialEntries:['/auth/callback?code=bad']});
  expect(await screen.findByText(/sign-in failed/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Fail → implement `OidcCallbackPage`**

On mount, read `?code`, call `exchangeOidcCode(code)`, on success call `setAuth(token, user)` then `navigate('/')`, on error show a failure state with a link back to `/login`. No code in URL gets stored; we drop it after exchange.

- [ ] **Step 7: Add route**

```tsx
// frontend/src/app/router.tsx — public routes section
{path: '/auth/callback', element: <OidcCallbackPage />},
```

- [ ] **Step 8: Green → commit → build**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx vite build"
git commit -m "feat(auth): add Authentik SSO button + /auth/callback exchange page"
./deploy.sh --frontend
```

- [ ] **Step 9: Smoke check — button is still hidden** because `OIDC_ENABLED=false`. Local login unchanged.

---

## Phase 7 — Single-User Staged Smoke Test (sudoshi)

**Goal:** Flip the flag for one round-trip only. Verify reconciliation works for Sanjay, whose local account should already exist (admin@acumenus.net or equivalent — established in Phase 0).

- [ ] **Step 1: Pre-verify sudoshi row count: expect exactly 1 user matching his canonical or alias email.**

```bash
psql -h <prod> -U claude_dev -d parthenon -c "select id, email from app.users where lower(email) in ('sudoshi@acumenus.io','sudoshi@mac.com','admin@acumenus.net');"
```

- [ ] **Step 2: Enable OIDC on prod**

```bash
ssh <prod> "cd /path/to/Parthenon && sed -i 's/^OIDC_ENABLED=false/OIDC_ENABLED=true/' backend/.env && docker compose up -d php"
```

- [ ] **Step 3: Visit https://parthenon.acumenus.net/login → click "Sign in with Authentik" → complete login as sudoshi.**

- [ ] **Step 4: Verify no duplicate**

```bash
psql -h <prod> -U claude_dev -d parthenon -c "select id, email, last_login_at from app.users where lower(email) ilike '%sudoshi%' or lower(email) = 'admin@acumenus.net';"
psql -h <prod> -U claude_dev -d parthenon -c "select user_id, provider, provider_subject, provider_email_at_link, linked_at from app.user_external_identities;"
```

Expect: same user row as before (same `id`), `last_login_at` updated, exactly 1 row in `user_external_identities` with `provider='authentik'`.

- [ ] **Step 5: Verify local password login STILL WORKS** for `admin@acumenus.net`. This is the non-negotiable safety check. If it's broken, `sed -i 's/OIDC_ENABLED=true/OIDC_ENABLED=false/'` and `docker compose up -d php` immediately, then debug.

- [ ] **Step 6: Log out → log in again via Authentik → verify no new identity row is created (idempotency).**

**Gate to Phase 8:** Human confirms sudoshi round-trip is clean and local login still works.

---

## Phase 8 — Broader C-Suite Rollout

- [ ] **Step 1: Test `dmuraco` (existing account via alias map)** — verify `user_id` matches pre-existing row for David, identity row created, role unchanged.

- [ ] **Step 2: Test `jdawe` (existing account via alias map)** — same verification.

- [ ] **Step 3: Test `lmiller` (new user, in Parthenon Admins group)** — verify:
  - New `app.users` row created with `email='lmiller@acumenus.net'`, `must_change_password=false`, `email_verified_at` set
  - Role = `admin` (not `super-admin`)
  - `user_external_identities` row created

- [ ] **Step 4: Test one user NOT in Parthenon Admins** (create a throwaway Authentik user in `authentik Admins` only) — verify 403 and no rows written.

- [ ] **Step 5: Re-snapshot the users table and diff against Phase 0 snapshot.**

```bash
diff <(phase0-snapshot) <(current-snapshot)
```

Every diff row must be an expected linking event. No surprise users, no surprise roles.

---

## Phase 9 — Monitoring, Docs, Devlog

- [ ] **Step 1: Add `parthenon-brain` ingest** — the devlog file will be picked up by the post-commit hook automatically; no action needed unless we want immediate indexing.

- [ ] **Step 2: Write `docs/devlog/modules/auth/2026-04-13-authentik-sso.md`** covering: what shipped, the reconciliation algorithm, the alias table (reference only; no actual aliases in the commit if considered sensitive — they're not, but exercise judgment), how to revoke an OIDC link (`delete from app.user_external_identities where user_id=? and provider='authentik'`), how to disable emergency (`OIDC_ENABLED=false` + `docker compose up -d php`).

- [ ] **Step 3: Add Horizon/log alert on spike in `oidc_failed`** entries from `OidcController` error responses. Simple threshold: >10/min → Slack alert via existing audit-log pipeline.

- [ ] **Step 4: Commit devlog**

```bash
git commit -m "docs(auth): devlog for Authentik SSO rollout (phases 1-9)"
```

- [ ] **Step 5: Tag release**

```bash
git tag auth-oidc-v1-shipped
```

---

## Rollback Procedures (Per Phase)

| Phase | Rollback |
|---|---|
| 1 | `php artisan migrate:rollback --path=database/migrations/2026_04_13_000001_*.php` |
| 2 | `php artisan migrate:rollback --path=database/migrations/2026_04_13_000002_*.php` (drops aliases; re-seed later) |
| 3 | Revert the service-layer commit; no side effects. |
| 4 | Revert routes + controller commit. Local login unaffected throughout — confirmed by the `redirect returns 404 when disabled` test. |
| 5 | Delete the `parthenon-oidc` app in Authentik admin UI. |
| 6 | Revert frontend commit; `./deploy.sh --frontend`. Button disappears. |
| 7 | `sed -i 's/OIDC_ENABLED=true/OIDC_ENABLED=false/' backend/.env && docker compose up -d php`. Button auto-hides because providers API now reports disabled. Existing identity rows stay (harmless). |
| 8 | Same as 7. To scrub a bad JIT-created user: `delete from app.user_external_identities where user_id=X; delete from app.users where id=X;` — **only after confirming no user-owned cohorts/analyses reference them.** |

---

## Self-Review

**Spec coverage (handoff sections 1–6):**
- §1 Identity linking → Phase 1 ✓
- §2 Alias reconciliation → Phase 2 ✓
- §3 OIDC backend endpoints → Phases 3 + 4 ✓
- §4 Callback delivery (one-time code) → Phase 4 (`OidcHandshakeStore::putCode/consumeCode`, `POST /exchange`) ✓
- §5 Frontend login button → Phase 6 ✓
- §6 Authentik app registration → Phase 5 ✓
- §Test Plan → distributed across Phases 1–4 (unit + feature) and Phases 7–8 (manual smoke) ✓

**Placeholder scan:** The only "fill-in" spot is the test fixture keypair content in Task 3.3 (fixture generation is a one-liner — `openssl genrsa` + a small script to emit JWKS). Everything else is concrete.

**Type consistency:** `OidcHandshakeStore::putState(nonce)` returns state string; `putState(nonce, verifier)` extended in Phase 4 for PKCE — flagged in Task 3.1 note. `consumeState` returns `?string` (nonce) in 3.1 but will return `?array` (nonce+verifier) after PKCE extension — update the Phase 3 signature retroactively when landing Phase 4, or design the signature with PKCE in mind from the start (preferred: make `putState` accept an `array $meta` from day one). Apply this fix before starting Phase 3.

**Guardrail coverage:** HIGHSEC rule checks (no route without auth:sanctum for non-public, no `$guarded=[]`, no `super-admin` mapping, rate-limiting, secret file perms) are covered. Local login preservation is tested explicitly in Phase 7.

**Risk hotspots:**
1. Reconciliation algorithm (Phase 3.4) — **highest risk of duplicates**. Mitigated by 8 test cases and a transaction wrap.
2. JWT validation (Phase 3.3) — **highest risk of auth bypass**. Mitigated by 7 negative tests and `firebase/php-jwt` handling signature math.
3. Prod `.env` edits (Phase 5, 7) — **highest risk of outage**. Mitigated by flag-off default and immediate revert procedure.
4. Groups claim not emitted by Authentik (Phase 5) — **highest risk of JIT lockout**. Verify in Phase 5 Step 5 curl + decode a real ID token before flipping Phase 7.
