<?php

namespace Tests\Unit\Models;

use App\Models\App\OidcEmailAlias;
use Database\Seeders\OidcEmailAliasSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OidcEmailAliasTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_populates_five_c_suite_aliases(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->assertSame(5, OidcEmailAlias::count());
    }

    public function test_canonical_for_maps_authentik_work_email_to_parthenon_canonical(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->assertSame('admin@acumenus.net', OidcEmailAlias::canonicalFor('sudoshi@acumenus.io'));
    }

    public function test_canonical_for_is_case_insensitive(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->assertSame('david.muraco@gmail.com', OidcEmailAlias::canonicalFor('DMURACO@ACUMENUS.IO'));
    }

    public function test_canonical_for_returns_null_when_no_alias(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->assertNull(OidcEmailAlias::canonicalFor('jdawe@acumenus.io'));
        $this->assertNull(OidcEmailAlias::canonicalFor('lmiller@acumenus.net'));
    }

    public function test_alias_email_is_unique(): void
    {
        $this->seed(OidcEmailAliasSeeder::class);
        $this->expectException(QueryException::class);
        OidcEmailAlias::create([
            'alias_email' => 'sudoshi@acumenus.io',
            'canonical_email' => 'elsewhere@example.com',
        ]);
    }
}
