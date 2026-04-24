<?php

declare(strict_types=1);

namespace Tests\Concerns;

use Illuminate\Database\DatabaseManager;

/**
 * Force all *_testing Laravel connections to reuse the pgsql_testing PDO
 * during the lifetime of a test.
 *
 * Rationale:
 * - Laravel's default ConnectionFactory instantiates one PDO per connection.
 * - RefreshDatabase wraps each connection in its own transaction.
 * - PostgreSQL isolates transactions per-backend, so a User inserted on
 *   pgsql_testing's transaction is NOT visible to finngen_testing's separate
 *   transaction — breaking cross-schema FK checks (finngen.runs.user_id →
 *   app.users.id).
 *
 * Fix: point every *_testing connection's underlying PDO at the pgsql_testing
 * PDO *instance*. One backend, one transaction scope, one visibility frame.
 * The connection wrappers retain their own grammar, so queries still build
 * correct SQL; we set a UNION search_path on the shared PDO so tables from
 * any sibling schema resolve by unqualified name.
 *
 * Timing:
 * We override `setUpTraits()` on the base TestCase and rebind PDOs BEFORE
 * calling `parent::setUpTraits()`. That parent invocation is what triggers
 * `RefreshDatabase::refreshDatabase()` → `beginDatabaseTransaction()`, so
 * by rebinding first we guarantee all *_testing connections share one PDO
 * before any `BEGIN` statement is issued.
 *
 * We cannot use `beforeRefreshingDatabase()` directly because of PHP's trait
 * resolution rules: when a child test class uses `RefreshDatabase` via
 * Pest's `uses()` helper, that trait's (empty) `beforeRefreshingDatabase()`
 * shadows the inherited override on the parent `TestCase`. Overriding
 * `setUpTraits()` on `TestCase` itself is safe because child test classes
 * never redeclare it.
 *
 * Transaction mechanics:
 * After rebinding, RefreshDatabase iterates `$connectionsToTransact` and
 * calls `Connection::beginTransaction()` on each listed connection. Because
 * sibling *_testing connections already share the master's PDO, asking PG
 * to `BEGIN` on them again would fail (PG rejects nested BEGINs on a single
 * session). To avoid that, this trait also PRUNES the sibling *_testing
 * names out of `$connectionsToTransact` before parent::setUpTraits() runs.
 * The master's single transaction covers every write performed through any
 * sibling wrapper — because they all share one PG backend session — so
 * master's rollback at teardown rolls back everything.
 *
 * This is test-only. Production connections are never touched.
 *
 * Scope: sibling *_testing connections named in `TEST_PDO_SIBLINGS` below.
 * Add new siblings as they're introduced in `backend/config/database.php`.
 */
trait SharesPdoAcrossTestConnections
{
    /**
     * Connection names that should share pgsql_testing's PDO.
     *
     * `pgsql_testing` is the master — all others rebind to it.
     */
    private const TEST_PDO_SIBLINGS = [
        'inpatient_testing',
        'finngen_testing',
        'finngen_ro_testing',
    ];

    /**
     * Override Laravel's `setUpTraits()` to rebind sibling PDOs BEFORE the
     * parent implementation triggers RefreshDatabase's transaction opening.
     *
     * @return array<string,string>
     */
    protected function setUpTraits()
    {
        $this->rebindTestConnectionPdos();
        $this->pruneSiblingsFromTransactionList();

        return parent::setUpTraits();
    }

    /**
     * Rebind sibling *_testing connections to reuse pgsql_testing's PDO
     * instance, and set a UNION search_path on the shared PDO so queries
     * from any wrapper resolve to the correct schema by unqualified name.
     */
    private function rebindTestConnectionPdos(): void
    {
        /** @var DatabaseManager $dbm */
        $dbm = $this->app->make(DatabaseManager::class);

        // Force the master to exist first so its PDO is instantiated.
        $master = $dbm->connection('pgsql_testing');
        $masterPdo = $master->getPdo();

        foreach (self::TEST_PDO_SIBLINGS as $siblingName) {
            // Short-circuit if the connection isn't configured in this run
            // (e.g. dropped phpunit.xml override for a targeted test class).
            if (! array_key_exists($siblingName, config('database.connections', []))) {
                continue;
            }

            $sibling = $dbm->connection($siblingName);

            // Rebind the sibling's PDO to the master's instance.
            $sibling->setPdo($masterPdo);
            $sibling->setReadPdo($masterPdo);
        }

        // Apply the union search_path to the shared PDO so queries from
        // any wrapper resolve tables correctly. SESSION scope persists
        // across savepoints within the same PG backend session.
        $searchPathSchemas = self::collectSearchPathSchemas(
            array_merge(['pgsql_testing'], self::TEST_PDO_SIBLINGS)
        );
        if ($searchPathSchemas !== []) {
            $masterPdo->exec('SET SESSION search_path TO '.implode(',', $searchPathSchemas));
        }
    }

    /**
     * Strip sibling *_testing connection names from `$connectionsToTransact`
     * so RefreshDatabase only opens a transaction on `pgsql_testing`. Since
     * siblings share the master's PDO, their writes participate in master's
     * transaction automatically and roll back with it.
     *
     * Requires `$connectionsToTransact` to be declared on the TestCase or
     * subclass. No-op if the property doesn't exist (Laravel defaults to
     * the single `[null]` list in that case).
     */
    private function pruneSiblingsFromTransactionList(): void
    {
        if (! property_exists($this, 'connectionsToTransact')) {
            return;
        }

        $filtered = [];
        foreach ($this->connectionsToTransact as $name) {
            if (! in_array($name, self::TEST_PDO_SIBLINGS, true)) {
                $filtered[] = $name;
            }
        }
        $this->connectionsToTransact = $filtered;
    }

    /**
     * Build a de-duplicated ordered list of schemas from the given
     * connections' `search_path` config values. Preserves each connection's
     * stated ordering so the master's schemas still win on name collisions.
     *
     * @param  list<string>  $connectionNames
     * @return list<string>
     */
    private static function collectSearchPathSchemas(array $connectionNames): array
    {
        $seen = [];
        $ordered = [];
        foreach ($connectionNames as $name) {
            $raw = config("database.connections.{$name}.search_path");
            if (! is_string($raw) || $raw === '') {
                continue;
            }
            foreach (explode(',', $raw) as $schema) {
                $trimmed = trim($schema);
                if ($trimmed === '' || isset($seen[$trimmed])) {
                    continue;
                }
                $seen[$trimmed] = true;
                $ordered[] = $trimmed;
            }
        }

        return $ordered;
    }
}
