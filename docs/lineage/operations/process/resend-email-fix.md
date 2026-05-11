# Resend Email Delivery Fix

**Date:** 2026-03-06
**Status:** Shipped

## What Was Fixed

Registration emails were silently failing — temp passwords only appeared in Laravel logs instead of being delivered via Resend. Four separate bugs prevented email delivery, and the email template didn't match the application's design system.

## Root Causes

### Bug 1: Empty API Key File
`.resendapikey` at the repo root existed but was 0 bytes. Copied the working Resend API key from the MediCosts project (same Acumenus account).

### Bug 2: Wrong File Path in Docker
`AppServiceProvider` used `base_path('../../.resendapikey')` which resolves to `/.resendapikey` (filesystem root) inside the Docker container where `base_path()` = `/var/www/html`. The file was never found, so the mailer always fell back to `log`.

**Fix:** Check two locations in priority order:
1. `/var/www/.resendapikey` — Docker volume mount from repo root
2. `base_path('../.resendapikey')` — local dev without Docker

### Bug 3: No Docker Volume Mount
The `.resendapikey` file wasn't mounted into either the `php` or `horizon` containers.

**Fix:** Added read-only volume mount to both services in `docker-compose.yml`:
```yaml
- ./.resendapikey:/var/www/.resendapikey:ro
```

### Bug 4: Wrong Config Key
Was setting `resend.api_key` but Laravel's `MailManager::createResendTransport()` reads from `$config['key'] ?? config('services.resend.key')`.

**Fix:** Changed to `'services.resend.key' => $key`.

### Missing Dependency
The `resend/resend-php` SDK wasn't in `composer.json`. Laravel 11 has a built-in `ResendTransport` class but it imports the `Resend` facade from the SDK package.

**Fix:** `composer require resend/resend-php`

## Email Template Redesign

The original template used CSS-styled `<div>` elements (stripped by many email clients) and had colors that didn't match the application. Rewrote to:

- **Table-based layout** — works across Gmail, Outlook, Apple Mail, etc.
- **Parthenon design system colors:**
  - Surfaces: `#08080A`, `#0E0E11` (dark stack)
  - Text: `#F0EDE8` (primary), `#8A857D` (muted), `#5A5650` (ghost)
  - Borders: `#2A2A30`
  - Password highlight: `#C9A227` (research gold)
  - CTA button: crimson gradient `#9B1B30` → `#6A1220` with glow
  - Password border: `rgba(155,27,48,0.4)` (crimson border)
- **Single-color "Parthenon" title** — no two-tone split
- **Crimson accent line** above title (matches login page pattern)
- **Footer:** "If you did not request this account" disclaimer

## Additional Config

Set in `backend/.env`:
```
MAIL_FROM_ADDRESS=noreply@acumenus.net
MAIL_FROM_NAME=Parthenon
```

Previously defaulted to `hello@example.com` / `Example`.

## Lessons Learned (MediCosts Reference)

The MediCosts project (Node.js + Resend SDK) had a working implementation that served as reference:
- Same `.resendapikey` file pattern at project root
- Same `FROM_EMAIL=noreply@acumenus.net` convention
- Table-based HTML email template (email-client safe)
- Identical registration flow: temp password → email → must_change_password → blocking modal

Key difference: MediCosts uses the Resend JS SDK directly, while Parthenon uses Laravel's built-in mail transport which wraps the Resend PHP SDK. The Laravel approach requires both the `resend/resend-php` package AND the correct config key at `services.resend.key`.

## Files Modified

| File | Change |
|------|--------|
| `backend/app/Providers/AppServiceProvider.php` | Fixed key file path resolution + config key |
| `backend/resources/views/emails/temp-password.blade.php` | Complete redesign to match design system |
| `backend/composer.json` / `composer.lock` | Added `resend/resend-php` |
| `docker-compose.yml` | Added `.resendapikey` volume mount to php + horizon |
| `backend/.env` | Added `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME` |
| `.resendapikey` | Populated with Resend API key |
