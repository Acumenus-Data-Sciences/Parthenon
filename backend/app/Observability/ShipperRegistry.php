<?php

declare(strict_types=1);

namespace App\Observability;

use App\Contracts\ObservabilityShipperInterface;

/**
 * Holds the active set of {@see ObservabilityShipperInterface} implementations
 * and supports runtime registration so EE bundles can plug additional shippers
 * (Datadog, Splunk, OTel) without patching CE code.
 *
 * Registration order is preserved; {@see Observer} fans events out in order.
 */
class ShipperRegistry
{
    /** @var array<int, ObservabilityShipperInterface> */
    private array $shippers = [];

    public function register(ObservabilityShipperInterface $shipper): void
    {
        $this->shippers[] = $shipper;
    }

    /**
     * @return array<int, ObservabilityShipperInterface>
     */
    public function shippers(): array
    {
        return $this->shippers;
    }

    /**
     * @return array<int, string>
     */
    public function names(): array
    {
        return array_map(fn (ObservabilityShipperInterface $s) => $s->name(), $this->shippers);
    }

    public function clear(): void
    {
        $this->shippers = [];
    }
}
