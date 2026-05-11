# Cohort Wizard — Design Specification

**Date:** 2026-04-10
**Status:** Approved
**Author:** Claude + Dr. Sanjay Udoshi

## Problem Statement

The current "New Cohort Definition" flow creates an empty OHDSI expression and drops users into a 10-section collapsible form that assumes deep familiarity with OHDSI mechanics — concept sets, temporal coefficients, expression JSON structure, and epidemiological terminology. Even experienced physician researchers find it difficult to create cohorts because the interface speaks OHDSI, not clinical language.

### Specific Deficiencies

1. **Cold start** — Empty form with 10 collapsed sections, no guidance, no examples.
2. **No concept browser** — `ConceptSetPicker` creates empty named sets with no way to search/browse OMOP vocabulary inline. Users must know concept IDs or populate sets elsewhere.
3. **Cryptic temporal logic** — `Coeff: -1`, `UseEventEnd`, `UseIndexEnd` have zero tooltips or explanation.
4. **Nested boolean logic** — ALL/ANY/NONE groups with recursive nesting, distinguished only by border colors. Powerful but disorienting.
5. **No validation or hints** — Invalid expressions are silently accepted.
6. **No draft persistence** — Unsaved changes lost on refresh.
7. **Domain jargon** — "Observation Window", "Qualified Limit", "Censoring Criteria", "Era Pad" mean nothing to someone new to OHDSI.

## Solution Overview

Replace the "New Cohort Definition" button with a **"Cohort Wizard"** button that launches a guided, chapter-based wizard. The wizard translates OHDSI mechanics into clinical language, embeds the existing vocabulary search panels for concept discovery, and produces a valid `CohortExpression` JSON at the end.

The current expression editor becomes the **"Advanced Editor"** — a fallback for power users who need nested boolean logic, custom temporal windows, or direct expression manipulation. The wizard creates; the editor refines. One-way handoff.

## Target Audience

Full range of users, from clinical end-users to experienced informaticists. The wizard must work for:
- Physician researchers who think in clinical terms ("patients with diabetes on metformin")
- Data analysts comfortable with SQL but new to OMOP CDM
- Clinical end-users with no technical background

## Architecture

### Wizard Structure: Guided Chapters

The wizard uses a **chapter-based layout** with a persistent sidebar:

- **Left sidebar (~240px):** All 6 chapters listed with completion state (checkmark, in-progress indicator, or pending), sub-steps visible under each chapter. Chapters are clickable for non-linear navigation. Incomplete chapters show a yellow warning badge.
- **Main content area:** Active chapter's current step with Back/Next navigation at the top-right.
- **Progressive disclosure:** Chapter 5 (Specialized) collapsed by default with opt-in gate.

### Chapter Map

| Chapter | Clinical Question | Steps | OHDSI Expression Mapping |
|---|---|---|---|
| 1. Basics | What are you studying? | Name, description, domain tag, tags | Cohort metadata fields |
| 2. Define Population | Who enters the cohort? | Entry events, observation window, qualifying limit | `PrimaryCriteria`, `QualifiedLimit` |
| 3. Refine & Filter | What else must be true? | Inclusion rules, demographics, risk scores | `AdditionalCriteria`, `DemographicCriteria`, `RiskScoreCriteria` |
| 4. Follow-up & Exit | How long are they followed? | End strategy, censoring events | `EndStrategy`, `CensoringCriteria`, `CollapseSettings` |
| 5. Specialized *(optional)* | Any molecular or imaging criteria? | Genomic criteria, imaging criteria | `GenomicCriteria`, `ImagingCriteria` |
| 6. Review & Generate | Does this look right? | Plain-English summary, generate cohort, handoff | Full `CohortExpression` assembly |

### Relationship to Advanced Editor

- **Wizard creates, editor refines.** The wizard produces a complete `CohortExpression`, then users can optionally switch to the Advanced Editor (the current expression editor, renamed) for fine-tuning.
- **One-way handoff.** Once the user opens the Advanced Editor, they stay there. There is no bidirectional sync back to wizard view.
- **The Advanced Editor is not hidden.** It remains accessible from the cohort detail page for power users who prefer it. The wizard is the default entry point for new cohort creation.

## Chapter Details

### Chapter 1: Basics

**Steps:** Single step.

**Fields:**
- **Name** (required) — Text input, auto-focused on entry.
- **Description** (optional) — Textarea for clinical context.
- **Domain** — Dropdown selector (cardiovascular, metabolic, renal, oncology, rare-disease, pain-substance-use, pediatric, general). Used for categorization and Abby AI context.
- **Tags** (optional) — Tag input for organizational labels.

**Validation:** Name is required before advancing.

### Chapter 2: Define Population

**Steps:** 3 sub-steps.

#### Step 1: Entry Events

**Clinical framing:** "What clinical events qualify a patient for entry into your cohort?"

**Concept selection:** Embeds the `WizardConceptPicker` component (see Component Architecture below), which wraps the existing vocabulary search panels with three tabs:
- **Keyword** — `VocabularySearchPanel` with `mode="build"`
- **Semantic (AI)** — `SemanticSearchPanel` with `mode="build"` (Hecate)
- **Browse Hierarchy** — `HierarchyBrowserPanel`

Users search for clinical terms, click to add concepts. Each selected concept shows:
- Concept ID, name, domain badge, vocabulary badge
- **"Include descendants"** toggle (default ON) — with tip explaining sub-type inclusion
- **"Include mapped"** toggle (default OFF)
- Remove button (✕)

**Concept set auto-creation:** The wizard invisibly creates a named concept set using the convention `"Entry: {primary concept name}"`. Users never see concept set plumbing. The auto-generated set is added to the expression's `ConceptSets` array with an auto-incremented ID.

**"Ask Abby" button:** Opens an inline prompt where users can describe what they want in clinical language. Abby suggests concepts based on the wizard context (domain, description).

**Multiple entry events:** Users can add entry events from different domains (e.g., a Condition and a Drug). Each "Add entry event" action opens the concept picker with a domain selector. A patient matching *any* entry event qualifies. Each entry event gets its own auto-named concept set. This maps to multiple entries in `PrimaryCriteria.CriteriaList`, matching the existing expression structure.

#### Step 2: Observation Window

**Clinical framing:** "How much medical history must a patient have before and after their entry event?"

**Controls:**
- **Prior days** — Number input with label "Days of history required before entry" (default: 0)
- **Post days** — Number input with label "Days of follow-up required after entry" (default: 0)

**Tip:** "This ensures patients have enough data for your study. For example, requiring 365 days of prior history ensures you can check for pre-existing conditions."

Maps to: `PrimaryCriteria.ObservationWindow.PriorDays` / `PostDays`.

#### Step 3: Qualifying Events

**Clinical framing:** "If a patient has multiple qualifying events, which one defines their cohort entry?"

**Controls:** Radio-style cards:
- **First event** (default, recommended) — "Use the earliest qualifying event as the entry date"
- **All events** — "Each qualifying event creates a separate cohort entry period"

Maps to: `QualifiedLimit.Type` ("First" or "All") and `ExpressionLimit.Type`.

### Chapter 3: Refine & Filter

**Steps:** 3 sub-steps, each optional.

#### Step 1: Inclusion Rules

**Clinical framing:** "What additional requirements must a patient meet to stay in the cohort?"

**Sentence-pattern builder:** Each inclusion rule is constructed as a natural sentence:

> "Require [at least / at most / exactly] [N] [domain] of [concept set] occurring [temporal preset or custom range]"

**Sentence components:**
- **Occurrence operator:** Dropdown — "at least", "at most", "exactly"
- **Count:** Number input
- **Domain:** Dropdown — condition, drug exposure, procedure, measurement, observation, visit
- **Concept set:** Inline concept picker (same `WizardConceptPicker` as Chapter 2). Auto-names set as `"Inclusion: {concept name}"`.
- **Temporal range:** Preset selector or custom range (see Temporal Logic below)
- **"Restrict to same visit":** Checkbox

**Temporal presets:** One-click shortcuts for common patterns:
- "Any time before" — `Start: {Days: 99999, Coeff: -1}, End: {Days: 0, Coeff: -1}`
- "Any time after" — `Start: {Days: 0, Coeff: 1}, End: {Days: 99999, Coeff: 1}`
- "Same day" — `Start: {Days: 0, Coeff: -1}, End: {Days: 0, Coeff: 1}`
- "Within 30 days" — `Start: {Days: 30, Coeff: -1}, End: {Days: 30, Coeff: 1}`
- "Within 90 days" — `Start: {Days: 90, Coeff: -1}, End: {Days: 90, Coeff: 1}`
- "Any time" — no temporal restriction (omit window)

Selecting a preset fills the custom range fields, which the user can then adjust.

**Custom temporal range:** Plain-language sentence construction:
> "between [N] days [before/after] and [N] days [before/after] cohort entry"

Maps `before` → `Coeff: -1`, `after` → `Coeff: 1` internally. User never sees coefficients.

**Live preview:** Below each rule, a rendered sentence shows the complete rule in plain English.

**Boolean logic:** Multiple rules use a single flat **ALL / ANY / NONE** toggle at the top:
- **ALL** — Patient must match every rule (conjunctive, default)
- **ANY** — Patient must match at least one rule (disjunctive)
- **NONE** — Patient must match zero rules (negation / exclusion)

This covers ~90% of real cohort definitions. For nested boolean logic (e.g., "ALL of A + (ANY of B or C)"), users graduate to the Advanced Editor.

Maps to: `AdditionalCriteria.Type` and `AdditionalCriteria.CriteriaList`.

**Exclusion shortcut:** When a user sets occurrence to "exactly 0" with "any time before", the rule card shows an "exclusion" badge for visual clarity.

#### Step 2: Demographics

**Clinical framing:** "Any age, gender, race, or ethnicity restrictions?"

**Controls:**
- **Age range:** Min/max number inputs with labels "Minimum age" / "Maximum age"
- **Gender:** Toggle buttons — Male (8507) / Female (8532) / Both (default)
- **Race:** Multi-select checkboxes (standard OHDSI concept IDs)
- **Ethnicity:** Multi-select checkboxes (standard OHDSI concept IDs)

Each criterion is optional. Only populated fields are added to the expression.

Maps to: `DemographicCriteriaList[]`.

#### Step 3: Risk Scores

**Clinical framing:** "Filter by any pre-computed clinical risk scores?"

**Controls:** Card-based builder:
- **Score name:** Dropdown of available risk scores
- **Operator:** >, ≥, <, ≤, =
- **Value:** Number input
- **Tier** (optional): Dropdown of score tiers

"Add risk score filter" button adds additional criteria. Each shows as a card with remove button.

Maps to: `RiskScoreCriteria[]`.

### Chapter 4: Follow-up & Exit

**Steps:** 2 sub-steps.

#### Step 1: End Strategy

**Clinical framing:** "When does a patient's cohort membership end?"

**Controls:** Three radio-style cards:

1. **End of continuous observation** (default, recommended)
   - "Follow until the patient leaves the database (end of insurance enrollment, transfer out, etc.)"
   - Maps to: `EndStrategy.DateOffset` omitted (observation period end)

2. **Fixed duration after entry**
   - "Follow for exactly N days from the entry event"
   - Reveals: Number input for days, radio for "from start date" vs. "from end date" of index event
   - Maps to: `EndStrategy.CustomEra` omitted, `EndStrategy.DateOffset.DateField` + `EndStrategy.DateOffset.Offset`

3. **While on medication**
   - "Follow as long as the patient continues a drug"
   - Reveals: Inline concept picker for drug concept set (auto-named `"Era: {drug name}"`), number input for "Gap tolerance" (replaces OHDSI "Era Pad" terminology) with tip: "Maximum days between prescription fills before considering the drug discontinued"
   - Maps to: `EndStrategy.CustomEra.DrugCodesetId`, `EndStrategy.CustomEra.GapDays`, `EndStrategy.CustomEra.Offset`

#### Step 2: Censoring Events

**Clinical framing:** "Are there specific events that should end a patient's follow-up early?"

**Controls:**
- Same inline `WizardConceptPicker` as Chapter 2.
- Auto-names sets as `"Censoring: {concept name}"`.
- Each added concept shows as a card with domain badge and remove button.
- "Ask Abby" button suggests contextually appropriate censoring events based on the cohort's entry criteria (e.g., for a heart failure cohort, suggests Death, Heart transplant, LVAD implantation).

Maps to: `CensoringCriteria[]`.

**Collapse Settings:** Defaults to `CollapseType: "ERA", EraPad: 0`. Not exposed in the wizard — this is an advanced setting available in the editor.

### Chapter 5: Specialized Criteria (Optional)

**Opt-in gate:** A card selection screen asks "Do you need any specialized criteria?" with three options:
- **Genomic** — Gene mutations, TMB, MSI, fusions, pathogenicity
- **Imaging** — Modality, anatomy, AI classification, quantitative features
- **Skip** — Proceed directly to Review

**When selected:** The existing `GenomicCriteriaPanel` and `ImagingCriteriaPanel` components are embedded inline — same components used by the Advanced Editor. No new UI needed.

**Data availability warning:** A tip explains that these criteria require specialized data in the CDM (oncology extension tables, DICOM imaging series). If the data source doesn't have them, these filters will return zero patients.

Maps to: `GenomicCriteria[]`, `ImagingCriteria[]`.

### Chapter 6: Review & Generate

**Steps:** 3 sub-steps.

#### Step 1: Review Your Cohort

**Plain-English summary:** The wizard renders the entire cohort definition as a readable paragraph. Each clause is color-coded and linked to the originating chapter for quick editing:

> Patients with **Type 2 diabetes mellitus** (or any sub-type), using first qualifying event, who have **at least 1 prescription of Metformin** within 30 days after entry, and have **at least 1 HbA1c measurement** within 90 days before entry, and do **NOT** have **Type 1 diabetes** at any time before entry, aged **40–85**, followed until **end of continuous observation**, censored at **death**.

**Edit links:** Per-section "Edit" buttons jump back to the relevant chapter.

**Validation:** The wizard checks for:
- At least one primary criterion defined
- No empty concept sets (all have at least one concept)
- Temporal windows are logically valid (start before end)

Warnings are shown inline with suggestions for fixing.

#### Step 2: Generate Cohort

**Controls:**
- **Data source selector:** Dropdown of available CDM sources (Acumenus CDM, SynPUF, Eunomia, etc.)
- **Generate button:** Triggers cohort generation via the existing `useCohortGeneration` mutation hook.

**Results display:**
- Large patient count number (primary metric)
- Inline attrition breakdown: Entry events matched → After inclusion rules → After demographics → Final count
- Generation status indicator (pending, running, complete, error)

Uses the existing `CohortGenerationPanel` generation logic and API endpoints.

#### Step 3: What's Next? (Handoff)

Three options presented as cards:

1. **Done — Save & Close**
   - Saves the cohort and navigates back to the cohort definitions list.
   - Cohort is ready for use in analyses and studies.

2. **Open in Advanced Editor** (recommended for further refinement)
   - Navigates to the existing cohort detail page with the Expression Editor tab active.
   - Includes a brief **orientation panel** mapping wizard chapters to editor sections:
     - "Your entry events are in 'Primary Criteria'"
     - "Inclusion rules are in 'Additional Criteria'"
     - "Demographics, risk scores, and specialized criteria each have their own section"
     - "All concept sets appear in the 'Concept Sets' reference panel at the top"
   - The orientation panel is dismissable and persists via localStorage so it only shows once.

3. **View Diagnostics**
   - Navigates to the cohort detail page with the Diagnostics tab active.
   - Shows attrition chart, patient breakdown by age/gender, and detailed generation statistics.

## Component Architecture

### New Components

| Component | Location | Purpose |
|---|---|---|
| `CohortWizard` | `cohort-definitions/components/wizard/CohortWizard.tsx` | Top-level wizard container with sidebar + content area |
| `WizardSidebar` | `cohort-definitions/components/wizard/WizardSidebar.tsx` | Chapter navigation with completion state |
| `WizardChapter` | `cohort-definitions/components/wizard/WizardChapter.tsx` | Chapter wrapper with step management, Back/Next |
| `WizardConceptPicker` | `cohort-definitions/components/wizard/WizardConceptPicker.tsx` | Wraps vocabulary search panels + selection list for inline concept discovery |
| `SelectedConceptsList` | `cohort-definitions/components/wizard/SelectedConceptsList.tsx` | Displays selected concepts with descendant/mapped toggles |
| `TemporalPresetPicker` | `cohort-definitions/components/wizard/TemporalPresetPicker.tsx` | Preset grid + custom temporal range builder |
| `InclusionRuleSentence` | `cohort-definitions/components/wizard/InclusionRuleSentence.tsx` | Sentence-pattern inclusion rule builder |
| `EndStrategyCards` | `cohort-definitions/components/wizard/EndStrategyCards.tsx` | Radio-style end strategy selector |
| `CohortSummary` | `cohort-definitions/components/wizard/CohortSummary.tsx` | Plain-English cohort summary renderer |
| `WizardHandoff` | `cohort-definitions/components/wizard/WizardHandoff.tsx` | Handoff options with Advanced Editor orientation |

### Reused Components (no modifications needed)

| Component | Source | Usage in Wizard |
|---|---|---|
| `VocabularySearchPanel` | `vocabulary/components/` | Embedded in `WizardConceptPicker` with `mode="build"` |
| `SemanticSearchPanel` | `vocabulary/components/` | Embedded in `WizardConceptPicker` with `mode="build"` |
| `HierarchyBrowserPanel` | `vocabulary/components/` | Embedded in `WizardConceptPicker` |
| `ConceptDetailPanel` | `vocabulary/components/` | Optional expandable detail within concept picker |
| `GenomicCriteriaPanel` | `genomics/components/` | Embedded in Chapter 5 when genomic is selected |
| `ImagingCriteriaPanel` | `imaging/components/` | Embedded in Chapter 5 when imaging is selected |
| `CohortGenerationPanel` | `cohort-definitions/components/` | Generation logic reused in Chapter 6 |
| `DemographicFilterEditor` | `cohort-definitions/components/` | Reused in Chapter 3, Step 2 |
| `RiskScoreCriteriaSection` | `cohort-definitions/components/` | Reused in Chapter 3, Step 3 |

### State Management

**New Zustand store:** `cohortWizardStore.ts`

```typescript
interface CohortWizardState {
  // Navigation
  currentChapter: number;
  currentStep: number;
  chapterCompletion: Record<number, 'pending' | 'in-progress' | 'complete' | 'warning'>;

  // Cohort metadata
  name: string;
  description: string;
  domain: string;
  tags: string[];

  // Expression being built (same CohortExpression type)
  expression: CohortExpression;

  // Wizard-specific tracking
  conceptSetCounter: number; // Auto-incrementing ID for concept sets
  selectedSpecialized: ('genomic' | 'imaging')[]; // Which Ch5 sections are active

  // Actions
  setChapter: (chapter: number) => void;
  setStep: (step: number) => void;
  updateMetadata: (field: string, value: string | string[]) => void;
  addEntryConcept: (concept: Concept, options: ConceptOptions) => void;
  removeEntryConcept: (conceptId: number) => void;
  addInclusionRule: (rule: WizardInclusionRule) => void;
  removeInclusionRule: (index: number) => void;
  updateInclusionRule: (index: number, rule: WizardInclusionRule) => void;
  setInclusionLogic: (type: 'ALL' | 'ANY' | 'NONE') => void;
  setDemographics: (demographics: DemographicCriteria) => void;
  setEndStrategy: (strategy: EndStrategyConfig) => void;
  addCensoringConcept: (concept: Concept) => void;
  removeCensoringConcept: (conceptId: number) => void;
  buildExpression: () => CohortExpression; // Assembles final expression JSON
  reset: () => void;
}
```

The store translates wizard-friendly data structures into the full `CohortExpression` format when `buildExpression()` is called. This keeps the wizard state clean while producing OHDSI-compatible output.

### Concept Set Auto-Naming

Utility function `autoNameConceptSet(context: string, concepts: Concept[]): string`:

| Context | Example Output |
|---|---|
| Entry event | `"Entry: Type 2 diabetes mellitus"` |
| Inclusion rule | `"Inclusion: Metformin"` |
| Censoring event | `"Censoring: Death"` |
| End strategy drug | `"Era: Metformin"` |

If multiple concepts: `"Entry: Type 2 diabetes mellitus + 2 more"`.

### Abby AI Integration

Each concept-selection step includes an **"Ask Abby"** button that:
1. Opens an inline text prompt
2. Sends the user's natural-language request along with wizard context (current chapter, domain, existing selections) to the Abby AI endpoint
3. Abby returns suggested concept IDs with explanations
4. Suggestions appear as selectable cards that the user can accept or dismiss

Abby is a **contextual assistant within steps**, not a competing entry point. The wizard stays in control of the flow.

## Routing & Entry Point

### URL Structure

- **Wizard:** `/cohort-definitions/new` → renders `CohortWizard`
- **Detail page (Advanced Editor):** `/cohort-definitions/:id` → renders `CohortDefinitionDetailPage` (unchanged)

### Button Change

On `CohortDefinitionsPage.tsx`:
- Current: **"New Cohort Definition"** button → creates empty expression → navigates to detail page
- New: **"Cohort Wizard"** button → navigates to `/cohort-definitions/new` → renders wizard

The wizard creates the cohort via API at the Review step (not on initial entry), so users don't accumulate empty drafts.

## Expression Assembly

When the user clicks "Generate" or "Save" in Chapter 6, `buildExpression()` assembles the wizard state into a standard `CohortExpression` JSON:

1. Collects all auto-created concept sets into `ConceptSets[]`
2. Maps entry events + domain + observation window into `PrimaryCriteria`
3. Maps inclusion rules + boolean logic into `AdditionalCriteria` as a `CriteriaGroup`
4. Maps demographics into `DemographicCriteriaList[]`
5. Maps risk scores into `RiskScoreCriteria[]`
6. Maps end strategy into `EndStrategy`
7. Maps censoring concepts into `CensoringCriteria[]`
8. Maps genomic/imaging criteria into `GenomicCriteria[]` / `ImagingCriteria[]`
9. Sets `QualifiedLimit.Type` and `ExpressionLimit.Type`
10. Sets `CollapseSettings` to defaults (`CollapseType: "ERA", EraPad: 0`)

The resulting JSON is identical in format to what the Advanced Editor produces — the API endpoint is the same `POST /cohort-definitions` / `PUT /cohort-definitions/:id`.

## Temporal Logic Translation

The wizard never exposes OHDSI `Coeff` values. Translation table:

| Wizard UI | OHDSI Expression |
|---|---|
| "30 days before" | `{ Days: 30, Coeff: -1 }` |
| "30 days after" | `{ Days: 30, Coeff: 1 }` |
| "Any time before" | `{ Days: 99999, Coeff: -1 }` to `{ Days: 0, Coeff: -1 }` |
| "Any time after" | `{ Days: 0, Coeff: 1 }` to `{ Days: 99999, Coeff: 1 }` |
| "Same day" | `{ Days: 0, Coeff: -1 }` to `{ Days: 0, Coeff: 1 }` |
| "Any time" | No temporal window added |

## Validation

The wizard validates at two levels:

**Per-step validation** (before advancing):
- Chapter 1: Name is required
- Chapter 2: At least one entry event with at least one concept
- Chapter 3: If inclusion rules exist, each must have a concept set and valid temporal range
- Chapter 4: If "While on medication" selected, drug concept set is required
- Chapter 5: No validation (optional)

**Final validation** (Chapter 6, before generate):
- At least one primary criterion defined
- No empty concept sets (all have at least one concept)
- Temporal windows are logically valid (start ≤ end when both defined)
- Warnings (non-blocking): No inclusion rules defined, no censoring events, observation window is 0/0

## Out of Scope

The following are explicitly not part of the wizard and remain Advanced Editor features:
- **Nested boolean logic** — Recursive ALL/ANY/NONE groups within inclusion rules
- **Collapse settings** — ERA collapse type and pad configuration
- **UseEventEnd / UseIndexEnd** — Advanced temporal reference point selection
- **Expression limit** independent of qualified limit
- **Direct JSON editing** of the cohort expression
- **Concept set management** — Editing auto-created sets after wizard completion (done in editor)
