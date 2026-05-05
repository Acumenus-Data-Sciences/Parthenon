<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Http\Requests\SubmitTemplateRunRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class SubmitTemplateRunRequestTest extends TestCase
{
    public function test_valid_payload_passes(): void
    {
        $rules = (new SubmitTemplateRunRequest)->rules();
        $v = Validator::make(['version' => '0.1.0', 'parameters' => ['target_schema' => 'eunomia']], $rules);
        $this->assertFalse($v->fails(), implode(';', $v->errors()->all()));
    }

    public function test_missing_version_fails(): void
    {
        $rules = (new SubmitTemplateRunRequest)->rules();
        $v = Validator::make(['parameters' => []], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('version', $v->errors()->toArray());
    }

    public function test_invalid_semver_fails(): void
    {
        $rules = (new SubmitTemplateRunRequest)->rules();
        $v = Validator::make(['version' => 'not-semver', 'parameters' => []], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('version', $v->errors()->toArray());
    }

    public function test_parameters_must_be_array(): void
    {
        $rules = (new SubmitTemplateRunRequest)->rules();
        $v = Validator::make(['version' => '0.1.0', 'parameters' => 'not-an-array'], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('parameters', $v->errors()->toArray());
    }

    public function test_parameters_optional_default_empty(): void
    {
        $rules = (new SubmitTemplateRunRequest)->rules();
        $v = Validator::make(['version' => '0.1.0'], $rules);
        $this->assertFalse($v->fails());
    }
}
