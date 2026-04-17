<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenConceptResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

it('exposes resolveNomesco returning the standard resolver shape', function () {
    $resolver = app(FinnGenConceptResolver::class);
    $result = $resolver->resolveNomesco(['ABC10']);
    expect($result)->toHaveKeys(['standard', 'source', 'truncated']);
});

it('exposes resolveKelaReimb returning the standard resolver shape', function () {
    $resolver = app(FinnGenConceptResolver::class);
    $result = $resolver->resolveKelaReimb(['203']);
    expect($result)->toHaveKeys(['standard', 'source', 'truncated']);
});

it('exposes resolveIcdO3 returning the standard resolver shape', function () {
    $resolver = app(FinnGenConceptResolver::class);
    $result = $resolver->resolveIcdO3(['C50.9']);
    expect($result)->toHaveKeys(['standard', 'source', 'truncated']);
});
