# Standard PROs+ Builder & Conduct Tab Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Module:** Standard PROs+ (`frontend/src/features/standard-pros/`)

---

## 1. Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Builder library | @coltorapps/builder (MIT, headless) + @dnd-kit (already installed) | Only MIT option with entity/attribute model; no visual builder is Apache 2.0 compatible |
| Conduct renderer | SurveyJS Form Library (survey-core + survey-react-ui, MIT) | 20+ question types, WCAG accessible, JSON-driven, no server dependency |
| Builder layout | Split Panel | REDCap-familiar, scales to 30+ item instruments, always-visible item list |
| Conduct layout | Campaign-First | Flat list, no two-step navigation, maps to survey_campaigns table |
| Library instruments | Immutable (read-only) | Validated instruments must stay standardized across OHDSI sites; clone to edit |
| Campaign scope | Cohort-based (instrument x cohort) | Research N matters most; enables downstream subcohort queries |
| Data entry modes | Phase 1: bulk import (REDCap/CSV) + manual proxy entry; Phase 2: published self-report links via SurveyJS | SurveyJS renders published links within Parthenon's HIPAA boundary |
| REDCap integration | Both: data dictionary import (Builder) + response CSV import (Conduct) | Researchers already use REDCap extensively |
| Campaign FK | cohort_generation_id (not cohort_definition_id) | CohortGenerationService requires generation to get source + results schema |
| Anonymous responses | Create new survey_conduct rows with person_id = null | Keeps pre-seeded cohort denominator clean |

---

## 2. Architecture

```
+-----------------------------------------------------+
|                   PROs+ Module                       |
+-------------+--------------+------------------------+
|  Builder    |   Conduct    |      Analytics          |
|  Tab        |   Tab        |      Tab                |
+-------------+--------------+------------------------+
| Coltor Apps | SurveyJS     | Recharts               |
| Builder     | Form Library | + Achilles SQL         |
| + dnd-kit   | (MIT)        |                        |
| + ATHENA    |              |                        |
|   concept   | +----------+ |                        |
|   search    | | Adapter  | |                        |
| + Abby AI   | | layer    | |                        |
|             | +----------+ |                        |
+-------------+--------------+------------------------+
|           Instrument JSON Schema                     |
|  SurveyInstrument -> SurveyItem[] -> AnswerOption[]  |
+-----------------------------------------------------+
|           OMOP v5.4/v6.0 Survey Tables              |
|  survey_conduct | survey_response | observation      |
+-----------------------------------------------------+
```

---

## 3. Library Evaluation Summary

Eight external form/survey builder platforms were evaluated:

| Tool | License (Renderer / Builder) | Embeddable React | Visual Builder | Verdict |
|------|-----|-----|-----|-----|
| SurveyJS | MIT / Proprietary ($579/dev) | Yes (`<Survey>`) | Proprietary only | Renderer viable; builder cannot be redistributed in Apache 2.0 |
| Formbricks | MIT SDK / AGPL server | No (popup SDK) | AGPL | Wrong category (NPS/CSAT), requires separate Next.js app |
| Typebot | FSL-1.1 | No (full server) | FSL | Wrong category (chatbot), anti-compete clause, 4 extra Docker containers |
| Tripetto | Commercial | Yes | Yes (flowchart) | Best builder UX, but commercial license + WCAG gaps |
| FormEngine | MIT core / Commercial designer | Yes | Commercial only | Same license split as SurveyJS |
| Form.io | OSL-v3 / MIT renderer | Renderer only | Requires server | OSL-v3 incompatible with Apache 2.0 |
| RJSF | MIT (all) | Yes | Community-built (basic) | Solid renderer, minimal builder |
| Coltor Apps Builder | MIT (all) | Yes | You build your own | Headless toolkit: entity/attribute model, builder store, Zod validation |

**Result:** No external library for the Builder tab (all good builders are proprietary/copyleft). Use @coltorapps/builder as headless state engine + custom clinical UI. Use SurveyJS Form Library (MIT) for Conduct tab rendering only.

---

## 4. Builder Tab Design

### 4.1 Stack

- `@coltorapps/builder-react` — store, hooks, schema validation
- `@dnd-kit/sortable` — drag-to-reorder items (already installed)
- `VocabularySearchPanel` — ATHENA concept search (already exists in codebase)
- `react-hook-form` + `zod` — attribute editor forms

### 4.2 Entity Types (Clinical Item Types)

| Entity | Attributes | Description |
|--------|-----------|-------------|
| `likertItem` | label, conceptId, loincCode, anchorLabels, responseOptions, reverseScored, subscaleKey | Likert scale question |
| `vasItem` | label, conceptId, minLabel, maxLabel, scaleLength | Visual Analog Scale |
| `nrsItem` | label, conceptId, minValue, maxValue, anchorLabels | Numeric Rating Scale |
| `matrixItem` | rowLabels, columnLabels, conceptIds | Matrix/grid question |
| `freeTextItem` | label, conceptId, maxLength, required | Open-ended text |
| `subscale` | name, scoringMethod, children: [likertItem, nrsItem, vasItem] | Grouping entity |
| `section` | title, description, pageBreak | Layout grouping |

### 4.3 Split Panel Layout

- **Left panel:** Toolbox of entity types (drag to add) + ordered item list with drag handles
- **Right panel:** Attribute editor for selected entity (concept search, scoring config, answer options)
- **Top bar:** Instrument metadata (name, abbreviation, domain, version, scoring method)
- **Bottom bar:** Save, Preview, Export actions

### 4.4 Import Support

- **REDCap data dictionary CSV** -> instrument items (Variable, Field Type, Choices, Field Label columns)
- **FHIR Questionnaire R4** -> instrument (item.type -> response_type, item.answerOption[].valueCoding -> answer options)
- **CSV generic format**

### 4.5 Library Instrument Immutability

Library instruments (seeded via `survey:seed-library`) are read-only. To customize a library instrument, researchers clone it into a user-owned copy with a clear derivative relationship. The clone gets a new ID, `created_by` set to the current user, and can be freely edited.

---

## 5. Conduct Tab Design

### 5.1 Campaign Lifecycle

```
Draft --> Active --> Closed
  |         |          |
  |   token generated  closed_at set
  |   public URL live  no new responses
  no link              data preserved
```

- **Draft:** No publish token, no live link. Can edit name/description.
- **Active:** Token generated (64-char crypto random), public URL available at `/survey/{token}`. Can import responses, do manual entry.
- **Closed:** `closed_at` timestamp set. No new responses accepted. Existing data preserved for analytics.

### 5.2 Campaign Seeding

When a campaign is created with a `cohort_generation_id`:

1. Resolve cohort via `CohortGenerationService::getMembers()` using the generation's source + results schema
2. Query `{resultsSchema}.cohort` for `subject_id` where `cohort_definition_id` matches
3. Create one `survey_conduct` row per person: `person_id = subject_id`, `survey_instrument_id`, `campaign_id`, `completion_status = 'pending'`
4. Completion % = `complete / total` across those rows

### 5.3 Three Data Entry Modes

**Mode 1 — Manual Proxy Entry (Phase 1)**
Researcher selects a person from the campaign's pending conduct records, fills out the instrument via a form, responses saved to `survey_conduct` / `survey_responses`. Uses `POST /api/v1/survey-conduct/{conduct}/responses`.

**Mode 2 — Bulk Import (Phase 1)**
Upload CSV with `person_id` column + item columns. Matches against pre-seeded `survey_conduct` rows by `person_id + campaign_id`. Creates `survey_response` rows per item. Scores via `SurveyScoreService`. Uses `POST /api/v1/survey-campaigns/{campaign}/import`.

**Mode 3 — Published Self-Report Link (Phase 2)**
Unauthenticated `/survey/{token}` URL renders SurveyJS Form Library. On completion, creates anonymous `survey_conduct` row with `person_id = null` + `survey_response` rows. Anonymous responses are counted separately from pre-seeded cohort rows to keep the denominator clean.

### 5.4 SurveyJS Adapter Mapping

| Parthenon `response_type` | SurveyJS question type | Notes |
|--------------------------|----------------------|-------|
| `likert` | `radiogroup` | choices from answer_options |
| `yes_no` | `boolean` | labelTrue/labelFalse from answer_options |
| `numeric` | `text` (inputType: number) | min/max from item |
| `free_text` | `comment` | maxLength from item |
| `multi_select` | `checkbox` | choices from answer_options |
| `date` | `text` (inputType: date) | — |
| `vas` | `nouislider` | min/max, step |
| `nrs` | `rating` | rateMin/rateMax from item |

The adapter (`instrumentToSurveyJs.ts`) converts `SurveyInstrumentDetailApi` -> SurveyJS JSON at runtime. The JSON is never stored — the native Laravel/PG model is always authoritative.

---

## 6. Database Schema

### 6.1 New Table: `survey_campaigns`

```sql
CREATE TABLE survey_campaigns (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    survey_instrument_id BIGINT NOT NULL REFERENCES survey_instruments(id) ON DELETE CASCADE,
    cohort_generation_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, closed
    publish_token VARCHAR(64) NULL UNIQUE,
    description TEXT NULL,
    closed_at TIMESTAMP NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_survey_campaigns_status ON survey_campaigns(status);
CREATE INDEX idx_survey_campaigns_instrument ON survey_campaigns(survey_instrument_id);
```

### 6.2 Modify: `survey_conduct`

```sql
ALTER TABLE survey_conduct ADD COLUMN campaign_id BIGINT NULL REFERENCES survey_campaigns(id) ON DELETE SET NULL;
ALTER TABLE survey_conduct ALTER COLUMN person_id DROP NOT NULL;  -- allow null for anonymous responses
CREATE INDEX idx_survey_conduct_campaign ON survey_conduct(campaign_id);
```

---

## 7. Backend File Map

### 7.1 New Files

| File | Responsibility |
|------|---------------|
| `backend/app/Models/Survey/SurveyCampaign.php` | Eloquent model for survey_campaigns |
| `backend/app/Http/Controllers/Api/V1/SurveyCampaignController.php` | CRUD + activate/close + seed + stats |
| `backend/app/Http/Controllers/Api/V1/SurveyConductController.php` | Manual proxy entry (store responses for a conduct record) |
| `backend/app/Http/Controllers/Api/V1/SurveyRespondController.php` | Public unauthenticated endpoint for published survey submissions |
| `backend/app/Services/Survey/CampaignSeedService.php` | Resolves cohort members via CohortGenerationService, creates survey_conduct rows |
| `backend/app/Services/Survey/SurveyImportService.php` | REDCap/CSV import: parses response CSV, matches person_id, writes survey_responses |
| `backend/app/Services/Survey/SurveyScoreService.php` | Computes total_score and subscale_scores for a conduct record |
| `backend/app/Http/Requests/Api/StoreSurveyCampaignRequest.php` | Validation for campaign creation |
| `backend/database/migrations/2026_03_30_000001_create_survey_campaigns_table.php` | Migration |

### 7.2 Modified Files

| File | Change |
|------|--------|
| `backend/app/Http/Controllers/Api/V1/SurveyInstrumentController.php` | Add `clone()` method |
| `backend/routes/api.php` | Add campaign routes, conduct response routes, public survey-respond route |

---

## 8. Frontend File Map

### 8.1 Builder Tab — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/standard-pros/components/builder/InstrumentMetadataForm.tsx` | Name, abbreviation, domain, version, scoring method |
| `frontend/src/features/standard-pros/components/builder/ScoringMethodEditor.tsx` | Type, range, subscales editor |
| `frontend/src/features/standard-pros/components/builder/ConceptPickerField.tsx` | ATHENA concept search wrapper |
| `frontend/src/features/standard-pros/components/builder/AnswerOptionsEditor.tsx` | Add/remove/reorder answer options for an item |
| `frontend/src/features/standard-pros/components/builder/ItemEditor.tsx` | Right panel: edit selected item attributes |
| `frontend/src/features/standard-pros/components/builder/SortableItemRow.tsx` | Single draggable item row |
| `frontend/src/features/standard-pros/components/builder/SortableItemList.tsx` | DndContext + SortableContext wrapper |
| `frontend/src/features/standard-pros/components/builder/InstrumentPanel.tsx` | Left panel: item list + toolbox |
| `frontend/src/features/standard-pros/components/builder/ImportInstrumentModal.tsx` | REDCap/FHIR/CSV import modal |
| `frontend/src/features/standard-pros/components/builder/BuilderTab.tsx` | Assembly: metadata + split panel |
| `frontend/src/features/standard-pros/lib/instrumentBuilder.ts` | Coltor entity/attribute/builder definitions |
| `frontend/src/features/standard-pros/lib/surveyBuilderStore.ts` | Zustand store wrapping Coltor useBuilderStore |
| `frontend/src/features/standard-pros/lib/redcapParser.ts` | REDCap data dictionary CSV -> instrument items |
| `frontend/src/features/standard-pros/lib/fhirParser.ts` | FHIR Questionnaire R4 -> instrument items |

### 8.2 Conduct Tab — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/standard-pros/components/conduct/CampaignCard.tsx` | Campaign summary card with progress bar |
| `frontend/src/features/standard-pros/components/conduct/NewCampaignModal.tsx` | Create campaign: pick instrument + cohort generation |
| `frontend/src/features/standard-pros/components/conduct/ImportResponsesModal.tsx` | REDCap/CSV response import |
| `frontend/src/features/standard-pros/components/conduct/ManualEntryModal.tsx` | Proxy entry form for one person |
| `frontend/src/features/standard-pros/components/conduct/PublishLinkPanel.tsx` | QR code + copy link for published surveys |
| `frontend/src/features/standard-pros/components/conduct/ConductTab.tsx` | Assembly: campaign list + actions |

### 8.3 Shared — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/standard-pros/api/campaignApi.ts` | TanStack Query hooks for campaign CRUD |
| `frontend/src/features/standard-pros/hooks/useCampaigns.ts` | Campaign hooks |
| `frontend/src/features/standard-pros/lib/instrumentToSurveyJs.ts` | Runtime adapter: SurveyInstrumentDetailApi -> SurveyJS JSON |
| `frontend/src/pages/PublicSurveyPage.tsx` | Unauthenticated /survey/:token page |

### 8.4 Modified Files

| File | Change |
|------|--------|
| `frontend/src/features/standard-pros/pages/StandardProsPage.tsx` | Replace BuilderTab placeholder, add ConductTab to TABS |
| `frontend/src/features/standard-pros/api/surveyApi.ts` | Add mutation functions (clone, createItem, updateItem, deleteItem, storeResponses) |
| `frontend/src/features/standard-pros/hooks/useSurveyInstruments.ts` | Add mutation hooks |
| `frontend/src/app/router.tsx` | Add /survey/:token public route |

---

## 9. NPM Packages

6 new packages (dnd-kit already present):

| Package | Purpose | License |
|---------|---------|---------|
| `@coltorapps/builder` | Headless builder state engine | MIT |
| `@coltorapps/builder-react` | React hooks for Coltor builder | MIT |
| `survey-core` | SurveyJS core library | MIT |
| `survey-react-ui` | SurveyJS React renderer | MIT |
| `papaparse` | CSV parsing for REDCap imports | MIT |
| `qrcode.react` | QR code generation for published links | ISC |

---

## 10. API Routes

### 10.1 Campaign Routes (authenticated, `auth:sanctum`)

```
GET    /api/v1/survey-campaigns                       SurveyCampaignController@index
POST   /api/v1/survey-campaigns                       SurveyCampaignController@store
GET    /api/v1/survey-campaigns/{campaign}             SurveyCampaignController@show
PUT    /api/v1/survey-campaigns/{campaign}             SurveyCampaignController@update
DELETE /api/v1/survey-campaigns/{campaign}             SurveyCampaignController@destroy
POST   /api/v1/survey-campaigns/{campaign}/activate    SurveyCampaignController@activate
POST   /api/v1/survey-campaigns/{campaign}/close       SurveyCampaignController@close
POST   /api/v1/survey-campaigns/{campaign}/seed        SurveyCampaignController@seed
GET    /api/v1/survey-campaigns/{campaign}/stats       SurveyCampaignController@stats
POST   /api/v1/survey-campaigns/{campaign}/import      SurveyCampaignController@importResponses
```

### 10.2 Conduct Response Routes (authenticated, `auth:sanctum`)

```
POST   /api/v1/survey-conduct/{conduct}/responses      SurveyConductController@storeResponses
```

### 10.3 Instrument Clone (authenticated, `auth:sanctum`)

```
POST   /api/v1/survey-instruments/{instrument}/clone    SurveyInstrumentController@clone
```

### 10.4 Public Survey Routes (unauthenticated, rate-limited)

```
GET    /api/v1/survey-respond/{token}                   SurveyRespondController@show
POST   /api/v1/survey-respond/{token}                   SurveyRespondController@store
```

---

## 11. Security Considerations

- All campaign/conduct routes require `auth:sanctum` middleware per HIGHSEC spec
- Permission middleware: `permission:analyses.view` for reads, `permission:analyses.create` for writes
- Public survey-respond routes are rate-limited (60/min per IP)
- Published survey tokens are 64-char cryptographically random strings
- Anonymous responses (person_id = null) contain no PHI — only instrument responses
- Campaign close is irreversible (sets closed_at, no re-activation)
- Bulk import validates person_id against campaign's seeded conduct records
- No PHI exposed through public survey endpoints (instrument definition only, no patient data)
