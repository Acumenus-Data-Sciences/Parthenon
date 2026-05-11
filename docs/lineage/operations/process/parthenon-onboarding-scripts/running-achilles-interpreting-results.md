# V4 — Running Achilles & Interpreting Results

| Field | Value |
|---|---|
| **Video ID** | V4 |
| **Title** | Running Achilles & Interpreting Results |
| **Duration** | 10 minutes |
| **Audience** | Data analysts, CDM administrators, study leads |
| **Prerequisites** | V1 (navigation familiarity); at least one CDM data source configured |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Initiate an Achilles characterization run from Parthenon.
2. Monitor job progress and review run logs.
3. Navigate the Achilles results dashboard — domain summary charts, data-density plots, and concept-frequency treemaps.
4. Interpret Achilles Heel warning and error messages.
5. Export Achilles results for external reporting.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:40 | Introduction: what is Achilles? |
| 0:40 – 2:00 | Starting an Achilles run |
| 2:00 – 3:30 | Monitoring job progress |
| 3:30 – 6:00 | Exploring the results dashboard |
| 6:00 – 8:00 | Achilles Heel: warnings & errors |
| 8:00 – 9:15 | Exporting results |
| 9:15 – 10:00 | Recap & next steps |

---

## Script

### 0:00 – 0:40 · Introduction: What Is Achilles?

**Narration:**

> Achilles is the OHDSI community's standard tool for database-level characterization. It computes a comprehensive set of summary statistics across every domain of your CDM — conditions, drugs, procedures, measurements, observations, visits, and more. Think of it as a full-body MRI for your dataset. Running Achilles is typically one of the first things you do after an ETL completes, and it should be re-run whenever the data refreshes. Parthenon wraps Achilles in a managed job framework so you can launch, monitor, and explore results without leaving the platform.

**Screen action:** Title card → Parthenon home screen with the **Data Sources** module highlighted.

**Callout:** _Achilles is maintained by the OHDSI community as an open-source R package. Parthenon orchestrates it so you don't need to manage R environments manually._

---

### 0:40 – 2:00 · Starting an Achilles Run

**Narration:**

> Navigate to **Data Sources** in the left rail and select the data source you want to characterize — we'll use "Synpuf 1K." Click the **Achilles** tab. If Achilles has been run before, you'll see the last-run timestamp and a summary. To start a new run, click **Run Achilles**. A configuration panel appears. You can run the full analysis set — which computes all 170+ analyses — or select a subset by domain. For your first run, choose the full set. You can also toggle **Achilles Heel** on or off; we recommend leaving it on to get data-quality checks alongside the characterization. Click **Start** and the job is submitted.

**Screen action:**

1. Click **Data Sources** → select **Synpuf 1K**.
2. Click the **Achilles** tab → previous run summary shown (or empty state).
3. Click **Run Achilles** → configuration panel opens.
4. Show the "Full Analysis" vs. "Select Domains" radio options.
5. Toggle **Achilles Heel** on.
6. Click **Start** → job submitted toast notification appears.

**Callout:** _A full Achilles run on a large CDM (100M+ records) can take several hours. Schedule it during off-peak hours. On Synpuf 1K it completes in under a minute._

---

### 2:00 – 3:30 · Monitoring Job Progress

**Narration:**

> After submission, Parthenon redirects you to the **Jobs** panel. Here you'll see your Achilles run with a progress bar and status — queued, running, or completed. Click the job row to expand the detail view, which shows a real-time log stream. You'll see each analysis module execute in sequence — demographics, condition era, drug exposure, and so on. If any module fails, the log will capture the error and the job will continue with the remaining modules rather than aborting entirely. Once the status turns to "Completed," the results are ready.

**Screen action:**

1. Jobs panel opens — show the Achilles job row with progress bar.
2. Click the row → log stream expands in a panel below.
3. Scroll the log — highlight lines showing module completion: "Analysis 1: persons – complete," etc.
4. Status changes to ✅ **Completed**.

**Callout:** _You can navigate away from the Jobs panel while Achilles is running — the job executes server-side. You'll receive a notification when it finishes._

---

### 3:30 – 6:00 · Exploring the Results Dashboard

**Narration:**

> Return to the data source's Achilles tab. The dashboard now shows a rich set of visualizations. Let's walk through the key sections. The **Summary** card at the top shows total person count, observation period range, and a gender/age pyramid. Below that, each domain has its own section. Open **Condition** — you'll see a treemap showing the most frequent condition concepts by record count. Click on a treemap cell — say, "Essential hypertension" — and you drill into a detail card showing prevalence over time, age distribution at first occurrence, and visit-type breakdown. The **Drug** domain has the same structure but adds duration-of-exposure distributions. The **Data Density** tab shows record-count-per-person distributions across domains, which is a quick way to spot domains with suspiciously low or high data density. Spend time here — these charts will become your go-to for understanding what's in a dataset before you design any study.

**Screen action:**

1. Return to Data Source → Achilles tab → dashboard loads.
2. Show the Summary card: person count, observation period, age-gender pyramid.
3. Click **Condition** domain → treemap renders.
4. Click "Essential hypertension" cell → detail card expands (prevalence trend, age histogram, visit-type pie chart).
5. Navigate back → click **Drug** domain → treemap for drugs.
6. Click the **Data Density** tab → per-person record-count histograms for each domain.

**Callout:** _The treemap is sized by record count and colored by domain. Larger cells represent more prevalent concepts. Use it as a rapid orientation to the clinical landscape of your data source._

---

### 6:00 – 8:00 · Achilles Heel: Warnings & Errors

**Narration:**

> Achilles Heel is the data-quality-check companion to Achilles. It applies a set of heuristic rules to the characterization results and flags issues as Notifications, Warnings, or Errors. Click the **Heel** tab to see the results. Errors are serious — for example, "Records found with observation-period end date before start date" indicates a fundamental ETL problem. Warnings flag issues that may or may not be problems depending on context — like "Condition prevalence exceeds 50 percent for concept X" which could be valid for a disease-specific registry but suspicious for a general-population database. Notifications are informational. Click any row to see the affected analysis, the SQL rule that triggered it, and a description. Use Heel as a punch list: fix errors before using the data source in any study, investigate warnings, and acknowledge notifications.

**Screen action:**

1. Click the **Heel** tab → results table with severity icons: 🔴 Error, 🟡 Warning, 🔵 Notification.
2. Sort by severity.
3. Click an Error row → detail panel shows the rule, description, affected analysis.
4. Click a Warning row → detail panel shows context.
5. Show the count badges: e.g., 2 Errors, 14 Warnings, 43 Notifications.

**Callout:** _Achilles Heel is not an exhaustive data-quality assessment — see V5 for the full Data Quality Dashboard (DQD). Heel is a rapid first pass; DQD is the comprehensive audit._

---

### 8:00 – 9:15 · Exporting Results

**Narration:**

> You can export Achilles results for external reporting or for loading into community tools like the OHDSI Data Quality Dashboard. Click **Export** and choose your format — JSON for programmatic use or a ZIP bundle containing CSV files for each analysis. The export includes both the aggregate statistics and the Heel results. For multi-site network studies, each site can export their Achilles results and share them centrally for cross-database comparison without exposing patient-level data.

**Screen action:**

1. Click **Export** button → format selector appears.
2. Select **JSON** → file downloads.
3. Select **CSV Bundle** → ZIP downloads.
4. Briefly show the contents of the ZIP: one CSV per analysis.

**Callout:** _Achilles results are aggregate counts and distributions — they contain no patient-level data and are safe to share across organizations for network studies._

---

### 9:15 – 10:00 · Recap & Next Steps

**Narration:**

> To summarize: you now know how to initiate and monitor an Achilles run, explore the domain-level dashboards and treemaps, read and triage Achilles Heel warnings and errors, and export results for external use. Achilles gives you the lay of the land — before designing any study, always run it first. Next up in V5, we'll dive into the full Data Quality Dashboard, which goes well beyond Heel with a comprehensive, configurable set of quality checks.

**Screen action:** Recap bullets animate. End card links to V5.

---

## Production Notes

- **Demo data source:** Use Synpuf 1K for fast Achilles runs; pre-run Achilles before recording so results are available instantly.
- **Treemap colors:** Verify treemap is legible and colorblind-accessible in the recording.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
