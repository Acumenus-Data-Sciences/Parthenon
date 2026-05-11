# V6 — Characterization & Incidence Rates

| Field | Value |
|---|---|
| **Video ID** | V6 |
| **Title** | Characterization & Incidence Rates |
| **Duration** | 12 minutes |
| **Audience** | Epidemiologists, outcomes researchers, biostatisticians |
| **Prerequisites** | V1–V3 (cohort building), at least one generated cohort |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Design a cohort characterization analysis selecting target cohorts and feature sets.
2. Interpret baseline characteristic tables and standardized mean differences (SMD).
3. Read and configure forest plots for multi-database comparisons.
4. Configure an incidence rate analysis with target cohort, outcome, and time-at-risk settings.
5. Apply stratification by age, gender, and calendar year.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:45 | Introduction |
| 0:45 – 3:00 | Designing a characterization analysis |
| 3:00 – 5:00 | Baseline characteristics & SMD |
| 5:00 – 6:30 | Forest plots & multi-database comparison |
| 6:30 – 9:00 | Incidence rate analysis design |
| 9:00 – 10:30 | Stratification |
| 10:30 – 12:00 | Interpreting results & next steps |

---

## Script

### 0:00 – 0:45 · Introduction

**Narration:**

> Once you have a cohort, the next question is: "What do these patients look like?" Characterization answers that by computing a comprehensive profile of baseline demographics, comorbidities, medication use, and more. Incidence rate analysis answers the complementary question: "How often does an outcome occur in this population?" This tutorial covers both workflows in Parthenon's Analysis module.

**Screen action:** Title card → Parthenon Analyses module.

---

### 0:45 – 3:00 · Designing a Characterization Analysis

**Narration:**

> Navigate to **Analyses** in the left rail and click **+ New Analysis**. Select **Cohort Characterization** as the analysis type. The design panel has three sections. First, **Target Cohorts** — select one or more cohorts to characterize. Let's pick our T2DM cohort from V3 and, for comparison, a general-population cohort. Second, **Feature Sets** — these define which baseline characteristics to compute. Parthenon ships with pre-built feature sets: Demographics, Condition Group Era (short and long term), Drug Group Era, Procedure, Measurement, and Charlson Comorbidity Index. Select the ones relevant to your study — for a broad profile, select all of them. Third, **Data Sources** — choose which CDMs to run against. Click **Save & Execute** and the job is queued.

**Screen action:**

1. Analyses → **+ New Analysis** → select **Cohort Characterization**.
2. **Target Cohorts** section → add "T2DM with HbA1c Confirmation" and "General Population."
3. **Feature Sets** section → check: Demographics, Condition Group Era (Long Term), Drug Group Era (Long Term), Charlson.
4. **Data Sources** → check "Synpuf 1K."
5. Click **Save & Execute** → job submitted.

**Callout:** _"Long Term" feature sets look at the full history prior to cohort entry. "Short Term" windows are typically 30 or 90 days before entry — useful for capturing acute baseline state._

---

### 3:00 – 5:00 · Baseline Characteristics & SMD

**Narration:**

> When the job completes, open the results. The **Characteristics Table** is the centerpiece. Each row is a covariate — a specific clinical feature like "Condition: Essential hypertension in the 365 days prior to index." The columns show the proportion of patients in each target cohort who have that covariate. When you have two cohorts, the table also computes the **Standardized Mean Difference** — SMD. An SMD close to zero means the two cohorts are similar on that feature. An SMD above 0.1 is conventionally considered an imbalance worth noting. The table is sortable and filterable. Sort by absolute SMD descending to quickly identify the features where your cohorts differ most. This is the standard approach for Table 1 in an observational study.

**Screen action:**

1. Open characterization results → **Characteristics Table** tab.
2. Show columns: Covariate Name, T2DM Proportion, General Pop Proportion, SMD.
3. Sort by |SMD| descending.
4. Highlight top rows with highest imbalance.
5. Click a row to expand covariate details.

**Callout:** _SMD is preferred over p-values for comparing cohort characteristics because it is not influenced by sample size. A large cohort will almost always produce "significant" p-values, even for clinically trivial differences._

---

### 5:00 – 6:30 · Forest Plots & Multi-Database Comparison

**Narration:**

> If you ran the characterization against multiple data sources, Parthenon generates a **forest plot** for each covariate. The forest plot shows the proportion or mean for each data source as a point estimate with a confidence interval, plus a combined meta-analytic estimate. This lets you see whether a characteristic is consistent across databases or shows heterogeneity. Click any covariate row and then the **Forest Plot** icon. The plot renders with data sources on the y-axis and the estimate on the x-axis. Wide confidence intervals suggest small sample sizes or sparse data for that covariate in that source.

**Screen action:**

1. Switch to a view with multiple data sources (or show a mock-up).
2. Click a covariate row → click the **Forest Plot** icon.
3. Forest plot renders: data sources on y-axis, proportion on x-axis, diamond for meta-estimate.
4. Hover over a point — tooltip shows source name, n, proportion, CI.

**Callout:** _Forest plots are particularly valuable in OHDSI network studies where the same analysis runs across dozens of sites. They help detect site-specific data anomalies._

---

### 6:30 – 9:00 · Incidence Rate Analysis Design

**Narration:**

> Now let's set up an incidence rate analysis. Return to the Analyses module and click **+ New Analysis**, this time selecting **Incidence Rate**. The design has four components. **Target Cohort** is the population at risk — our T2DM cohort. **Outcome Cohort** is the event you're measuring — let's use a "Major Adverse Cardiovascular Event" cohort we've previously defined. **Time at Risk** defines the observation window: start is cohort entry, end is cohort exit, and you can optionally cap it at a fixed number of days. **Clean Window** specifies the minimum number of days a person must be outcome-free before cohort entry to be considered a new incident case — this prevents prevalent cases from inflating your rate. Set it to 365 days. Click **Save & Execute**.

**Screen action:**

1. **+ New Analysis** → select **Incidence Rate**.
2. **Target Cohort** → select "T2DM with HbA1c Confirmation."
3. **Outcome Cohort** → select "MACE" (Major Adverse Cardiovascular Event).
4. **Time at Risk** → Start: cohort entry, End: cohort exit.
5. **Clean Window** → set to `365 days`.
6. **Data Sources** → check "Synpuf 1K."
7. Click **Save & Execute**.

**Callout:** _The clean window is critical for distinguishing incident (new) cases from prevalent (existing) cases. Without it, a patient who had a heart attack the day before entering your T2DM cohort would be counted as a new event._

---

### 9:00 – 10:30 · Stratification

**Narration:**

> Parthenon lets you stratify both characterization and incidence rate results by demographic dimensions. In the analysis design, click **Stratification** and select the dimensions: Age Group (5-year or 10-year bands), Gender, and Calendar Year. When the analysis completes, the results panel adds a stratification selector. Choose "Age Group" and the incidence rate table and chart break down into age-specific rows. You can combine strata — for example, age group by gender — to see rates for 50–59-year-old females versus 50–59-year-old males. Stratification is essential for identifying subgroups at disproportionately high or low risk.

**Screen action:**

1. In the analysis design, click **Stratification** → check Age Group (10-year), Gender, Calendar Year.
2. Execute and open results.
3. Click stratification selector → choose "Age Group."
4. Table and bar chart re-render with age-group rows.
5. Add a second dimension: Gender → nested breakdown appears.

**Callout:** _Be cautious with fine-grained stratification on small datasets — cell counts below 5 may trigger minimum-cell-count suppression to protect privacy._

---

### 10:30 – 12:00 · Interpreting Results & Next Steps

**Narration:**

> Let's read the incidence rate results. The summary shows the total person-years at risk, the number of outcome events, and the incidence rate per 1,000 person-years with a 95% confidence interval. In our example, the MACE incidence in the T2DM cohort might be 12.4 per 1,000 person-years. The stratified view shows how this varies — perhaps higher in the 70–79 age group and in males. Compare this against published literature to validate plausibility. If your rates are an order of magnitude off, revisit the cohort definition, the outcome phenotype, or the data source quality. Characterization and incidence rates together form the foundation for any observational study. In V7, we'll build on this by exploring treatment pathways.

**Screen action:**

1. Results summary card: person-years, events, rate, CI.
2. Stratified chart: age-group bars with error bars.
3. Quick comparison callout with published literature range.
4. End card links to V7.

---

## Production Notes

- **Cohorts needed:** Pre-build a T2DM cohort, a general-population cohort, and a MACE outcome cohort before recording.
- **Forest plot:** If only one data source is available, show a mock multi-source forest plot as a static overlay and note it's illustrative.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
