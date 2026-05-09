<?php

use App\Crypto\LaravelNativeCryptoProvider;

return [

    /*
    |--------------------------------------------------------------------------
    | Crypto provider
    |--------------------------------------------------------------------------
    |
    | The class that implements App\Contracts\CryptoProviderInterface.
    |
    | CE default: LaravelNativeCryptoProvider — delegates to Laravel Hash/Crypt.
    | EE override: set CRYPTO_PROVIDER env to an EE class
    |   (e.g. Acumenus\Parthenon\Enterprise\Crypto\FipsCryptoProvider),
    |   or have EE's EnterpriseServiceProvider re-bind the interface.
    |
    */
    'provider' => env('CRYPTO_PROVIDER', LaravelNativeCryptoProvider::class),

];
