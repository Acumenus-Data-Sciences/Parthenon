# Publish — Researcher Draft Autosave Devlog

**Date:** 2026-04-14  
**Area:** Publish / Pre-publication Document Generator  
**Status:** Shipped and under hardening review

## Summary

The Publish page now follows the same durable in-progress work pattern introduced for Patient Similarities. A researcher can begin composing a manuscript, leave the page, and reopen the work later from a per-user draft selector instead of relying only on browser session storage.

## What Shipped

- Added backend persistence for publication drafts in `publication_drafts`.
- Added authenticated draft endpoints:
  - list drafts
  - create draft
  - show draft
  - update draft
  - delete draft
- Added a **My Drafts** selector to the Publish page header.
- Added debounced autosave for meaningful wizard progress.
- Added draft hydration so opening a saved draft restores:
  - selected analyses
  - generated manuscript sections
  - title
  - authors
  - template
  - current wizard step
- Kept session storage as a local fallback for transient browser state.

## Implementation Notes

The draft document payload stores the wizard state as JSON so the page can evolve without requiring a new relational table for every section-level field. The backend still stores searchable metadata alongside the JSON document:

- user id
- optional study id
- title
- template
- status
- last opened timestamp

Draft ownership is enforced server-side before show, update, or delete operations. The migration uses indexed ID columns instead of cross-table foreign keys to avoid the same role-ownership constraint encountered while deploying Patient Similarity persistence migrations.

## UX Pattern

This is now the common pattern for long-running researcher workflows:

- autosave meaningful progress to the backend
- expose saved work through a workflow-specific user dropdown
- restore complete state from the saved artifact
- retain local storage only as a convenience fallback

## Verification Before Hardening Pass

- PHP lint passed for the controller, model, and migration.
- Frontend TypeScript passed.
- Focused Publish Vitest coverage passed.
- The migration was applied as `parthenon_migrator`.
- PHP and frontend deploys completed successfully with smoke checks.

## Hardening Review Focus

The next review pass should verify:

- no user can access another user's draft
- autosave does not create duplicate first drafts under rapid edits
- draft hydration cannot be overwritten by stale autosave payloads
- invalid or partial stored JSON fails closed
- Publish header controls remain aligned with the Patient Similarity saved-work selector pattern
