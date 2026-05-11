# Studies Module — Next-Gen UX Enhancements Devlog

**Date:** 2026-03-04
**Scope:** Fix hardcoded form stubs, add filtering/sorting, detail page actions, create wizard polish

---

## Phase 1 — Fix "Add" Form Stubs (4 tabs)

### StudySitesTab
- Replaced hardcoded `source_id: 1` with searchable source picker via `useSources()`
- Inline form: source search, role select, IRB #, notes
- Filters out sources already assigned as sites

### StudyTeamTab
- Replaced hardcoded `user_id: 1` with searchable user picker via `useUsers()`
- User search filters by name and email, shows avatar initials
- 10 roles with descriptions, filters out users already on team

### StudyCohortsTab
- Replaced hardcoded `cohort_definition_id: 1` with cohort picker via `useCohortDefinitions()`
- Added inline edit (role/label/description) using existing `useUpdateStudyCohort` hook
- Added `event` role to COHORT_ROLES

### StudyArtifactsTab
- Replaced hardcoded "New Document" with proper form (title, type, version, description, URL)
- 14 artifact types, inline edit using existing `useUpdateStudyArtifact` hook
- URL display with external link icon

---

## Phase 2 — Listing Page Enhancements

### Filter Chips (StudiesPage.tsx)
- Status, Type, and Priority filter chip rows below stats bar
- Status and Type filters passed to backend (`listStudies` already accepts these params)
- Priority filter applied client-side
- "Clear" button when any filter active
- Togglable pills with tinted backgrounds matching each option's color

### Column Sorting (StudyList.tsx)
- Clickable Title, Type, Status, Priority, Created column headers
- Client-side sort with ascending/descending toggle
- Priority sort uses custom order (critical > high > medium > low)
- ChevronUp/Down indicator on active sort column

### HelpButton
- Added `HelpButton helpKey="studies"` to listing page header

---

## Phase 3 — Detail Page Enhancements

### Tab Count Badges (StudyDetailPage.tsx)
- Eagerly fetches all sub-resource counts: sites, team, cohorts, milestones, artifacts
- Displays count in tab label: "Sites (3)", "Team (5)", etc.
- Uses existing hooks (no new API calls)

### Action Buttons
- **Duplicate** — creates copy with "Copy of" prefix, navigates to new study
- **Export JSON** — client-side Blob download of study metadata
- **Archive** — transitions to "archived" status (only shown if allowed)
- All buttons in ghost style with tooltips, Delete kept as danger

### Tab Overflow Styling
- `scrollbar-width: none` on tab bar for clean horizontal overflow

---

## Phase 4 — Create Wizard Polish

### Date Validation (StudyCreatePage.tsx)
- End date must be after start date when both provided
- Red border on end date input + inline error message
- "Next" button disabled when validation fails

### HelpButton
- Added `HelpButton helpKey="studies"` to create wizard header

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/features/studies/components/StudySitesTab.tsx` | Source picker form |
| `frontend/src/features/studies/components/StudyTeamTab.tsx` | User search/picker |
| `frontend/src/features/studies/components/StudyCohortsTab.tsx` | Cohort picker + inline edit |
| `frontend/src/features/studies/components/StudyArtifactsTab.tsx` | Proper create form + inline edit |
| `frontend/src/features/studies/pages/StudiesPage.tsx` | Filter chips + HelpButton |
| `frontend/src/features/studies/components/StudyList.tsx` | Column sorting |
| `frontend/src/features/studies/pages/StudyDetailPage.tsx` | Tab counts, action buttons, overflow |
| `frontend/src/features/studies/pages/StudyCreatePage.tsx` | Date validation + HelpButton |
| `frontend/src/features/studies/hooks/useStudies.ts` | Filter params support |

## Key Patterns
- All tab forms follow MilestonesTab inline form pattern (showAdd toggle → panel)
- Cross-feature hook imports for picker data (useSources, useUsers, useCohortDefinitions)
- Client-side filtering excludes already-assigned items
- No new backend endpoints needed — all existing APIs reused
