<?php

namespace Tests\Unit\Rules;

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Rules\UniqueDaimonSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class UniqueDaimonSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_duplicate_cdm_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('cdm', null);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('already registered', $validator->errors()->first('table_qualifier'));
    }

    public function test_allows_unique_cdm_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('cdm', null);
        $validator = Validator::make(
            ['table_qualifier' => 'irsf'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }

    public function test_allows_same_vocabulary_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'vocabulary',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('vocabulary', null);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }

    public function test_allows_own_schema_on_update(): void
    {
        $source = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('cdm', $source->id);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }
}
