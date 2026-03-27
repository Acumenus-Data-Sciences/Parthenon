---
phase: quick-6
plan: 01
subsystem: ui
tags: [react, strategus, ohdsi, json-editor, wizard]

requires:
  - phase: none
    provides: existing Strategus wizard with 5 steps
provides:
  - Per-module settings types and defaults for all 8 Strategus modules
  - Module configuration panels with cohort multi-select from shared cohorts
  - JSON spec preview/editor with validation and clipboard support
  - 7-step wizard (Study Info > Select Modules > Shared Cohorts > Module Settings > JSON Preview > Review & Validate > Execute)
affects: [strategus, study-packages]

tech-stack:
  added: []
  patterns: [collapsible config panels, json-editor-with-validation, module-settings-map]

key-files:
  created:
    - frontend/src/features/strategus/components/ModuleConfigPanels.tsx
    - frontend/src/features/strategus/components/JsonSpecEditor.tsx
  modified:
    - frontend/src/features/strategus/types.ts
    - frontend/src/features/strategus/pages/StudyPackagePage.tsx

key-decisions:
  - "ModuleSettings as union type with per-module typed interfaces and getDefaultSettings factory"
  - "specOverride pattern: manual JSON edits override generated spec, reset on any upstream change"
  - "Cohort ID fields use multi-select checkboxes filtered by role, not free-text input"

patterns-established:
  - "Module config panels: collapsible sections with typed settings, cohort multi-select from shared cohorts"
  - "JSON editor: textarea with on-blur parse validation, Apply Changes button, Copy/Reset actions"
  - "Spec override state: null = use generated, non-null = use manual edit, resets on upstream changes"

requirements-completed: [STRAT-01]

duration: 7min
completed: 2026-03-27
---

# Quick Task 6: Strategus JSON Spec Builder UI Summary

**Per-module configuration panels for all 8 OHDSI Strategus modules with live JSON preview/editor and 7-step wizard**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-27T20:07:07Z
- **Completed:** 2026-03-27T20:14:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added typed settings interfaces with defaults for all 8 Strategus modules (CohortMethod, PLP, SCCS, CohortDiagnostics, Characterization, CohortIncidence, EvidenceSynthesis, CohortGenerator)
- Created collapsible module config panels with cohort multi-select, numeric inputs, toggles, and dropdowns
- Created JSON spec editor with syntax validation, clipboard copy, and reset-to-generated
- Expanded wizard from 5 to 7 steps: inserted Module Settings and JSON Preview between Shared Cohorts and Review

## Task Commits

1. **Task 1: Add per-module settings types and configuration panels** - `017c010d7` (feat)
2. **Task 2: Add JSON preview/editor and wire new steps into wizard** - `be04eecd2` (feat)

## Files Created/Modified

- `frontend/src/features/strategus/types.ts` - Added 8 module settings interfaces, ModuleSettings union, ModuleSettingsMap, getDefaultSettings()
- `frontend/src/features/strategus/components/ModuleConfigPanels.tsx` - Per-module config forms with collapsible sections (580+ lines)
- `frontend/src/features/strategus/components/JsonSpecEditor.tsx` - JSON textarea with parse validation, copy, reset (130+ lines)
- `frontend/src/features/strategus/pages/StudyPackagePage.tsx` - Integrated new components, 7-step wizard, moduleSettings + specOverride state

## Decisions Made

- Used typed union (ModuleSettings) with satisfies checks in getDefaultSettings for type safety without runtime overhead
- specOverride pattern: when user edits JSON manually, it overrides the generated spec; resets to null whenever modules, cohorts, or settings change upstream
- Cohort ID fields rendered as multi-select checkboxes filtered by role (target/comparator/outcome) rather than free-text, populated from shared cohorts step
- CohortGeneratorModule shows "No configuration needed" info since it auto-generates from shared definitions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vite not installed on host (runs in Docker) - used `docker compose exec node` for vite build verification

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Module settings now flow into the Strategus spec; backend R runtime will receive populated settings
- Ready for backend validation of module-specific settings if needed

---
*Phase: quick-6*
*Completed: 2026-03-27*
