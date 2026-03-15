<?php

namespace App\Services\DesignProtection;

final class ExportSummary
{
    public function __construct(
        public readonly int $written,
        public readonly int $deleted,
        /** @var list<string> */
        public readonly array $errors,
    ) {}

    public static function empty(): self
    {
        return new self(0, 0, []);
    }

    public function withWritten(int $written): self
    {
        return new self($written, $this->deleted, $this->errors);
    }

    public function withDeleted(int $deleted): self
    {
        return new self($this->written, $deleted, $this->errors);
    }

    public function withError(string $error): self
    {
        return new self($this->written, $this->deleted, [...$this->errors, $error]);
    }

    public function addWritten(int $count = 1): self
    {
        return $this->withWritten($this->written + $count);
    }

    public function addDeleted(int $count = 1): self
    {
        return $this->withDeleted($this->deleted + $count);
    }
}
