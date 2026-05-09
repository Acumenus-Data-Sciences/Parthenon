<?php

namespace App\Contracts;

use App\Tenancy\Tenant;

/**
 * Resolves the current tenant for the active request/job.
 *
 * Community Edition: SingleTenantResolver returns Tenant#1 ('default')
 * for every request — single-tenant deployments see no behavior change.
 *
 * Enterprise Edition: MultiTenantResolver resolves from request context
 * (subdomain, X-Tenant-Slug header, JWT claim, or authenticated user's
 * primary tenant) and supports impersonation for super-admins.
 *
 * Implementations MUST be safe to call multiple times per request and
 * SHOULD memoize the result. Implementations MUST throw if no tenant
 * can be resolved (rather than returning null) — Parthenon assumes
 * every request has a tenant context.
 */
interface TenantResolverInterface
{
    public function current(): Tenant;

    public function currentId(): int;

    /** Switch the request-scoped tenant context (for impersonation, jobs). */
    public function setCurrent(Tenant $tenant): void;

    public function clear(): void;

    /**
     * Serialize the current tenant context for embedding in a queue
     * payload (R2). Laravel queued jobs serialize their payload and
     * restore on dequeue; tenant context must survive that boundary.
     *
     * SingleTenantResolver returns []; MultiTenantResolver returns
     * something like ['slug' => 'tenant-x'].
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array;

    /**
     * Restore tenant context from a snapshot produced by snapshot().
     * Called by the queued-job middleware before $job->handle() runs.
     *
     * @param  array<string, mixed>  $snap
     */
    public function restore(array $snap): void;
}
