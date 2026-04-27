<?php

namespace App\Services\StudyDesign;

use RuntimeException;

class StudyDesignProtocolGateException extends RuntimeException
{
    /**
     * @param  list<array<string, mixed>>  $issues
     * @param  array<string, mixed>  $summary
     */
    public function __construct(
        private readonly array $issues,
        private readonly array $summary = [],
    ) {
        parent::__construct($this->formatMessage($issues));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function issues(): array
    {
        return $this->issues;
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        return $this->summary;
    }

    /**
     * @param  list<array<string, mixed>>  $issues
     */
    private function formatMessage(array $issues): string
    {
        $messages = collect($issues)
            ->map(fn (array $issue): string => trim((string) ($issue['message'] ?? '')))
            ->filter()
            ->take(5)
            ->implode(' ');

        return 'Protocol upload did not pass Abby initial Study Design gates.'
            .($messages !== '' ? ' '.$messages : '');
    }
}
