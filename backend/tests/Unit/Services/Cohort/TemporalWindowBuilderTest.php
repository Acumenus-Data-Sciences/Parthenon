<?php

use App\Services\Cohort\Builders\TemporalWindowBuilder;

it('skips open-ended temporal boundaries when days is null', function () {
    $builder = app(TemporalWindowBuilder::class);

    $clauses = $builder->build(
        [
            'Start' => ['Days' => null, 'Coeff' => -1],
            'End' => ['Days' => 0, 'Coeff' => -1],
        ],
        'e.condition_start_date',
        'qe.start_date',
    );

    expect($clauses)->toHaveCount(1);
    expect($clauses[0])->toBe('e.condition_start_date <= DATEADD(qe.start_date, 0)');
});

it('preserves zero-day temporal boundaries', function () {
    $builder = app(TemporalWindowBuilder::class);

    $clauses = $builder->build(
        [
            'Start' => ['Days' => 0, 'Coeff' => -1],
            'End' => ['Days' => 0, 'Coeff' => 1],
        ],
        'e.condition_start_date',
        'qe.start_date',
    );

    expect($clauses)->toBe([
        'e.condition_start_date >= DATEADD(qe.start_date, 0)',
        'e.condition_start_date <= DATEADD(qe.start_date, 0)',
    ]);
});
