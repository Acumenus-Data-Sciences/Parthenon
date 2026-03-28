# Commons: LiveKit Cloud Configuration & Provider Switching

**Date:** 2026-03-28
**Commit:** `ca55cf17b` — `feat(commons): add LiveKit Cloud config with System Health panel`

## Summary

Deployed LiveKit Cloud as the default voice/video call provider for Commons, replacing the local dev server. Added a System Health panel that allows super-admins to switch between three LiveKit providers at runtime without redeploying.

## What Changed

### LiveKit Cloud Setup
- Registered LiveKit Cloud project (`acropolis-14vd9042.livekit.cloud`)
- Updated backend `.env` with Cloud credentials (`wss://` endpoint, API key, API secret)
- Installed `livekit-server` v1.10.0 to `~/bin/` for local/LAN fallback

### System Settings Infrastructure
- **New table:** `system_settings` — encrypted key-value store for runtime configuration
- **New model:** `App\Models\App\SystemSetting` — `getValue()`, `setValue()`, `getGroup()` with automatic encryption/decryption for secrets via Laravel's `Crypt` facade
- This is a generic infrastructure piece — any future runtime config (mail providers, AI model selection, etc.) can use the same table

### LiveKit Config API (super-admin only)
- `GET /api/v1/admin/livekit-config` — current provider, URL, key/secret presence flags
- `PUT /api/v1/admin/livekit-config` — update provider and credentials
- `POST /api/v1/admin/livekit-config/test` — test connection to any LiveKit URL
- Routes gated with `role:super-admin` middleware

### CallService Dynamic Config Resolution
- `CallService::resolveLiveKitConfig()` reads from `system_settings` DB first
- Falls back to `config('services.livekit.*')` (`.env` values) if DB has no override or provider is set to `env`
- Zero-downtime provider switching — no PHP restart needed when changing via UI

### System Health Integration
- LiveKit now appears as a service card in the System Health dashboard
- Shows connection status, provider type (Cloud/Self-hosted/Env), and server URL
- Card expands into a full configuration panel with:
  - Three-way provider toggle (Environment / LiveKit Cloud / Self-hosted)
  - URL, API Key, API Secret fields (secrets masked, encrypted at rest)
  - Test Connection button
  - Save button

## Architecture

```
┌─────────────────────────────────────────────┐
│            System Health Page                │
│  ┌───────────────────────────────────────┐  │
│  │  LiveKit Config Panel                 │  │
│  │  [Env] [Cloud] [Self-hosted]          │  │
│  │  URL: wss://...livekit.cloud          │  │
│  │  [Test Connection] [Save]             │  │
│  └───────────────────────────────────────┘  │
└─────────────────┬───────────────────────────┘
                  │ PUT /admin/livekit-config
                  ▼
┌─────────────────────────────────────────────┐
│  LiveKitConfigController                    │
│  → SystemSetting::setValue() (encrypted)    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  system_settings table                      │
│  livekit_provider = "cloud"                 │
│  livekit_url = "wss://..."                  │
│  livekit_api_key = [encrypted]              │
│  livekit_api_secret = [encrypted]           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  CallService::resolveLiveKitConfig()        │
│  1. Check DB (system_settings)              │
│  2. Fallback to config('services.livekit')  │
│  → Issues JWT token with resolved creds     │
└─────────────────────────────────────────────┘
```

## Provider Modes

| Mode | When to Use | Config Source |
|------|-------------|---------------|
| **Env** (default) | Initial setup, CI, local dev | `backend/.env` LIVEKIT_* vars |
| **Cloud** | Production, external access | DB (encrypted), LiveKit Cloud hosted |
| **Self-hosted** | Full control, Traefik/Acropolis | DB (encrypted), your own server |

## Files Changed

| File | Change |
|------|--------|
| `backend/database/migrations/2026_03_28_000001_create_system_settings_table.php` | New migration |
| `backend/app/Models/App/SystemSetting.php` | New encrypted key-value model |
| `backend/app/Http/Controllers/Api/V1/Admin/LiveKitConfigController.php` | New config CRUD + test |
| `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` | Added `checkLiveKit()` |
| `backend/app/Services/Commons/CallService.php` | DB-first config resolution |
| `backend/routes/api.php` | LiveKit config routes (super-admin) |
| `frontend/src/features/administration/api/adminApi.ts` | LiveKit API functions |
| `frontend/src/features/administration/hooks/useAiProviders.ts` | LiveKit query hooks |
| `frontend/src/features/administration/components/LiveKitConfigPanel.tsx` | New config panel |
| `frontend/src/features/administration/pages/SystemHealthPage.tsx` | Integrated panel |

## Next Steps

- Move to self-hosted LiveKit behind Traefik when Acropolis infrastructure is ready (Option A)
- Add TURN server configuration for restrictive firewalls
- Call history/analytics dashboard
