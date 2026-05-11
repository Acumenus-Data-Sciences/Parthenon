# VCF Upload 422 Fix & Large File Support

**Date:** 2026-03-18
**Type:** bugfix + feature
**Module:** Genomics

## Problem

VCF file uploads failed with HTTP 422 (Unprocessable Content). Two root causes identified:

1. **Wrong default source ID** — `UploadDialog` component hardcoded `sourceId ?? 9` as fallback, but only source ID 2 ("Acumenus CDM") exists in the database. Laravel's `exists:sources,id` validation rejected the request.

2. **Upload size limit too low** — Laravel validation capped file uploads at 200 MB (`max:204800`), while PHP/Nginx were already configured for 5 GB. Files over 200 MB would also return 422.

3. **No async parsing for large files** — Files over 10 MB hit the `else` branch which had no job dispatch, leaving uploads stuck in "parsing" status forever.

## Changes

### Frontend
- `frontend/src/features/genomics/components/UploadDialog.tsx` — Changed default `sourceId` fallback from `9` to `2`

### Backend
- `backend/app/Http/Controllers/Api/V1/GenomicsController.php`:
  - Raised file validation limit from 200 MB to 5 GB (`max:5242880`)
  - Added `ParseGenomicUploadJob::dispatch()` for files >= 10 MB
- `backend/app/Jobs/ParseGenomicUploadJob.php` — New queue job for async VCF parsing (2-hour timeout, `genomics` queue)
- `backend/config/horizon.php` — Added `genomics` queue supervisor (2 max processes, 1 GB memory, 2-hour timeout)

### Infrastructure (already configured, no changes needed)
- `docker/php/php.ini` — `upload_max_filesize` and `post_max_size` already 5120M
- `docker/nginx/default.conf` — `client_max_body_size` already 5120M

## Verification

- Upload a small VCF file (< 10 MB) — should parse synchronously
- Upload a large VCF file (> 10 MB) — should show "parsing" status, then async complete via Horizon
- Check Horizon dashboard for `genomics` queue worker activity
