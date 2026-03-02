<?php

use App\Services\SqlRenderer\Dialects\PostgresDialect;
use App\Services\SqlRenderer\SqlRendererService;

describe('PostgresDialect', function () {
    beforeEach(function () {
        $this->dialect = new PostgresDialect;
    });

    it('generates dateAdd expression', function () {
        $result = $this->dialect->dateAdd('start_date', 30);
        expect($result)->toBe("start_date + INTERVAL '30 days'");
    });

    it('generates dateDiff expression', function () {
        $result = $this->dialect->dateDiff('start_date', 'end_date');
        expect($result)->toBe('(end_date::date - start_date::date)');
    });

    it('generates castAs expression', function () {
        $result = $this->dialect->castAs('value', 'INTEGER');
        expect($result)->toBe('CAST(value AS INTEGER)');
    });

    it('generates temp table create', function () {
        $result = $this->dialect->tempTableCreate('temp_cohort', 'SELECT * FROM person');
        expect($result)->toBe('CREATE TEMP TABLE temp_cohort AS SELECT * FROM person');
    });

    it('generates temp table drop', function () {
        $result = $this->dialect->tempTableDrop('temp_cohort');
        expect($result)->toBe('DROP TABLE IF EXISTS temp_cohort');
    });

    it('qualifies table with schema', function () {
        $result = $this->dialect->qualifyTable('cdm', 'person');
        expect($result)->toBe('cdm.person');
    });

    it('generates limit query', function () {
        $result = $this->dialect->limitQuery('SELECT * FROM person', 100);
        expect($result)->toBe('SELECT * FROM person LIMIT 100');
    });

    it('generates limit query with offset', function () {
        $result = $this->dialect->limitQuery('SELECT * FROM person', 100, 50);
        expect($result)->toBe('SELECT * FROM person LIMIT 100 OFFSET 50');
    });
});

describe('SqlRendererService', function () {
    it('renders template with parameters', function () {
        $service = new SqlRendererService;
        $result = $service->render(
            'SELECT * FROM {@schema}.person WHERE person_id = {@id}',
            ['schema' => 'cdm', 'id' => '123']
        );
        expect($result)->toBe('SELECT * FROM cdm.person WHERE person_id = 123');
    });

    it('throws on unknown dialect', function () {
        $service = new SqlRendererService;
        expect(fn () => $service->dialect('unknown'))
            ->toThrow(InvalidArgumentException::class);
    });

    it('replaces DATEADD function for postgresql', function () {
        $service = new SqlRendererService;
        $result = $service->render('SELECT DATEADD(start_date, 30) FROM person', []);
        expect($result)->toContain("INTERVAL '30 days'");
    });

    it('replaces DATEDIFF function for postgresql', function () {
        $service = new SqlRendererService;
        $result = $service->render('SELECT DATEDIFF(start_date, end_date) FROM person', []);
        expect($result)->toContain('end_date::date - start_date::date');
    });
});
