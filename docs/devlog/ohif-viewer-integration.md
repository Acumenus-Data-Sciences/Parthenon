# OHIF Viewer Integration

**Date:** 2026-03-06/07
**Scope:** Replace custom Cornerstone3D viewer with OHIF Viewers

## What Changed

### Problem
Parthenon had a custom 723-line Cornerstone3D v4 viewer (`DicomViewer.tsx`) with 14 tools, CINE playback, and window presets. While functional, it required ongoing maintenance and lacked features available in mature DICOM viewer platforms (MPR, 3D volume rendering, hanging protocols, structured report support, multi-viewport layouts).

### Solution
Replaced with [OHIF Viewers](https://github.com/OHIF/Viewers) — an NIH-funded, MIT-licensed, zero-footprint web DICOM viewer — served as static files through the existing nginx container and backed by Orthanc PACS for DICOMweb.

### Architecture

```
Local DICOM files ──→ DicomFileService ──→ DB metadata + Orthanc (STOW)
                                                  ↓
OHIF Viewer (iframe at /ohif/) ──→ Orthanc DICOMweb ──→ renders in browser
```

- **OHIF** is served as static files (not a separate container) via a named Docker volume (`ohif-dist`). A one-time `ohif-build` setup service copies files from the official `ohif/app:v3.9.2` image.
- **Orthanc** (`orthancteam/orthanc:latest`, v1.12.10) runs as a Docker service with DICOMweb plugin enabled via env vars.
- **Nginx** proxies `/ohif/` to static files and `/orthanc/` to the Orthanc container. No additional nginx container needed.

### Files Created
- `docker/ohif/app-config.js` — OHIF config pointing DICOMweb at `/orthanc/`
- `frontend/src/features/imaging/components/OhifViewer.tsx` — thin iframe wrapper (~90 lines)
- `docs/devlog/ohif-viewer-integration.md` — this file

### Files Modified
- `docker-compose.yml` — added `orthanc` service, `ohif-build` setup service, `ohif-dist` + `orthanc-data` volumes, nginx mount
- `docker/nginx/default.conf` — added `/ohif/` (static alias) and `/orthanc/` (reverse proxy with rewrite) location blocks
- `frontend/src/features/imaging/pages/ImagingStudyPage.tsx` — swapped DicomViewer for OhifViewer
- `frontend/package.json` — removed 4 Cornerstone3D packages
- `backend/app/Services/Imaging/DicomwebService.php` — added `stowInstance()` / `stowInstances()` for Orthanc upload
- `backend/app/Services/Imaging/DicomFileService.php` — injected DicomwebService, pushes files to Orthanc after DB persist

### Files Deleted
- `frontend/src/features/imaging/components/DicomViewer.tsx` (723 lines)

### NPM Packages Removed
- `@cornerstonejs/core`
- `@cornerstonejs/tools`
- `@cornerstonejs/dicom-image-loader`
- `dicom-parser`

## Gotchas & Lessons

1. **OHIF is a full app, not a component library** — cannot `import { Viewer }` into React. iframe embedding is the practical integration path.
2. **orthancteam/orthanc image versioning** — tags like `18.1.4` are from 2018 (Docker image version, not Orthanc version). Use `latest` for current Orthanc.
3. **Orthanc config file conflicts** — the orthancteam image ships multiple JSON configs in `/etc/orthanc/`. Mounting your own `orthanc.json` with keys like `HttpPort` causes "defined in 2 files" fatal errors. Use env vars (`ORTHANC__*`) instead.
4. **nginx variable URI behavior** — `proxy_pass $variable/` does NOT strip the location prefix like `proxy_pass http://upstream/` does. Must use `rewrite ^/prefix/(.*) /$1 break;` explicitly.
5. **nginx reload vs recreate** — bind-mounted config changes require `docker compose up -d` (recreate), not just `nginx -s reload`, if the container was created before the mount existed.
6. **Orthanc healthcheck** — the orthancteam image has no `curl` or `wget`. Use `python3 -c "import urllib.request; ..."` for healthchecks.
7. **OHIF static files permissions** — the official `ohif/app` image runs as non-root nginx user. The `ohif-build` service needs `user: root` to copy files into the named volume.
8. **STOW-RS vs Orthanc REST** — Orthanc's native `POST /instances` with `Content-Type: application/dicom` is simpler and more reliable than STOW-RS multipart for single-file uploads.

## Setup Commands

```bash
# One-time: build OHIF static files into Docker volume
docker compose --profile setup run --rm ohif-build

# Start Orthanc + reload nginx
docker compose up -d orthanc nginx

# Verify
curl -sf http://localhost:8082/ohif/          # OHIF viewer
curl -sf http://localhost:8082/orthanc/system  # Orthanc API
```

## What OHIF Gains Over Custom Viewer

- 30+ tools (vs 14) including MPR, 3D volume rendering, fusion
- Automatic hanging protocols
- Built-in study browser / worklist
- DICOM SR, SEG, RT structure support
- Longitudinal measurement tracking
- Multi-viewport layouts (2×2, MPR, etc.)
- Active NIH-funded development community
- Zero maintenance burden on our side
