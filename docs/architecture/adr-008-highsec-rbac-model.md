# ADR-008: HIGHSEC Six-Tier RBAC Model with Viewer as Default

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon handles protected health information (PHI) under HIPAA, including OMOP CDM clinical data, MIMIC-IV ICU records, medical imaging (DICOM), clinical notes, and genomic data. The platform serves users with vastly different responsibilities: system administrators, clinical researchers designing studies, data engineers managing ETL pipelines, vocabulary mapping reviewers, and read-only stakeholders reviewing research outputs.

The initial implementation assigned multiple roles (admin, researcher, data-steward, mapping-reviewer) to newly registered users, violating the principle of least privilege. This was identified as a critical security issue during a March 2026 security audit and hardened into the HIGHSEC specification.

The platform has 16+ permission domains (users, roles, sources, vocabulary, ingestion, mapping, cohorts, concept-sets, analyses, studies, data-quality, jobs, profiles, system, gis, permissions) with 50+ individual permissions. Routes require a three-layer protection model: authentication, authorization (RBAC), and ownership verification.

## Decision

Implement a six-tier role hierarchy using Spatie Laravel Permission, with `viewer` as the mandatory default role for all new user registrations:

### Role Hierarchy

| Role | Purpose | Typical User |
|------|---------|-------------|
| **super-admin** | All permissions (wildcard). Bootstrap and system recovery only. | Platform owner (`admin@acumenus.net`) |
| **admin** | User, role, source, and system management. No research capabilities. | IT administrators |
| **researcher** | Full research lifecycle: cohorts, analyses, studies, concept sets. No admin access. | Clinical researchers, epidemiologists |
| **data-steward** | Data pipelines, ingestion, mapping, DQD. No study execution. | Data engineers, ETL specialists |
| **mapping-reviewer** | AI concept mapping review only. Narrowly scoped. | Vocabulary specialists |
| **viewer** | Read-only access to all research outputs. DEFAULT for all new users. | Stakeholders, auditors, trainees |

### Three-Layer Route Protection

Every non-public API route must pass through all three layers:

1. **Authentication** -- `auth:sanctum` middleware rejects unauthenticated requests
2. **Authorization** -- `permission:{domain}.{action}` or `role:{role}` middleware enforces RBAC at the route level
3. **Ownership** -- Controller-level `$this->authorize()` or Laravel policies ensure users only modify their own resources

### Permission Domain Structure

Permissions follow the `{domain}.{action}` convention:

- **Read routes** (index, show): `permission:{domain}.view`
- **Write routes** (store, update, destroy): `permission:{domain}.create` or `permission:{domain}.edit`
- **Execution routes** (execute, run, generate): `permission:{domain}.run` or `permission:{domain}.execute`
- **Admin routes**: `role:admin|super-admin` or `role:super-admin`

### Enforced Constraints

1. **New user registration assigns `viewer` role only** -- `AuthController::register()` calls `$user->assignRole(['viewer'])`. Any code that assigns additional roles at registration is a HIGHSEC violation.
2. **Role promotion requires admin action** -- Only users with `roles.edit` permission can change another user's roles.
3. **Horizon dashboard** is gated by a Laravel Gate that checks for `super-admin` role, not an email whitelist.
4. **Sanctum tokens expire after 480 minutes (8 hours)** -- the `expiration` value in `config/sanctum.php` must never be `null`.
5. **Public routes are strictly limited** to: `/health`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, and `/cohort-definitions/shared/{token}` (time-limited, non-PHI).

### Mass Assignment Protection

Every Eloquent model must use `$fillable` to whitelist assignable attributes. `$guarded = []` is forbidden -- it disables all mass assignment protection and could allow privilege escalation through crafted API requests.

## Consequences

### Positive
- New users cannot access research data, clinical records, or administrative functions until an admin explicitly promotes them
- The permission domain structure maps directly to API route groups, making middleware configuration systematic
- Spatie's permission caching (Redis-backed) ensures RBAC checks add negligible latency
- The three-layer model provides defense in depth -- even if authorization middleware is misconfigured, ownership checks in controllers provide a second barrier
- 8-hour token expiration limits the blast radius of token compromise
- The `viewer` default means an account takeover of a newly registered user exposes only read-only access

### Negative
- New users experience a delay between registration and productive use, as they must wait for an admin to assign an appropriate role
- 50+ permissions across 16 domains create management complexity for administrators -- the admin UI must present this clearly
- Adding a new feature module requires defining new permissions, updating the seeder, and adding middleware to routes -- a three-step process
- The `super-admin` wildcard role bypasses all permission checks, which is powerful but dangerous if the account is compromised

### Risks
- Permission seeder drift: if `RolePermissionSeeder` is not kept in sync with route middleware, some routes may reference permissions that do not exist. Mitigated by running the seeder in deployment and validating permissions exist at route registration time.
- Stale permission cache: Spatie caches permissions in Redis. If roles are modified and the cache is not cleared, users may retain revoked permissions. Mitigated by cache-clearing in the role management service.
- Over-privileged `super-admin`: the wildcard permission bypasses all checks. Mitigated by restricting `super-admin` to a single account (`admin@acumenus.net`) and requiring password change on first login.

## Alternatives Considered

1. **Flat permission model (no roles)** -- Assign individual permissions directly to users. Rejected because managing 50+ permissions per user is error-prone, and roles provide meaningful abstractions that map to organizational responsibilities.

2. **Two-tier model (admin + user)** -- Simple admin/non-admin split. Rejected because it cannot express the difference between a researcher (who runs studies but cannot manage users) and a data steward (who manages pipelines but cannot run studies).

3. **Attribute-based access control (ABAC)** -- Dynamic policies based on user attributes, resource attributes, and context. Rejected as over-engineered for the current user base. RBAC covers the access patterns, and ABAC can be layered on later if multi-institutional federation requires it.

4. **Self-service role requests** -- Users request roles through the UI, and admins approve. Considered for future implementation but not included in the initial release to keep the approval workflow simple (direct admin assignment).

5. **Default role = researcher** -- Give new users research capabilities immediately. Rejected because it violates least privilege and could allow unauthorized access to clinical data before the user's institutional affiliation and research authorization are verified.
