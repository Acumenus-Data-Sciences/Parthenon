<?php

namespace Tests\Unit\Enums;

use App\Enums\LibraryStatus;
use Tests\TestCase;

class LibraryStatusTest extends TestCase
{
    public function test_has_three_cases_with_string_values(): void
    {
        $this->assertSame('draft', LibraryStatus::DRAFT->value);
        $this->assertSame('active', LibraryStatus::ACTIVE->value);
        $this->assertSame('archived', LibraryStatus::ARCHIVED->value);
    }

    public function test_values_helper_returns_all_string_values(): void
    {
        $this->assertSame(
            ['draft', 'active', 'archived'],
            LibraryStatus::values()
        );
    }
}
