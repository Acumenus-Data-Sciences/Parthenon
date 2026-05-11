# Abby Chat Streaming Fix

Date: 2026-04-07

## Summary

Abby chat had three separate streaming failures in production.

The frontend was still falling back to non-streaming when the SSE response did not present the exact `text/event-stream` header, the `python-ai` service could throw a 500 before any Abby response because PHI scanning required a missing spaCy model, and the Ask Abby server route for `commons_ask_abby` was not actually token streaming at all for the normal path.

This pass fixed all three, redeployed the frontend, restarted `python-ai`, and verified live SSE behavior through `https://parthenon.acumenus.net`.

## Root Causes

### Frontend fallback logic

Two Abby clients still required:

- `response.headers.get("content-type")?.includes("text/event-stream")`

That made the UI fall back to the non-streaming JSON endpoint even when the response body was a valid SSE stream passing through Apache and Laravel.

### PHI sanitizer hard failure

The `python-ai` logs showed:

- `OSError: [E050] Can't find model 'en_core_web_sm'`

The PHI sanitizer treated missing spaCy runtime assets as fatal, so Abby chat could emit `conversation_id` and then die with a 500 before any useful stream content reached the browser.

### Ask Abby route was not truly streaming

For `page_context=commons_ask_abby`, `/abby/chat/stream` previously called the completed `chat()` path and only wrapped the final answer in SSE framing. That preserved the response contract but not incremental token delivery.

## What Changed

Primary files:

- `frontend/src/components/layout/AbbyPanel.tsx`
- `frontend/src/features/commons/services/abbyService.ts`
- `ai/app/routing/phi_sanitizer.py`
- `ai/app/routers/abby.py`
- `ai/tests/test_phi_sanitizer.py`
- `ai/tests/test_abby_integration.py`

Key changes:

- Abby frontend streaming now proceeds whenever the response is OK and `response.body` exists.
- PHI sanitization now degrades to regex-only scanning when spaCy or `en_core_web_sm` is unavailable.
- Ask Abby streaming now uses a real streaming route instead of forcing the completed `chat()` response into SSE.
- grounded/static Abby replies are chunked into multiple SSE token events so they also render incrementally in the UI.
- regression tests were added for missing spaCy model fallback and for the Ask Abby streaming path selection.

## Verification

Local checks that passed:

- `npx tsc --noEmit`
- `python3 -m pytest ai/tests/test_phi_sanitizer.py`
- `python3 -m pytest ai/tests/test_abby_integration.py -k 'commons_ask_abby_stream_uses_streaming_path or stream_grounded_definition_emits_sources_event'`

Live checks after deploy and `python-ai` restart:

- frontend deploy succeeded via `./deploy.sh --frontend`
- `https://parthenon.acumenus.net/api/v1/abby/chat/stream` returned incremental `data: {"token": ...}` events for a normal Ask Abby prompt
- grounded Ask Abby prompts also returned multiple token events instead of a single completed blob
- the prior PHI sanitizer 500 no longer reproduced
