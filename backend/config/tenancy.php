<?php

use App\Tenancy\SingleTenantResolver;

return [

    /*
    |--------------------------------------------------------------------------
    | Tenant resolver
    |--------------------------------------------------------------------------
    |
    | The class that implements App\Contracts\TenantResolverInterface and
    | answers "what is the current tenant?" for each request/job.
    |
    | CE default: SingleTenantResolver — always Tenant#1 ('default').
    | EE override: set TENANCY_RESOLVER env to an EE class
    |   (e.g. Acumenus\Parthenon\Enterprise\Tenant\MultiTenantResolver),
    |   or have EE's EnterpriseServiceProvider re-bind the interface.
    |
    */
    'resolver' => env('TENANCY_RESOLVER', SingleTenantResolver::class),

    /*
    |--------------------------------------------------------------------------
    | Multi-tenant feature flag
    |--------------------------------------------------------------------------
    |
    | Read by the FeatureFlagsResolver (Plan 02-06) to expose the
    | tenancy.multi flag in /api/v1/system/feature-flags. Set to false
    | for CE (single-tenant); EE flips this to true.
    |
    */
    'feature_flag' => env('TENANCY_MULTI_ENABLED', false),

];
