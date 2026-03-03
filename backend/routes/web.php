<?php

use App\Http\Controllers\LegacyAtlasRedirectController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// §9.6 — Legacy Atlas redirect handler
Route::get('/atlas/{path?}', [LegacyAtlasRedirectController::class, 'atlasRedirect'])
    ->where('path', '.*');

Route::any('/WebAPI/{path?}', [LegacyAtlasRedirectController::class, 'webApiRedirect'])
    ->where('path', '.*');
