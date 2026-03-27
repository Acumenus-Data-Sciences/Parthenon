<?php

namespace Tests\Unit\Context;

use App\Context\NoSourceContextException;
use App\Context\SourceContext;
use Tests\TestCase;

class SourceContextTest extends TestCase
{
    public function test_empty_context_has_null_source(): void
    {
        $ctx = new SourceContext;
        $this->assertNull($ctx->source);
        $this->assertNull($ctx->cdmSchema);
        $this->assertNull($ctx->resultsSchema);
        $this->assertNull($ctx->vocabSchema);
    }

    public function test_require_source_throws_when_empty(): void
    {
        $this->expectException(NoSourceContextException::class);
        $this->expectExceptionMessage('Source context required but not set');

        $ctx = new SourceContext;
        $ctx->requireSource();
    }

    public function test_cdm_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext;
        $ctx->cdmConnection();
    }

    public function test_results_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext;
        $ctx->resultsConnection();
    }

    public function test_vocab_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext;
        $ctx->vocabConnection();
    }
}
