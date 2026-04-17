<?php

declare(strict_types=1);

use App\Enums\CoverageProfile;
use App\Services\FinnGen\FinnGenCoverageProfileClassifier;

it('returns FINLAND_ONLY when no group resolves', function () {
    $empty = ['standard' => [], 'source' => [], 'truncated' => false];
    $result = FinnGenCoverageProfileClassifier::classify(
        icd10: $empty, icd9: $empty, atc: $empty, icd8: $empty,
        icdO3: $empty, nomesco: $empty, kelaReimb: $empty,
    );
    expect($result)->toBe(CoverageProfile::FINLAND_ONLY);
});

it('returns PARTIAL when at least one group resolves and at least one does not', function () {
    $resolved = ['standard' => [123], 'source' => [], 'truncated' => false];
    $empty = ['standard' => [], 'source' => [], 'truncated' => false];
    $result = FinnGenCoverageProfileClassifier::classify(
        icd10: $resolved, icd9: $empty, atc: $empty, icd8: $empty,
        icdO3: $empty, nomesco: $empty, kelaReimb: $empty,
    );
    expect($result)->toBe(CoverageProfile::PARTIAL);
});

it('returns UNIVERSAL when every non-empty input group resolves', function () {
    $resolved = ['standard' => [123], 'source' => [], 'truncated' => false];
    $result = FinnGenCoverageProfileClassifier::classify(
        icd10: $resolved, icd9: $resolved, atc: $resolved, icd8: $resolved,
        icdO3: $resolved, nomesco: $resolved, kelaReimb: $resolved,
    );
    expect($result)->toBe(CoverageProfile::UNIVERSAL);
});

it('treats truncated standard arrays as resolved for classification purposes', function () {
    $truncated = ['standard' => array_fill(0, 500, 12345), 'source' => [], 'truncated' => true];
    $empty = ['standard' => [], 'source' => [], 'truncated' => false];
    $result = FinnGenCoverageProfileClassifier::classify(
        icd10: $truncated, icd9: $empty, atc: $empty, icd8: $empty,
        icdO3: $empty, nomesco: $empty, kelaReimb: $empty,
    );
    expect($result)->toBe(CoverageProfile::PARTIAL); // truncated still counts as resolved
});
