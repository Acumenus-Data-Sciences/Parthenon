# Parthenon native i18n — bootstrap commit

**Date:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-parthenon-native-i18n-plan.md`
**Migration:** `2026_04_17_010000_add_locale_to_users.php`

## What landed

The first slice of the Parthenon native-i18n program. Ships 11 supported
locales + a pseudolocale + an RTL canary (Arabic), per-user locale
persistence, frontend i18next initialization, backend locale-negotiation
middleware, and translated message keys across the auth, settings, help,
and shared-shell surface.

## Migration

Adds `users.locale VARCHAR(16) DEFAULT 'en-US'` — additive only. Existing
users continue to render in English (the previous baseline) until they
explicitly select a different locale via the new Settings → Language &
Region tab.

```sql
ALTER TABLE app.users ADD COLUMN locale VARCHAR(16) NOT NULL DEFAULT 'en-US';
```

Apply via:

```bash
# Per the parthenon_migrator role split — use deploy.sh --db OR direct
# artisan with --path= and the migrator credentials:
docker compose exec -T \
  -e DB_USERNAME=parthenon_migrator \
  -e DB_PASSWORD=$(grep '^DB_MIGRATION_PASSWORD=' backend/.env | cut -d= -f2) \
  php php artisan migrate --force \
    --path=database/migrations/2026_04_17_010000_add_locale_to_users.php
```

## Locale negotiation order

Backend `ResolveLocale` middleware resolves locale per request:

1. `users.locale` if the request is authenticated and the column is set
2. `X-Parthenon-Locale` request header (frontend api-client always sends it)
3. `?locale=` query string override (for share-link / preview flows)
4. `Accept-Language` header (browser default)
5. Application fallback (`config('app.fallback_locale')` — `en`)

## Supported locales (initial registry)

| BCP 47 | Native label | Direction | Status |
|---|---|---|---|
| en-US | English | LTR | full |
| es | Español | LTR | shell + auth + settings + 1 help file |
| fr | Français | LTR | shell + auth + settings |
| de | Deutsch | LTR | shell + auth + settings |
| pt-BR | Português (Brasil) | LTR | shell + auth + settings |
| fi | Suomi | LTR | shell + auth + settings |
| ja | 日本語 | LTR | shell + auth + settings |
| zh-Hans | 中文（简体） | LTR | shell + auth + settings |
| ko | 한국어 | LTR | shell + auth + settings |
| hi | हिन्दी | LTR | shell + auth + settings |
| ar | العربية | **RTL** | shell + auth + settings (canary) |

## Auth-protection compliance

All auth-controller / auth-page diffs in this commit are translation-key
extraction (replacing hardcoded English with `__('auth.foo')` calls).
No endpoint signature, response shape, or flow change. Per
`.claude/rules/auth-system.md`:

- ChangePasswordModal remains non-dismissable
- "Request access" link preserved on LoginPage
- `must_change_password` gate in MainLayout intact
- All auth endpoints (`register`, `login`, `changePassword`, `user`,
  `forgotPassword`, `logout`) preserve their response shapes
- TempPasswordMail + Resend integration unchanged

## Honest gaps

- Translation files contain English placeholders for the non-English
  locales — proper translation review per locale is the next phase
  (1-3 weeks each per the spec).
- Help content migration is at "1 file in Spanish" as the pattern
  proof; full help-content localization is a separate ongoing effort.
- Clinical vocabulary (SNOMED descriptions, ATC labels) still renders
  in English — locale-aware vocabulary is a v1.1+ scope per the spec.
- AI responses (Abby) still respond in English regardless of user locale
  — locale-aware LLM prompting is v1.1+.
- No automated string-extraction CI yet; pseudolocale renders correctly
  but enforcement that new strings flow through `t()` is manual today.

## Next steps

Per the spec's "expand in waves" plan:
1. Translation/review/QA per production language (1-3 weeks each)
2. Localize remaining UX surfaces (workbench, FinnGen browser, analyses)
3. Backend email / export / report localization
4. Locale-aware Abby responses
5. Locale-aware vocabulary lookups (where vocab data exists)

## References

- Spec: `docs/superpowers/specs/2026-04-17-parthenon-native-i18n-plan.md`
- i18next docs: https://www.i18next.com
- Laravel localization: https://laravel.com/docs/12.x/localization
- W3C i18n / RTL guidance: https://www.w3.org/International/questions/qa-html-dir
