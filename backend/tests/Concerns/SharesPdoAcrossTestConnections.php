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
 * The connection wrappers retain their own search_path + quoting grammar,
 * so queries still resolve to the right schema.
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
     * Order matters only in that `pgsql_testing` is the master — all others
     * rebind to it.
     */
    private const TEST_PDO_SIBLINGS = [
        'inpatient_testing',
        'finngen_testing',
        'finngen_ro_testing',
    ];

    /**
     * Boot the trait during the test's setUp (called from TestCase::setUp).
     *
     * Trait methods with the name `init<TraitName>` are auto-invoked by
     * Laravel's `InteractsWithTestCaseLifecycle` machinery during
     * `setUpTraits()`, which runs AFTER the application is created but
     * BEFORE `RefreshDatabase` opens transactions.
     */
    public function initSharesPdoAcrossTestConnections(): void
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

            // Restore the sibling's search_path on every acquire so
            // per-connection schema resolution still behaves correctly.
            // (The PDO is shared, but search_path is a session GUC that
            // we push/pop via SET LOCAL inside each query when needed —
            // Laravel's PostgresConnector does this on build, but a
            // shared PDO means only the last-set search_path wins. We
            // pin it here to the sibling's config.)
            $searchPath = config("database.connections.{$siblingName}.search_path");
            if ($searchPath !== null) {
                $sibling->statement("SET LOCAL search_path TO {$searchPath}");
            }
        }
    }
}
