# Authentik SSO Phase 2 — oidc_email_aliases table + C-suite seeder

**Date:** 2026-04-13
**Branch:** feature/authentik-sso
**Phase:** 2 of the Authentik OIDC SSO rollout

## What was added

- **Migration** `2026_04_13_000002_create_oidc_email_aliases_table.php`: creates
  `app.oidc_email_aliases` with columns `id`, `alias_email` (unique), `canonical_email`,
  `note`, and standard timestamps. Indexed on `canonical_email` for reverse-lookup.

- **Model** `App\Models\App\OidcEmailAlias`: thin Eloquent model with `$fillable`
  whitelist and a static `canonicalFor(string $email): ?string` helper that does a
  case-insensitive lookup of `alias_email` and returns the matching `canonical_email`.

- **Seeder** `OidcEmailAliasSeeder`: idempotent `updateOrCreate` loop that seeds
  5 C-suite alias rows (see rationale below).

## Flipped-map rationale (Phase 0 snapshot finding)

The Phase 0 prod snapshot revealed that the initial alias-map direction was backwards
for 6 of 7 C-suite accounts: the Authentik work emails (e.g. `sudoshi@acumenus.io`)
are the *incoming* OIDC identities, while the existing Parthenon accounts use personal
or legacy corporate emails (e.g. `admin@acumenus.net`). The seeder stores the mapping
in the correct direction: **Authentik work email → existing Parthenon canonical email**.

Two special cases are excluded from the seeder:
- **John (jdawe@acumenus.io)** — exact match in both systems; no alias row needed.
- **Lisa (lmiller@acumenus.net)** — no Parthenon account exists yet; will be
  JIT-created via the Parthenon Admins group gate in a later phase.

## Behavioral impact

None. No application code reads `oidc_email_aliases` yet. The table and seeder are
infrastructure groundwork for Phase 3, which will wire the lookup into the OIDC
callback controller. This commit is schema-only, zero behavioral change.
