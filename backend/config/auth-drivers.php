<?php

use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Auth\Drivers\LocalCredentialsAuthDriver;

return [

    /*
    |--------------------------------------------------------------------------
    | Built-in auth drivers
    |--------------------------------------------------------------------------
    |
    | Each driver implements App\Contracts\AuthDriverInterface. The
    | AuthDriverServiceProvider registers them at boot. Drivers from
    | Parthenon Enterprise Edition are registered by EE's own service
    | provider; this file is only for the Community Edition defaults.
    |
    */

    'drivers' => [
        'local' => LocalCredentialsAuthDriver::class,
        'authentik-oidc' => AuthentikOidcAuthDriver::class,
    ],

];
