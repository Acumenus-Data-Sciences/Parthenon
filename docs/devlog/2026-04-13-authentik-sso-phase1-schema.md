# Authentik SSO — Phase 1: Identity Linking Schema

**Date:** 2026-04-13
**Branch:** feature/authentik-sso
**Migration:** `2026_04_13_000001_create_user_external_identities_table`

## What

Adds the `user_external_identities` table to support OIDC identity linking between
Parthenon users and external identity providers (Authentik, future: Google, GitHub).

## Schema

```
user_external_identities
├── id                      bigserial PK
├── user_id                 FK → users.id CASCADE DELETE
├── provider                varchar(32)   e.g. 'authentik'
├── provider_subject        varchar(255)  OIDC 'sub' claim
├── provider_email_at_link  varchar(255)  nullable; email at link time
├── linked_at               timestamp
├── created_at / updated_at timestamps
│
├── UNIQUE (provider, provider_subject)
└── INDEX  (provider, provider_email_at_link)
```

## Why

Phase 1 of the Authentik SSO rollout. Zero behavioral change — no auth routes
or middleware are wired yet. The table exists so Phase 2 can write to it after
verifying the OIDC callback resolves correctly.

The `users` table gains a `externalIdentities()` HasMany relationship pointing
to this model (`App\Models\App\UserExternalIdentity`).

## Tests

`Tests\Unit\Models\UserExternalIdentityTest` — 3 tests, all passing:
- `test_user_can_have_external_identity`
- `test_provider_subject_pair_is_unique`
- `test_deleting_user_cascades_to_identity`
