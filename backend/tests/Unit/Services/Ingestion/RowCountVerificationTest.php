<?php

use App\Models\App\IngestionJob;
use App\Models\App\ValidationResult;
use App\Services\Ingestion\PostLoadValidationService;

describe('Row Count Verification — Ingestion Pipeline', function () {

    describe('PostLoadValidationService::validate() signature', function () {

        it('accepts an IngestionJob parameter', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'validate');
            $params = $method->getParameters();

            expect($params)->toHaveCount(1);
            expect($params[0]->getName())->toBe('job');
            expect($params[0]->getType()?->getName())->toBe(IngestionJob::class);
        });

        it('returns an array', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'validate');
            $returnType = $method->getReturnType();

            expect($returnType)->not->toBeNull();
            expect($returnType->getName())->toBe('array');
        });

        it('is a public method', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'validate');

            expect($method->isPublic())->toBeTrue();
        });
    });

    describe('ValidationResult model — row count tracking columns', function () {

        it('includes violated_rows in fillable', function () {
            $model = new ValidationResult;

            expect($model->getFillable())->toContain('violated_rows');
        });

        it('includes total_rows in fillable', function () {
            $model = new ValidationResult;

            expect($model->getFillable())->toContain('total_rows');
        });

        it('includes violation_percentage in fillable', function () {
            $model = new ValidationResult;

            expect($model->getFillable())->toContain('violation_percentage');
        });

        it('includes check_category in fillable', function () {
            $model = new ValidationResult;

            expect($model->getFillable())->toContain('check_category');
        });

        it('includes severity in fillable', function () {
            $model = new ValidationResult;

            expect($model->getFillable())->toContain('severity');
        });

        it('casts violation_percentage as decimal:2', function () {
            $model = new ValidationResult;
            $casts = $model->getCasts();

            expect($casts)->toHaveKey('violation_percentage');
            expect($casts['violation_percentage'])->toBe('decimal:2');
        });

        it('casts passed as boolean', function () {
            $model = new ValidationResult;
            $casts = $model->getCasts();

            expect($casts)->toHaveKey('passed');
            expect($casts['passed'])->toBe('boolean');
        });

        it('casts details as array', function () {
            $model = new ValidationResult;
            $casts = $model->getCasts();

            expect($casts)->toHaveKey('details');
            expect($casts['details'])->toBe('array');
        });

        it('has all required fillable columns for row count auditing', function () {
            $model = new ValidationResult;
            $fillable = $model->getFillable();

            $requiredColumns = [
                'ingestion_job_id',
                'check_name',
                'check_category',
                'cdm_table',
                'cdm_column',
                'severity',
                'passed',
                'violated_rows',
                'total_rows',
                'violation_percentage',
                'description',
                'details',
            ];

            foreach ($requiredColumns as $column) {
                expect($fillable)->toContain($column);
            }
        });
    });

    describe('IngestionJob model — stats_json infrastructure', function () {

        it('casts stats_json as array', function () {
            $model = new IngestionJob;
            $casts = $model->getCasts();

            expect($casts)->toHaveKey('stats_json');
            expect($casts['stats_json'])->toBe('array');
        });

        it('includes stats_json in fillable', function () {
            $model = new IngestionJob;

            expect($model->getFillable())->toContain('stats_json');
        });

        it('has a validationResults relationship', function () {
            $model = new IngestionJob;

            expect(method_exists($model, 'validationResults'))->toBeTrue();

            $method = new ReflectionMethod(IngestionJob::class, 'validationResults');
            $returnType = $method->getReturnType();

            expect($returnType?->getName())->toBe('Illuminate\Database\Eloquent\Relations\HasMany');
        });
    });

    describe('PostLoadValidationService — check categories coverage', function () {

        it('implements completeness checks', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'runCompletenessChecks');

            expect($method)->not->toBeNull();
        });

        it('implements conformance checks', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'runConformanceChecks');

            expect($method)->not->toBeNull();
        });

        it('implements plausibility checks', function () {
            $method = new ReflectionMethod(PostLoadValidationService::class, 'runPlausibilityChecks');

            expect($method)->not->toBeNull();
        });
    });
});
