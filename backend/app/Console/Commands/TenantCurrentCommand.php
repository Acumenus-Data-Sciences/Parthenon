<?php

namespace App\Console\Commands;

use App\Contracts\TenantResolverInterface;
use Illuminate\Console\Command;

/**
 * Diagnostic CLI: report the currently-resolved tenant + active resolver class.
 *
 * Useful for:
 *   - Operator verification after install (confirms migration + seeding worked)
 *   - EE customer support (confirms MultiTenantResolver is bound under
 *     a tier=enterprise install)
 */
class TenantCurrentCommand extends Command
{
    protected $signature = 'tenant:current';

    protected $description = 'Print the currently-resolved tenant';

    public function handle(TenantResolverInterface $resolver): int
    {
        $tenant = $resolver->current();
        $this->info(sprintf(
            "Current tenant: id=%d slug='%s' name='%s' billing_status='%s'",
            $tenant->id,
            $tenant->slug,
            $tenant->display_name,
            $tenant->billing_status,
        ));
        $this->info('Resolver: '.config('tenancy.resolver'));

        return self::SUCCESS;
    }
}
