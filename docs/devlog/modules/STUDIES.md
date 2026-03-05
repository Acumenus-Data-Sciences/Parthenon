Parthenon's Studies module will be the command center for federated outcomes research, 
managing the full lifecycle from hypothesis through meta-analytic synthesis.

---

## DATABASE SCHEMA

Create Laravel migrations for the following tables in a `studies` schema 
(separate from the OMOP CDM schema). All tables use UUIDs as primary keys 
and include standard Laravel timestamps + soft deletes.

### Core Study Tables

#### `studies.studies`
- id (uuid, PK)
- title (varchar 500, not null)
- short_title (varchar 100, nullable) — acronym or abbreviation
- slug (varchar 120, unique, not null) — URL-friendly identifier
- study_type (enum: 'characterization', 'population_level_estimation', 
  'patient_level_prediction', 'drug_utilization', 'quality_improvement', 
  'comparative_effectiveness', 'safety_surveillance', 'custom')
- study_design (enum: 'cohort', 'case_control', 'self_controlled_case_series', 
  'self_controlled_cohort', 'nested_case_control', 'cross_sectional', 
  'interrupted_time_series', 'other')
- status (enum: 'draft', 'protocol_development', 'feasibility', 'irb_review', 
  'recruitment', 'execution', 'analysis', 'synthesis', 'manuscript', 
  'published', 'archived', 'withdrawn')
- phase (enum: 'pre_study', 'active', 'post_study')
- priority (enum: 'critical', 'high', 'medium', 'low')
- principal_investigator_id (uuid, FK → users)
- lead_data_scientist_id (uuid, FK → users, nullable)
- lead_statistician_id (uuid, FK → users, nullable)
- description (text, not null)
- scientific_rationale (text, nullable)
- hypothesis (text, nullable)
- primary_objective (text, nullable)
- secondary_objectives (jsonb, nullable) — array of objective strings
- study_start_date (date, nullable)
- study_end_date (date, nullable)
- target_enrollment_sites (integer, nullable)
- actual_enrollment_sites (integer, default 0)
- protocol_version (varchar 20, nullable)
- protocol_finalized_at (timestamp, nullable)
- funding_source (text, nullable)
- clinicaltrials_gov_id (varchar 20, nullable) — NCT number if registered
- tags (jsonb, nullable) — freeform tags for categorization
- settings (jsonb, nullable) — study-specific configuration
- created_by (uuid, FK → users)

#### `studies.study_team_members`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- user_id (uuid, FK → users)
- role (enum: 'principal_investigator', 'co_investigator', 'data_scientist', 
  'statistician', 'site_lead', 'data_analyst', 'research_coordinator', 
  'irb_liaison', 'project_manager', 'observer')
- site_id (uuid, FK → study_sites, nullable) — null = central/coordinating team
- permissions (jsonb) — granular permissions object
- joined_at (timestamp)
- left_at (timestamp, nullable)
- is_active (boolean, default true)

#### `studies.study_sites`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- organization_id (uuid, FK → organizations)
- cdm_source_key (varchar 255) — maps to OMOP cdm_source table
- site_role (enum: 'coordinating_center', 'data_partner', 'analytics_node', 'observer')
- status (enum: 'invited', 'onboarding', 'irb_pending', 'irb_approved', 
  'executing', 'results_submitted', 'completed', 'withdrawn', 'declined')
- irb_protocol_number (varchar 100, nullable)
- irb_approval_date (date, nullable)
- irb_expiry_date (date, nullable)
- irb_type (enum: 'full_board', 'expedited', 'exempt', 'waiver', 'not_required', nullable)
- dua_signed_at (timestamp, nullable) — Data Use Agreement
- site_contact_user_id (uuid, FK → users, nullable)
- cdm_version (varchar 10, nullable)
- vocabulary_version (varchar 50, nullable)
- data_freshness_date (date, nullable) — latest data available
- patient_count_estimate (bigint, nullable)
- feasibility_results (jsonb, nullable) — stored feasibility check output
- execution_log (jsonb, nullable) — run history and error logs
- results_received_at (timestamp, nullable)
- notes (text, nullable)

#### `studies.study_cohorts`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- cohort_definition_id (integer, FK → OMOP results.cohort_definition)
- role (enum: 'target', 'comparator', 'outcome', 'exclusion', 'subgroup', 'event')
- label (varchar 255) — human-readable name in context of this study
- description (text, nullable)
- sql_definition (text, nullable) — rendered OHDSI SQL
- json_definition (jsonb, nullable) — Circe JSON expression
- concept_set_ids (jsonb, nullable) — array of concept set IDs used
- sort_order (integer, default 0)

#### `studies.study_analyses`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- analysis_type (enum: 'characterization', 'cohort_method', 'sccs', 
  'self_controlled_cohort', 'ic_temporal', 'patient_level_prediction', 
  'incidence_rate', 'cohort_pathway', 'custom_sql', 'custom_r')
- name (varchar 255, not null)
- description (text, nullable)
- specification (jsonb, not null) — full analysis specification
- target_cohort_id (uuid, FK → study_cohorts, nullable)
- comparator_cohort_id (uuid, FK → study_cohorts, nullable)
- outcome_cohort_ids (jsonb, nullable) — array of study_cohort UUIDs
- covariate_settings (jsonb, nullable)
- population_settings (jsonb, nullable) — washout, time-at-risk, etc.
- model_settings (jsonb, nullable) — for PLP: algorithm, hyperparams
- negative_control_concept_ids (jsonb, nullable)
- status (enum: 'draft', 'specified', 'validated', 'executing', 'completed', 'failed')
- r_package_version (varchar 50, nullable) — HADES package version used
- sort_order (integer, default 0)

#### `studies.study_executions`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- analysis_id (uuid, FK → study_analyses)
- site_id (uuid, FK → study_sites)
- status (enum: 'queued', 'running', 'completed', 'failed', 'cancelled', 'timeout')
- submitted_by (uuid, FK → users)
- submitted_at (timestamp)
- started_at (timestamp, nullable)
- completed_at (timestamp, nullable)
- execution_engine (enum: 'hades_r', 'strategic_sql', 'python_fastapi', 'custom')
- execution_params (jsonb, nullable)
- log_output (text, nullable)
- error_message (text, nullable)
- result_hash (varchar 64, nullable) — SHA-256 of result set for integrity
- result_file_path (varchar 500, nullable)

#### `studies.study_results`
- id (uuid, PK)
- execution_id (uuid, FK → study_executions)
- study_id (uuid, FK → studies)
- analysis_id (uuid, FK → study_analyses)
- site_id (uuid, FK → study_sites)
- result_type (enum: 'cohort_count', 'characterization', 'incidence_rate', 
  'effect_estimate', 'prediction_performance', 'diagnostic', 'pathway', 
  'negative_control', 'attrition', 'custom')
- summary_data (jsonb, not null) — aggregate result data (never patient-level)
- diagnostics (jsonb, nullable) — study diagnostics (e.g., equipoise, covariate balance)
- is_primary (boolean, default false)
- is_publishable (boolean, default false) — flagged for inclusion in manuscript
- reviewed_by (uuid, FK → users, nullable)
- reviewed_at (timestamp, nullable)

#### `studies.study_synthesis`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- analysis_id (uuid, FK → study_analyses, nullable)
- synthesis_type (enum: 'fixed_effects_meta', 'random_effects_meta', 
  'bayesian_meta', 'forest_plot', 'heterogeneity_analysis', 'funnel_plot', 
  'evidence_synthesis', 'custom')
- input_result_ids (jsonb) — array of study_result UUIDs
- method_settings (jsonb) — meta-analysis method configuration
- output (jsonb) — synthesized result
- generated_at (timestamp)
- generated_by (uuid, FK → users)

#### `studies.study_artifacts`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- artifact_type (enum: 'protocol', 'sap', 'irb_submission', 'cohort_json', 
  'analysis_package_r', 'analysis_package_python', 'results_report', 
  'manuscript_draft', 'supplementary', 'presentation', 'data_dictionary', 
  'study_package_zip', 'shiny_app_url', 'other')
- title (varchar 500, not null)
- description (text, nullable)
- version (varchar 20, default '1.0')
- file_path (varchar 500, nullable)
- file_size_bytes (bigint, nullable)
- mime_type (varchar 100, nullable)
- url (varchar 500, nullable) — external link (e.g., GitHub, data.ohdsi.org)
- metadata (jsonb, nullable)
- uploaded_by (uuid, FK → users)
- is_current (boolean, default true) — latest version flag

#### `studies.study_milestones`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- title (varchar 255, not null)
- description (text, nullable)
- milestone_type (enum: 'protocol_finalized', 'irb_submitted', 'irb_approved', 
  'feasibility_complete', 'code_validated', 'execution_started', 'all_sites_complete', 
  'synthesis_complete', 'manuscript_submitted', 'published', 'custom')
- target_date (date, nullable)
- actual_date (date, nullable)
- status (enum: 'pending', 'in_progress', 'completed', 'overdue', 'skipped')
- assigned_to (uuid, FK → users, nullable)
- sort_order (integer, default 0)

#### `studies.study_comments`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- parent_id (uuid, FK → study_comments, nullable) — threaded replies
- commentable_type (varchar 100) — polymorphic: analysis, cohort, site, etc.
- commentable_id (uuid)
- user_id (uuid, FK → users)
- body (text, not null)
- is_resolved (boolean, default false)
- resolved_by (uuid, FK → users, nullable)

#### `studies.study_activity_log`
- id (uuid, PK)
- study_id (uuid, FK → studies)
- user_id (uuid, FK → users, nullable)
- action (varchar 100) — e.g., 'status_changed', 'cohort_added', 'execution_submitted'
- entity_type (varchar 100, nullable)
- entity_id (uuid, nullable)
- old_value (jsonb, nullable)
- new_value (jsonb, nullable)
- ip_address (inet, nullable)
- occurred_at (timestamp, default now())

---

## REACT FRONTEND ARCHITECTURE

Use React 19 with TypeScript. Use Inertia.js for Laravel-React bridging. 
Use Tailwind CSS + shadcn/ui components. Use TanStack Table for data grids.
Use Recharts for visualizations. Use Zustand for client state management.

### Route Structure (React Router or Inertia pages)
```
/studies                          → StudiesIndex (main listing page)
/studies/create                   → StudyCreate (new study wizard)
/studies/:slug                    → StudyDashboard (overview/command center)
/studies/:slug/protocol           → StudyProtocol (protocol editor)
/studies/:slug/cohorts            → StudyCohorts (cohort definitions)
/studies/:slug/analyses           → StudyAnalyses (analysis specifications)
/studies/:slug/sites              → StudySites (multisite management)
/studies/:slug/sites/:siteId      → SiteDetail (per-site execution detail)
/studies/:slug/executions         → StudyExecutions (job queue & history)
/studies/:slug/results            → StudyResults (results explorer)
/studies/:slug/results/synthesis  → StudySynthesis (meta-analysis)
/studies/:slug/artifacts          → StudyArtifacts (documents & packages)
/studies/:slug/team               → StudyTeam (team & permissions)
/studies/:slug/timeline           → StudyTimeline (milestones & Gantt)
/studies/:slug/activity           → StudyActivity (audit log)
/studies/:slug/settings           → StudySettings (configuration)
```

### Page Specifications

#### 1. StudiesIndex (`/studies`) — Main Landing Page

This is the primary entry point. Design as a sophisticated project portfolio view.

**Layout:**
- Top: Breadcrumb + page title "Studies" + prominent "New Study" button
- Below title: Horizontal stats bar showing:
  - Total studies count
  - Active studies count  
  - Studies by phase (pre-study / active / post-study) as mini pill badges
  - Sites actively executing across all studies
- Filter bar: Multi-select filters for status, study_type, study_design, PI, tags
  - Free-text search across title, short_title, description
  - Date range filter on study_start_date
  - "My Studies" toggle (studies where current user is a team member)
- Main content: Switchable between Card view and Table view (persist preference)

**Card View:**
Each card shows:
- Study title (linked to study dashboard)
- Short title badge if present
- Study type + design badges (color-coded)
- Status badge with colored dot indicator
- PI name and avatar
- Site progress: "6 of 8 sites complete" with mini progress bar
- Key dates: Start date, expected end
- Tags as small chips
- Last activity timestamp + actor

**Table View (TanStack Table):**
Columns: Title, Type, Design, Status, PI, Sites (progress), Start Date, 
Last Activity, Actions (kebab menu → View, Edit, Duplicate, Archive)
- Sortable on all columns
- Server-side pagination (25 per page)
- Bulk actions: Export list, Change status (with confirmation)

**Empty State:**
If no studies exist, show an illustrated empty state with:
- Explanation of what studies are in Parthenon
- "Create Your First Study" CTA
- Quick-start templates: "Characterization Study", "Comparative Effectiveness", 
  "Safety Surveillance", "Prediction Study"

#### 2. StudyCreate (`/studies/create`) — Multi-Step Wizard

A 4-step form wizard:

**Step 1 — Basics:**
- Title (required)
- Short title / acronym
- Study type (select from enum, with descriptions)
- Study design (select, filtered by study type where logical)
- Priority
- Description (rich text editor, markdown supported)
- Tags (combobox, create-on-the-fly)

**Step 2 — Scientific Design:**
- Scientific rationale (textarea)
- Hypothesis (textarea)  
- Primary objective (textarea)
- Secondary objectives (dynamic list, add/remove)
- Funding source

**Step 3 — Team:**
- Assign PI (user search/select)
- Assign Lead Data Scientist (optional)
- Assign Lead Statistician (optional)
- Add initial team members with roles

**Step 4 — Review & Create:**
- Summary card of all entered information
- Option to "Create as Draft" or "Create & Start Protocol Development"
- Auto-generates initial milestones based on study type

**AI-Assist Feature:**
Include a "Generate with AI" button at Step 2 that sends the title + description 
to the MedGemma FastAPI endpoint to suggest:
- A scientific rationale
- A hypothesis statement
- Recommended study design considerations
Display as editable suggestions the user can accept/modify/reject.

#### 3. StudyDashboard (`/studies/:slug`) — Study Command Center

The most important page. Think of it as a mission control for the study.

**Layout — Two-column responsive (main content + right sidebar):**

**Header Section:**
- Study title (editable inline) + short title badge
- Status badge (clickable to advance status via state machine)
- Breadcrumb: Studies > {Study Title}
- Action buttons: "Edit Study", "Export Package", "Share", kebab (Archive, Withdraw, Delete)

**Main Content (left, ~65% width):**

*Study Overview Card:*
- Description (collapsible if long)
- Primary objective
- Hypothesis
- Study type + design badges
- Key dates with relative time ("Started 3 months ago")

*Site Progress Section:*
- Title: "Network Sites ({actual}/{target})"
- Horizontal stacked bar showing site statuses (color-coded segments)
- Below: compact list of sites with status badges, data freshness, last activity
- "Invite Site" button
- Clicking a site → navigates to SiteDetail sub-page

*Analysis Pipeline Section:*
- Card per analysis defined, showing:
  - Analysis name + type badge
  - Target/Comparator/Outcome cohort labels
  - Execution status across sites (mini status grid: green/yellow/red/gray dots per site)
  - "Run" / "View Results" buttons
- "Add Analysis" button at bottom

*Recent Activity Feed:*
- Last 10 activity log entries
- Each entry: avatar, user name, action description, timestamp
- "View All" link to full activity page

**Right Sidebar (~35% width):**

*Study Metadata Card:*
- Principal Investigator (avatar + name + link)
- Lead Data Scientist
- Lead Statistician
- Created date
- Protocol version
- ClinicalTrials.gov ID (linked)
- Funding source

*Milestones Card:*
- Next 3 upcoming milestones with target dates
- Overdue milestones highlighted in red
- Progress indicator (X of Y completed)
- "View All" link

*Quick Links Card:*
- Protocol document (latest version)
- Analysis package download
- Results Shiny app link (if published)
- GitHub repository link
- Latest manuscript draft

*Team Card:*
- Compact avatar row of active team members
- Role counts: "3 investigators, 5 site leads, 2 analysts"
- "Manage Team" link

#### 4. StudySites (`/studies/:slug/sites`) — Multisite Management

**This is where Parthenon vastly exceeds Atlas.**

**Layout:**
- Summary stats: Total sites, by status breakdown, total patient records across sites
- World map visualization (if sites have geo coordinates) OR simple status grid
- Table of all sites with columns:
  - Organization name
  - Site role badge
  - Status badge (with mini workflow indicator showing all states)
  - IRB status (separate sub-badge)
  - CDM version
  - Data freshness
  - Patient count
  - Feasibility results (pass/fail/pending)
  - Analyses executed (count/total)
  - Last activity
  - Actions: View, Contact, Remove

**Site Detail Sub-page (`/studies/:slug/sites/:siteId`):**
- Site header: Organization name, contact person, site role
- IRB tracking panel: protocol number, approval date, expiry, documents
- DUA status
- CDM environment info: version, vocabulary version, data freshness, patient count
- Feasibility results panel: cohort counts, data quality flags
- Execution history table: per-analysis status, run times, error logs
- Results panel: submitted results with integrity hash verification
- Communication thread: site-specific comments

#### 5. StudyAnalyses (`/studies/:slug/analyses`) — Analysis Specifications

**Layout:**
- List of analyses as expandable cards
- Each card:
  - Analysis name + type badge
  - Cohort assignments (Target → Comparator → Outcome, visually connected)
  - Configuration summary (time-at-risk, washout, model type, etc.)
  - Execution status dashboard (mini grid of sites × status)
  - Actions: Edit, Duplicate, Delete, Run, Export R Code, Export SQL

**Analysis Editor (modal or dedicated page):**
Dynamically renders form fields based on `analysis_type`:

For `cohort_method`:
- Target cohort selector (from study_cohorts with role='target')
- Comparator cohort selector
- Outcome cohort(s) multi-select
- Time-at-risk: start offset, end offset, relative to cohort start/end
- Washout period
- Propensity score model settings (regularization, covariates)
- Outcome model type: logistic, Cox, Poisson
- Negative controls multi-select
- Trimming/matching/stratification options

For `patient_level_prediction`:
- Target cohort selector
- Outcome cohort selector
- Time-at-risk window
- Algorithm selector: LASSO logistic, gradient boosted machines, random forest, 
  deep learning, KNN, Naive Bayes, AdaBoost
- Covariate settings (domain toggles: conditions, drugs, procedures, measurements, etc.)
- Split settings: train/test ratio, cross-validation folds
- External validation cohorts

For `characterization`:
- Target cohort(s) multi-select
- Feature domains to include (checkboxes for each OMOP domain)
- Time windows (custom or presets: -365 to 0, -30 to 0, 0 to 30, etc.)
- Stratification variables

For `incidence_rate`:
- Target cohort(s) 
- Outcome cohort(s)
- Time-at-risk definition
- Age/gender/calendar year stratification options

For `cohort_pathway`:
- Target cohort(s)
- Event cohorts (the treatments/events to track in sequence)
- Max path length
- Minimum cell count for display

#### 6. StudyResults (`/studies/:slug/results`) — Results Explorer

**Layout:**
- Filter bar: By analysis, by site, by result type
- Results are rendered based on result_type:

For effect estimates:
- Forest plot (Recharts custom component) showing HR/OR/RR per site
- Summary effect estimate with confidence interval
- Heterogeneity statistics (I², Q, tau²)
- Attrition diagram per site
- Covariate balance plot (Love plot)
- Propensity score distribution overlay
- Negative control calibration plot

For characterization:
- Comparison table (Table 1) across cohorts
- Standardized mean difference plot
- Feature prevalence heatmap across sites

For prediction:
- ROC curves per site + pooled
- Calibration plots
- Discrimination metrics table (AUC, sensitivity, specificity, PPV, NPV)
- Feature importance chart

For incidence rates:
- Rate table by site with confidence intervals
- Forest plot of incidence rates
- Stratified rates (by age, gender, calendar period)

For pathways:
- Sunburst chart of treatment sequences
- Sankey diagram of transitions
- Pathway frequency table

#### 7. StudySynthesis (`/studies/:slug/results/synthesis`) — Meta-Analysis

- Select which site results to include/exclude
- Choose synthesis method (fixed effects, random effects, Bayesian)
- Configure via R Plumber bridge to EvidenceSynthesis package
- Display:
  - Forest plot with pooled estimate
  - Funnel plot for publication bias
  - Heterogeneity diagnostics
  - Sensitivity analysis (leave-one-out)
  - Summary evidence table

---

## LARAVEL API ARCHITECTURE

### Controllers (app/Http/Controllers/Studies/)
- StudyController — CRUD + status transitions
- StudySiteController — site management, invitation, status updates  
- StudyCohortController — cohort assignment to studies
- StudyAnalysisController — analysis spec CRUD
- StudyExecutionController — job dispatch to R Plumber / FastAPI
- StudyResultController — result ingestion and querying
- StudySynthesisController — meta-analysis orchestration
- StudyArtifactController — file upload/download management
- StudyTeamController — team member management
- StudyMilestoneController — milestone tracking
- StudyActivityController — activity log queries

### Key API Endpoints
```
GET    /api/studies                           — list with filters + pagination
POST   /api/studies                           — create study
GET    /api/studies/{slug}                    — study detail with relations
PUT    /api/studies/{slug}                    — update study
POST   /api/studies/{slug}/status             — advance status (state machine)
DELETE /api/studies/{slug}                    — soft delete

GET    /api/studies/{slug}/sites              — list sites
POST   /api/studies/{slug}/sites              — add/invite site
PUT    /api/studies/{slug}/sites/{id}         — update site status/details
POST   /api/studies/{slug}/sites/{id}/feasibility  — trigger feasibility check

GET    /api/studies/{slug}/cohorts            — list study cohorts
POST   /api/studies/{slug}/cohorts            — assign cohort to study
PUT    /api/studies/{slug}/cohorts/{id}       — update cohort assignment

GET    /api/studies/{slug}/analyses           — list analyses
POST   /api/studies/{slug}/analyses           — create analysis spec
PUT    /api/studies/{slug}/analyses/{id}      — update analysis
POST   /api/studies/{slug}/analyses/{id}/execute  — dispatch execution
POST   /api/studies/{slug}/analyses/{id}/execute-all-sites — batch dispatch

GET    /api/studies/{slug}/executions         — list executions with status
GET    /api/studies/{slug}/executions/{id}    — execution detail + logs

GET    /api/studies/{slug}/results            — query results with filters
POST   /api/studies/{slug}/results/import     — import results from site
GET    /api/studies/{slug}/results/export     — export results package

POST   /api/studies/{slug}/synthesis          — run meta-analysis
GET    /api/studies/{slug}/synthesis/{id}     — synthesis results

POST   /api/studies/{slug}/artifacts          — upload artifact
GET    /api/studies/{slug}/artifacts/{id}/download — download artifact

POST   /api/studies/{slug}/ai/suggest-protocol — AI-powered protocol generation
POST   /api/studies/{slug}/ai/review-design    — AI design review
```

### Laravel Models
Create Eloquent models with proper relationships:
- Study → hasMany: sites, cohorts, analyses, executions, results, artifacts, 
  milestones, comments, activityLog; belongsToMany: teamMembers (via study_team_members)
- Use Laravel's model events to auto-log to study_activity_log on create/update/delete
- Implement a StudyStatusStateMachine service class that enforces valid status transitions
- Use Laravel Policies for authorization (team role-based access)
- Use Form Requests for validation on all endpoints

### Study Status State Machine
Valid transitions:
draft → protocol_development
protocol_development → feasibility
feasibility → irb_review
irb_review → recruitment (when at least 1 site IRB approved)
recruitment → execution (when minimum sites enrolled)
execution → analysis (when all required site executions complete)
analysis → synthesis
synthesis → manuscript
manuscript → published
Any → withdrawn (with reason)
Any → archived (if status is published or withdrawn)

### Services (app/Services/Studies/)
- StudyPackageGenerator — generates downloadable R/Python study package
- FeasibilityService — dispatches feasibility queries to sites via R Plumber
- ExecutionDispatchService — manages job dispatch queue to HADES R bridge
- ResultIngestionService — validates + stores incoming site results
- EvidenceSynthesisService — orchestrates meta-analysis via R Plumber
- StudyExportService — exports study definition as JSON (Atlas-compatible format)
- StudyImportService — imports Atlas-format study definitions
- AiProtocolService — interfaces with MedGemma for AI-assisted study design

---

## R PLUMBER BRIDGE ENDPOINTS (for HADES integration)

The R Plumber service (separate microservice) must expose:

POST /hades/feasibility      — run cohort count queries across CDM
POST /hades/characterize     — run FeatureExtraction
POST /hades/cohort-method    — run CohortMethod package
POST /hades/sccs             — run SelfControlledCaseSeries
POST /hades/prediction       — run PatientLevelPrediction
POST /hades/incidence        — run incidence rate analysis
POST /hades/pathways         — run cohort pathways analysis
POST /hades/synthesis        — run EvidenceSynthesis meta-analysis
GET  /hades/job/{id}/status  — poll job status
GET  /hades/job/{id}/results — retrieve results

Each endpoint accepts the analysis specification JSON from study_analyses.specification
and CDM connection parameters from study_sites, then returns aggregate results only.

---

## IMPLEMENTATION PRIORITIES

Build in this order:
1. Database migrations + models + relationships + factories/seeders
2. StudyController CRUD + StudiesIndex page (main listing)
3. StudyCreate wizard (all 4 steps)
4. StudyDashboard (command center page)
5. StudySites management + SiteDetail
6. StudyCohorts management (linking existing cohort definitions)
7. StudyAnalyses specification UI (start with characterization + cohort_method)
8. StudyExecutions job dispatch + status tracking
9. StudyResults explorer + visualization components
10. StudySynthesis meta-analysis page
11. StudyArtifacts document management
12. StudyTimeline Gantt/milestone view
13. AI-assist features (protocol generation, design review)
14. Atlas JSON import/export compatibility layer

---

## KEY DESIGN PRINCIPLES

1. **Federated by default**: Every feature assumes multisite. Single-site is 
   just the degenerate case. Site-level results are always kept discrete until 
   explicitly synthesized.

2. **Aggregate-only result sharing**: Never transmit patient-level data between 
   sites. Results tables contain only summary statistics. Enforce minimum cell 
   counts (configurable, default n=5) to prevent re-identification.

3. **Atlas compatibility**: Import/export study definitions in Atlas-compatible 
   JSON format so OHDSI community members can migrate studies to/from Parthenon.

4. **HADES as execution engine**: Don't reimplement R analytics. Delegate to 
   HADES packages via R Plumber. Parthenon manages the study lifecycle; HADES 
   does the computation.

5. **AI augmentation, not replacement**: MedGemma assists with protocol drafting, 
   cohort suggestion, and design review, but all scientific decisions require 
   human confirmation.

6. **Audit everything**: Every state change, every execution, every result 
   submission is logged to study_activity_log with user attribution.

7. **Version everything**: Protocols, cohort definitions, and analysis specs 
   are versioned. Changes create new versions, never overwrite.

8. **Real-time collaboration**: Use Laravel Broadcasting (Reverb) for live 
   updates on execution status, site activity, and team comments.

---

## TESTING

- Feature tests for all API endpoints with role-based assertions
- Unit tests for StudyStatusStateMachine transitions
- Component tests for React pages using Vitest + Testing Library
- Factory seeders that create realistic study scenarios for development
- Include a DatabaseSeeder that creates:
  - 3 sample studies at different lifecycle stages
  - 5 organizations as sites
  - Realistic team compositions
  - Sample analysis specifications for each study type

---

## PHASED IMPLEMENTATION WORKLIST

> **Baseline:** A basic Study Orchestrator already exists — `Study` model (integer PK, name/description/study_type/status/metadata), `StudyAnalysis` polymorphic pivot, `StudyController` with CRUD + execute/progress, `StudyService` with job dispatch, and a frontend with list page, detail page (Design + Progress tabs), designer, and dashboard components. Two migrations, full API client, TanStack Query hooks, and lazy-loaded routes are wired.
>
> **Goal:** Expand from "bundle analyses and run them" to a full federated research lifecycle platform matching the spec above, while preserving all working code and Parthenon conventions (integer IDs, `apiResource` routes, `auth:sanctum`, TanStack Query, Zustand, Tailwind v4 dark theme).

---

### Phase S1: Schema Expansion — Core Study Fields

**Objective:** Expand the `studies` table from 7 columns to the full spec, update the model, and seed sample data.

#### S1.1 — Migration: Expand `studies` table
- **File:** `backend/database/migrations/2026_03_04_200000_expand_studies_table.php`
- Add columns (all nullable except where noted):
  - `title` (varchar 500) — rename from `name` via `renameColumn`
  - `short_title` (varchar 100)
  - `slug` (varchar 120, unique) — auto-generated from title
  - `study_design` (varchar 50) — enum values stored as strings
  - `phase` (varchar 20, default 'pre_study')
  - `priority` (varchar 20, default 'medium')
  - `principal_investigator_id` (FK → users, nullable) — separate from `author_id`
  - `lead_data_scientist_id` (FK → users, nullable)
  - `lead_statistician_id` (FK → users, nullable)
  - `scientific_rationale` (text)
  - `hypothesis` (text)
  - `primary_objective` (text)
  - `secondary_objectives` (jsonb)
  - `study_start_date` (date)
  - `study_end_date` (date)
  - `target_enrollment_sites` (integer)
  - `actual_enrollment_sites` (integer, default 0)
  - `protocol_version` (varchar 20)
  - `protocol_finalized_at` (timestamp)
  - `funding_source` (text)
  - `clinicaltrials_gov_id` (varchar 20)
  - `tags` (jsonb)
  - `settings` (jsonb)
- Expand `status` enum: add 'protocol_development', 'feasibility', 'irb_review', 'recruitment', 'execution', 'analysis', 'synthesis', 'manuscript', 'published', 'archived', 'withdrawn'
- Keep `author_id` as `created_by` semantic (rename column to `created_by`)
- **Decision:** Keep integer IDs (Parthenon convention), NOT UUIDs as spec suggests

#### S1.2 — Update Study model
- **File:** `backend/app/Models/App/Study.php`
- Add all new fillable fields
- Add casts: `secondary_objectives` → array, `tags` → array, `settings` → array, `metadata` → array, dates
- Add slug auto-generation via `boot()` (Str::slug from title)
- Add relationships: `principalInvestigator()`, `leadDataScientist()`, `leadStatistician()`, `createdBy()`
- Add scope: `scopeSearch($query, $term)` for ilike on title/short_title/description
- Add `getRouteKeyName()` returning 'slug' for route model binding

#### S1.3 — StudySeeder with 3 sample studies
- **File:** `backend/database/seeders/StudySeeder.php`
- 3 studies at different lifecycle stages:
  1. "LEGEND-T2DM: Large-scale Evidence Generation for Diabetes Management" — status: execution, phase: active, type: comparative_effectiveness
  2. "SCDM Breast Cancer Characterization" — status: draft, phase: pre_study, type: characterization
  3. "COVID-19 Vaccine Safety Surveillance" — status: published, phase: post_study, type: safety_surveillance
- Each with realistic descriptions, objectives, hypotheses, tags
- Link to existing admin user as PI and author
- Register in `DatabaseSeeder.php`

#### S1.4 — StudyStatsController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyStatsController.php`
- Single `__invoke()` returning: `{ total, by_status: {...}, by_type: {...}, by_phase: {...}, active_count }`
- **Route:** `GET /api/v1/studies/stats` (before resource routes)

---

### Phase S2: Team, Sites & Supporting Tables

**Objective:** Add the 9 remaining database tables, models, and relationships.

#### S2.1 — Migration: `study_team_members`
- **File:** `backend/database/migrations/2026_03_04_200001_create_study_team_members_table.php`
- Integer PK, `study_id` FK, `user_id` FK, `role` varchar, `site_id` FK nullable, `permissions` jsonb, `joined_at` timestamp, `left_at` timestamp nullable, `is_active` boolean default true, timestamps

#### S2.2 — Migration: `study_sites`
- **File:** `backend/database/migrations/2026_03_04_200002_create_study_sites_table.php`
- Integer PK, `study_id` FK, `source_id` FK (→ sources table, NOT organizations — no Org model exists), `site_role` varchar, `status` varchar default 'invited', IRB fields, DUA fields, CDM metadata fields, `notes` text, timestamps, soft deletes
- **Adaptation:** Use `source_id` FK → `sources` table instead of `organization_id` FK → `organizations` (organizations table doesn't exist; sources already represent data partners)

#### S2.3 — Migration: `study_cohorts` (expand or keep existing `study_analyses`)
- **File:** `backend/database/migrations/2026_03_04_200003_create_study_cohorts_table.php`
- Integer PK, `study_id` FK, `cohort_definition_id` FK, `role` varchar, `label` varchar, `description` text, `sql_definition` text, `json_definition` jsonb, `concept_set_ids` jsonb, `sort_order` integer, timestamps
- Note: This is separate from `study_analyses` — cohorts are the building blocks that analyses reference

#### S2.4 — Migrations for remaining tables
- `study_executions` — **File:** `2026_03_04_200004_create_study_executions_table.php`
  - Replaces the existing `analysis_executions` usage within studies context
  - Adds `site_id` FK for multisite tracking
- `study_results` — **File:** `2026_03_04_200005_create_study_results_table.php`
- `study_synthesis` — **File:** `2026_03_04_200006_create_study_synthesis_table.php`
- `study_artifacts` — **File:** `2026_03_04_200007_create_study_artifacts_table.php`
- `study_milestones` — **File:** `2026_03_04_200008_create_study_milestones_table.php`
- `study_comments` — **File:** `2026_03_04_200009_create_study_comments_table.php`
  - Polymorphic via `commentable_type` + `commentable_id`
- `study_activity_log` — **File:** `2026_03_04_200010_create_study_activity_log_table.php`

#### S2.5 — Eloquent Models (9 new models)
- **Directory:** `backend/app/Models/App/`
- `StudyTeamMember.php` — belongsTo Study, User, StudySite
- `StudySite.php` — belongsTo Study, Source; hasMany executions, results
- `StudyCohort.php` — belongsTo Study, CohortDefinition
- `StudyExecution.php` — belongsTo Study, StudyAnalysis, StudySite, User
- `StudyResult.php` — belongsTo StudyExecution, Study, StudyAnalysis, StudySite
- `StudySynthesis.php` — belongsTo Study, StudyAnalysis
- `StudyArtifact.php` — belongsTo Study, User
- `StudyMilestone.php` — belongsTo Study, User
- `StudyComment.php` — belongsTo Study, User; morphTo commentable; hasMany replies (self-referential)
- `StudyActivityLog.php` — belongsTo Study, User
- Update `Study.php` with new hasMany relationships for all 9 models

#### S2.6 — StudyStatusStateMachine service
- **File:** `backend/app/Services/Studies/StudyStatusStateMachine.php`
- Define valid transitions map (as per spec)
- `canTransition(Study $study, string $newStatus): bool`
- `transition(Study $study, string $newStatus, ?User $actor = null): void` — validates, updates, logs to activity_log
- Special rules: `irb_review → recruitment` requires ≥1 site with IRB approved
- Any → withdrawn/archived with validation

---

### Phase S3: Backend Controllers & Routes

**Objective:** Expand StudyController and add sub-resource controllers.

#### S3.1 — Expand StudyController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyController.php`
- Enhance `index()`: Add filters for status, study_type, study_design, phase, PI, tags, search, "my studies" toggle, date range
- Enhance `store()`: Accept all new fields, auto-generate slug, auto-create initial milestones
- Enhance `show()`: Eager load team, sites (with counts), analyses, recent activity
- Add `transitionStatus()` method using StateMachine
- Add `duplicate()` method to clone a study

#### S3.2 — StudySiteController
- **File:** `backend/app/Http/Controllers/Api/V1/StudySiteController.php`
- CRUD for study sites (add source as site, update status, remove)
- `feasibility()` action — run cohort counts against site's CDM

#### S3.3 — StudyCohortController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyCohortController.php`
- Assign/unassign cohort definitions to study with role labels

#### S3.4 — StudyTeamController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyTeamController.php`
- Add/remove/update team members with roles

#### S3.5 — StudyMilestoneController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyMilestoneController.php`
- CRUD + status updates (pending → in_progress → completed)

#### S3.6 — StudyArtifactController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyArtifactController.php`
- Upload/download/list artifacts with file storage

#### S3.7 — StudyActivityController
- **File:** `backend/app/Http/Controllers/Api/V1/StudyActivityController.php`
- Paginated activity log with filters

#### S3.8 — Routes registration
- **File:** `backend/routes/api.php`
- Nested resource routes under `studies/{study}/`:
  ```
  studies/stats (invokable, BEFORE resource)
  studies (apiResource)
  studies/{study}/status (POST)
  studies/{study}/duplicate (POST)
  studies/{study}/sites (apiResource)
  studies/{study}/sites/{site}/feasibility (POST)
  studies/{study}/cohorts (apiResource)
  studies/{study}/analyses (existing, keep)
  studies/{study}/team (apiResource)
  studies/{study}/milestones (apiResource)
  studies/{study}/artifacts (apiResource)
  studies/{study}/artifacts/{artifact}/download (GET)
  studies/{study}/activity (GET, index only)
  studies/{study}/executions (existing, keep)
  studies/{study}/progress (existing, keep)
  ```

#### S3.9 — Form Requests
- `StoreStudyRequest.php` — validate all study creation fields
- `UpdateStudyRequest.php` — validate updates (all optional)
- `StoreStudySiteRequest.php`, `StoreStudyCohortRequest.php`, etc.

#### S3.10 — Study Policy
- **File:** `backend/app/Policies/StudyPolicy.php`
- Authorization based on team membership and role
- PI can do everything; site_lead limited to their site; observer read-only

---

### Phase S4: Frontend Types, API Client & Hooks

**Objective:** Expand frontend data layer to match new backend capabilities.

#### S4.1 — Expand TypeScript types
- **File:** `frontend/src/features/studies/types/study.ts`
- Expand `Study` interface with all new fields (title, slug, short_title, study_design, phase, priority, PI, scientific fields, dates, tags, settings)
- Add interfaces: `StudyTeamMember`, `StudySite`, `StudyCohort`, `StudyExecution`, `StudyResult`, `StudySynthesis`, `StudyArtifact`, `StudyMilestone`, `StudyComment`, `StudyActivityEntry`
- Add `StudyStats` interface for stats endpoint
- Add `StudyFilters` interface for list filtering

#### S4.2 — Expand API client
- **File:** `frontend/src/features/studies/api/studyApi.ts`
- Add: `getStudyStats()`, `transitionStatus()`, `duplicateStudy()`
- Add site CRUD: `listStudySites()`, `addStudySite()`, `updateStudySite()`, `removeStudySite()`
- Add cohort CRUD: `listStudyCohorts()`, `addStudyCohort()`, `updateStudyCohort()`, `removeStudyCohort()`
- Add team CRUD: `listStudyTeam()`, `addTeamMember()`, `updateTeamMember()`, `removeTeamMember()`
- Add milestone CRUD: `listMilestones()`, `createMilestone()`, `updateMilestone()`, `deleteMilestone()`
- Add artifact CRUD: `listArtifacts()`, `uploadArtifact()`, `downloadArtifact()`, `deleteArtifact()`
- Add: `getActivityLog()`, `addComment()`, `resolveComment()`

#### S4.3 — Expand hooks
- **File:** `frontend/src/features/studies/hooks/useStudies.ts` (split into multiple files if needed)
- `useStudyStats()` — stats bar data
- `useStudySites(studyId)`, `useAddSite()`, `useUpdateSite()`, `useRemoveSite()`
- `useStudyCohorts(studyId)`, `useAddCohort()`, `useUpdateCohort()`, `useRemoveCohort()`
- `useStudyTeam(studyId)`, `useAddTeamMember()`, `useUpdateTeamMember()`, `useRemoveTeamMember()`
- `useStudyMilestones(studyId)`, `useCreateMilestone()`, `useUpdateMilestone()`, `useDeleteMilestone()`
- `useStudyArtifacts(studyId)`, `useUploadArtifact()`, `useDeleteArtifact()`
- `useStudyActivity(studyId)` — paginated activity log
- `useTransitionStatus()`, `useDuplicateStudy()`
- Add `search` param to existing `useStudies()` hook

---

### Phase S5: Frontend — Enhanced Studies Index Page

**Objective:** Transform the basic list into the portfolio-quality landing page described in the spec.

#### S5.1 — StudyStatsBar component
- **File:** `frontend/src/features/studies/components/StudyStatsBar.tsx`
- 5 metrics: Total, Active, Pre-Study, Active Phase, Post-Study
- IBM Plex Mono numbers, same visual pattern as other stats bars
- Uses `useStudyStats()` hook

#### S5.2 — Redesign StudiesPage
- **File:** `frontend/src/features/studies/pages/StudiesPage.tsx`
- Header: "Studies" title + "New Study" button (right-aligned)
- Stats bar below header
- Filter bar: search input (debounced 300ms), status multi-select, type dropdown, "My Studies" toggle
- Card/Table view toggle (persist preference in localStorage)
- Pass filters and search to `useStudies()` hook

#### S5.3 — StudyCard component (Card view)
- **File:** `frontend/src/features/studies/components/StudyCard.tsx`
- Study title (linked to `/studies/{slug}`), short_title badge
- Type + design badges (color-coded)
- Status badge with dot indicator
- PI name, site progress bar, key dates, tags
- Last activity timestamp

#### S5.4 — Enhanced StudyList (Table view)
- **File:** `frontend/src/features/studies/components/StudyList.tsx`
- Columns: Title, Type, Design, Status, PI, Sites progress, Start Date, Last Activity
- Sortable columns
- Kebab menu per row: View, Edit, Duplicate, Archive
- Contextual empty states (no studies vs no search results)

#### S5.5 — Empty state
- Illustrated empty state when no studies exist
- "Create Your First Study" CTA
- Quick-start template buttons: Characterization, Comparative Effectiveness, Safety Surveillance, Prediction

---

### Phase S6: Frontend — Study Create Wizard

**Objective:** Build the 4-step creation wizard.

#### S6.1 — StudyCreatePage with wizard shell
- **File:** `frontend/src/features/studies/pages/StudyCreatePage.tsx`
- Step indicator (1–4), prev/next navigation, step validation
- Route: `/studies/create` (add to router before `:id` catch-all)

#### S6.2 — Step 1: Basics
- Title, short title, study type (with descriptions), study design, priority, description (textarea with markdown preview), tags (combobox)

#### S6.3 — Step 2: Scientific Design
- Scientific rationale, hypothesis, primary objective, secondary objectives (dynamic add/remove list), funding source

#### S6.4 — Step 3: Team
- PI selector (user search), Lead Data Scientist, Lead Statistician
- Add initial team members with role assignment

#### S6.5 — Step 4: Review & Create
- Summary card of all entered fields
- "Create as Draft" and "Create & Start Protocol Development" buttons
- On create: auto-generate initial milestones based on study type

#### S6.6 — Router update
- **File:** `frontend/src/app/router.tsx`
- Add `/studies/create` route BEFORE `/studies/:id`

---

### Phase S7: Frontend — Study Dashboard (Command Center)

**Objective:** Build the main study detail page as a mission-control dashboard.

#### S7.1 — Redesign StudyDetailPage
- **File:** `frontend/src/features/studies/pages/StudyDetailPage.tsx`
- Slug-based routing (update router from `:id` to `:slug`)
- Header: title (inline editable), short_title badge, status badge (clickable for transitions), action buttons
- Two-column responsive layout (main ~65%, sidebar ~35%)

#### S7.2 — Dashboard main content
- Study Overview Card: description, objectives, hypothesis, type/design badges, dates
- Site Progress Section: stacked status bar, compact site list, "Invite Site" button
- Analysis Pipeline Section: analysis cards with execution status grid
- Recent Activity Feed: last 10 entries with "View All" link

#### S7.3 — Dashboard sidebar
- Study Metadata Card: PI, lead scientists, dates, protocol version, NCT ID, funding
- Milestones Card: next 3 milestones, overdue highlighting, progress indicator
- Quick Links Card: protocol, analysis package, results links
- Team Card: avatar row, role counts, "Manage Team" link

#### S7.4 — Sub-page navigation
- Add tab/nav bar for sub-pages: Overview, Protocol, Cohorts, Analyses, Sites, Executions, Results, Team, Timeline, Activity, Settings
- Each tab lazy-loads its page component

---

### Phase S8: Frontend — Sub-Pages (Sites, Cohorts, Team, Milestones)

**Objective:** Build the management sub-pages.

#### S8.1 — StudySitesPage
- **File:** `frontend/src/features/studies/pages/StudySitesPage.tsx`
- Summary stats, site table (source name, role, status, CDM version, data freshness, patient count)
- "Add Site" button (select from available sources)
- Status workflow indicator per site

#### S8.2 — SiteDetailPage
- **File:** `frontend/src/features/studies/pages/SiteDetailPage.tsx`
- Route: `/studies/:slug/sites/:siteId`
- IRB tracking panel, DUA status, CDM environment info, execution history, results panel

#### S8.3 — StudyCohortsPage
- **File:** `frontend/src/features/studies/pages/StudyCohortsPage.tsx`
- List assigned cohorts with role labels (target, comparator, outcome, etc.)
- "Assign Cohort" button — search existing cohort definitions
- Visual grouping by role

#### S8.4 — StudyTeamPage
- **File:** `frontend/src/features/studies/pages/StudyTeamPage.tsx`
- Team member table: name, role, site assignment, joined date, active status
- "Add Member" button with user search and role selection

#### S8.5 — StudyMilestonesPage
- **File:** `frontend/src/features/studies/pages/StudyMilestonesPage.tsx`
- Timeline/list view of milestones with status badges
- Target vs actual dates, overdue highlighting
- Add/edit/complete milestone actions

#### S8.6 — StudyActivityPage
- **File:** `frontend/src/features/studies/pages/StudyActivityPage.tsx`
- Paginated activity log with avatar, action, timestamp
- Filter by action type

#### S8.7 — Router expansion
- **File:** `frontend/src/app/router.tsx`
- Add all sub-page routes under `/studies/:slug/`

---

### Phase S9: Frontend — Analysis Specifications & Execution

**Objective:** Enhanced analysis management within studies.

#### S9.1 — StudyAnalysesPage (enhanced)
- **File:** `frontend/src/features/studies/pages/StudyAnalysesPage.tsx`
- Expandable analysis cards: name, type badge, cohort assignments, execution status grid (sites × status)
- Actions per analysis: Edit, Duplicate, Delete, Run, Export R Code
- "Add Analysis" button

#### S9.2 — Analysis Editor modal
- Dynamic form fields based on `analysis_type`:
  - Characterization: target cohorts, feature domains, time windows
  - Cohort Method: target/comparator/outcome, time-at-risk, PS model settings
  - Prediction: target/outcome, algorithm selector, covariate settings
  - Incidence Rate: target/outcome, stratification options
  - Pathway: target cohort, event cohorts, max path length
- Cohort selectors pull from study_cohorts (by role)

#### S9.3 — StudyExecutionsPage (enhanced)
- **File:** `frontend/src/features/studies/pages/StudyExecutionsPage.tsx`
- Execution queue table: analysis name, site, status, submitted/started/completed times, duration
- Log viewer (expandable per execution)
- Re-run and cancel actions

#### S9.4 — Execution dispatch with site selection
- Update execute flow to select specific sites or "all sites"
- Per-site execution tracking with progress indicators

---

### Phase S10: Frontend — Results & Synthesis

**Objective:** Results explorer with visualizations and meta-analysis.

#### S10.1 — StudyResultsPage
- **File:** `frontend/src/features/studies/pages/StudyResultsPage.tsx`
- Filter bar: by analysis, by site, by result type
- Result cards rendered by type (effect estimate, characterization, prediction, incidence, pathway)
- Tabular summaries with drill-down

#### S10.2 — Visualization components
- **Files:** `frontend/src/features/studies/components/charts/`
- `ForestPlot.tsx` — HR/OR/RR per site with pooled estimate (Recharts)
- `CovariateBalancePlot.tsx` — Love plot for PS diagnostics
- `ROCCurve.tsx` — per-site + pooled ROC curves
- `CalibrationPlot.tsx` — predicted vs observed
- `SunburstChart.tsx` — pathway sequences
- `SankeyDiagram.tsx` — treatment transitions
- `IncidenceRateChart.tsx` — stratified rate forest plot

#### S10.3 — StudySynthesisPage
- **File:** `frontend/src/features/studies/pages/StudySynthesisPage.tsx`
- Select results to include/exclude
- Choose synthesis method (fixed/random effects, Bayesian)
- Display: forest plot with pooled estimate, funnel plot, heterogeneity stats, leave-one-out sensitivity

---

### Phase S11: Backend — Artifact Management & Activity Logging

**Objective:** File storage, automatic activity logging, and artifact versioning.

#### S11.1 — File storage configuration
- Configure Laravel filesystem disk for study artifacts (local or S3)
- Upload validation: type whitelist, max size, virus scanning stub

#### S11.2 — Model event listeners for activity logging
- **File:** `backend/app/Observers/StudyObserver.php`
- Auto-log to `study_activity_log` on Study create/update/delete
- Similar observers for StudySite, StudyCohort, StudyAnalysis, StudyExecution status changes
- Register observers in `AppServiceProvider`

#### S11.3 — Artifact versioning
- Upload new version → set `is_current=false` on previous, `is_current=true` on new
- Download always serves `is_current=true` unless version specified

---

### Phase S12: Advanced Features

**Objective:** R Plumber bridge integration, AI-assist, and real-time updates.

#### S12.1 — R Plumber bridge endpoints
- Expand existing R Plumber stubs to accept study analysis specifications
- Endpoints: `/hades/feasibility`, `/hades/characterize`, `/hades/cohort-method`, `/hades/synthesis`
- Accept CDM connection params from study_sites + analysis spec JSON

#### S12.2 — AI-Assist for study design
- "Generate with AI" button in StudyCreate Step 2
- `POST /api/v1/studies/{slug}/ai/suggest-protocol` → MedGemma FastAPI
- Returns editable suggestions for rationale, hypothesis, design considerations

#### S12.3 — Real-time execution updates (stretch goal)
- Laravel Broadcasting (Reverb) for live execution status updates
- Frontend WebSocket listener for progress changes without polling

---

### Phase S13: Seeder, Testing & Polish

**Objective:** Comprehensive seed data and test coverage.

#### S13.1 — Expand StudySeeder
- 3 studies with full team compositions (PI, data scientist, site leads)
- 3–5 sites per study linked to existing sources
- Cohort assignments with role labels
- Milestones at various completion stages
- Activity log entries
- Sample artifacts (protocol documents as stubs)

#### S13.2 — Model factories
- `StudyFactory`, `StudySiteFactory`, `StudyTeamMemberFactory`, `StudyCohortFactory`, `StudyMilestoneFactory`

#### S13.3 — Feature tests
- StudyController CRUD tests
- Status state machine transition tests (valid + invalid)
- Team management authorization tests
- Site management tests
- Milestone CRUD tests

#### S13.4 — Frontend build verification
- TypeScript check (`npx tsc --noEmit`)
- Vite build (`npx vite build`)
- Verify all routes load without errors

---

### Dependency Order

```
S1 (Schema) → S2 (Supporting Tables) → S3 (Controllers/Routes) → S4 (Frontend Data Layer)
                                                                       ↓
S5 (Index Page) → S6 (Create Wizard) → S7 (Dashboard) → S8 (Sub-Pages)
                                                              ↓
                                            S9 (Analyses/Execution) → S10 (Results/Synthesis)
                                                                           ↓
                                                              S11 (Artifacts/Logging) → S12 (Advanced) → S13 (Testing/Polish)
```

### Estimated Scope per Phase

| Phase | New Files | Modified Files | Complexity |
|-------|-----------|---------------|------------|
| S1 | 3 | 3 | Medium |
| S2 | 12 | 2 | High |
| S3 | 8 | 2 | High |
| S4 | 3 | 3 | Medium |
| S5 | 3 | 1 | Medium |
| S6 | 2 | 1 | Medium |
| S7 | 1 | 1 | High |
| S8 | 6 | 1 | High |
| S9 | 2 | 1 | High |
| S10 | 9 | 0 | Very High |
| S11 | 2 | 2 | Medium |
| S12 | 3 | 2 | High |
| S13 | 5 | 2 | Medium |

### Key Adaptations from Spec

1. **Integer IDs** instead of UUIDs (Parthenon convention)
2. **`source_id`** instead of `organization_id` for sites (no Organization model exists)
3. **Slug-based routing** for frontend URLs (`/studies/legend-t2dm` instead of `/studies/123`)
4. **No Inertia.js** — spec mentions it but Parthenon uses React Router + API calls
5. **No shadcn/ui** — Parthenon uses custom Tailwind components with the dark marble theme
6. **Incremental enhancement** — existing Study Orchestrator code preserved and extended, not rewritten