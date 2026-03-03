# V5 — Data Quality Dashboard

| Field | Value |
|---|---|
| **Video ID** | V5 |
| **Title** | Data Quality Dashboard |
| **Duration** | 8 minutes |
| **Audience** | CDM administrators, data engineers, quality leads |
| **Prerequisites** | V4 (Achilles) recommended; data source with Achilles results |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Launch a Data Quality Dashboard (DQD) run against a connected CDM source.
2. Read the DQD scorecard — overall pass rate, domain-level breakdown, and category scores.
3. Drill down from a failed check to its description, threshold, and affected records.
4. Acknowledge known issues and track remediation over time.
5. Compare DQD results across data-source refreshes.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:40 | Introduction: why DQD? |
| 0:40 – 2:00 | Running a DQD check |
| 2:00 – 4:00 | Reading the scorecard |
| 4:00 – 5:30 | Drill-down into failed checks |
| 5:30 – 6:45 | Acknowledgements & remediation tracking |
| 6:45 – 7:30 | Comparing across refreshes |
| 7:30 – 8:00 | Recap & next steps |

---

## Script

### 0:00 – 0:40 · Introduction: Why DQD?

**Narration:**

> In V4 we ran Achilles and glanced at Achilles Heel, which gives a quick first pass on data quality. The Data Quality Dashboard takes this much further. DQD implements the OHDSI Data Quality framework — a systematic set of over 3,500 configurable checks organized into five categories: Completeness, Conformance, Plausibility, Computation, and Temporal. Together they answer the question: "Is this data fit for purpose?" Let's run it.

**Screen action:** Title card → Parthenon Data Sources module.

**Callout:** _DQD checks are based on the OHDSI "Kahn Framework" for data quality, published in JAMIA. The categories map to standard data-quality dimensions used across the industry._

---

### 0:40 – 2:00 · Running a DQD Check

**Narration:**

> Navigate to **Data Sources**, select your source, and click the **Data Quality** tab. If a previous run exists you'll see its scorecard. Click **Run DQD** to start a new run. The configuration panel lets you select which check categories to include — by default all five are enabled. You can also set the failure threshold percentage — the minimum pass rate required for a category to be flagged green. Leave the defaults for now and click **Start**. DQD leverages the Achilles results tables so it runs faster if Achilles has already been executed.

**Screen action:**

1. Data Sources → select **Synpuf 1K** → click **Data Quality** tab.
2. Click **Run DQD** → configuration panel opens.
3. Show category toggles: Completeness ✅, Conformance ✅, Plausibility ✅, Computation ✅, Temporal ✅.
4. Show threshold slider (default 80%).
5. Click **Start** → job submitted.
6. Job completes (pre-recorded for speed).

**Callout:** _On large databases, consider running DQD on a representative sample first to get a fast baseline, then run the full check set overnight._

---

### 2:00 – 4:00 · Reading the Scorecard

**Narration:**

> The DQD scorecard is your single-pane summary of data quality. At the top you'll see the **overall pass rate** — the percentage of checks that passed across all categories. Below that, a heatmap matrix breaks down pass rates by category (rows) and CDM domain (columns). Green cells mean the pass rate meets or exceeds the threshold; yellow is borderline; red is below threshold. Scan the heatmap for red cells — those are your priority areas. In our Synpuf example, you might see Completeness for the Measurement domain flagged yellow because synthetic data often has sparse lab results. Click any cell to drill into the specific checks behind that score.

**Screen action:**

1. Scorecard loads — overall pass rate displayed prominently (e.g., 87%).
2. Heatmap matrix renders: categories × domains.
3. Point out green, yellow, red cells.
4. Hover over a red cell — tooltip shows "Drug Exposure · Plausibility: 62% pass."
5. Click the cell → transitions to drill-down view.

**Callout:** _The pass-rate threshold is configurable. For regulatory submissions, many organizations set it to 90% or higher._

---

### 4:00 – 5:30 · Drill-Down into Failed Checks

**Narration:**

> The drill-down view shows every individual check within the selected category-domain intersection. Each row displays the check name, a plain-language description, the threshold, the actual value, and a pass/fail badge. Let's look at a failed check: "Plausibility — Drug exposure duration exceeds 365 days." The description explains that the check flags records where a single drug exposure spans more than a year, which is often a data-mapping error. The "Affected Records" column tells you how many rows triggered this check. Click the row to see the underlying SQL query and a sample of the affected concept IDs. This gives your ETL team the information they need to trace and fix the issue.

**Screen action:**

1. Check list table renders — sort by status to show failures first.
2. Click a failed check row → detail panel opens.
3. Show fields: check name, description, threshold (365 days), actual value, affected record count.
4. Scroll to **SQL** section — syntax-highlighted query.
5. Show **Affected Concepts** list with concept IDs and names.

**Callout:** _DQD checks are defined in a community-maintained JSON configuration file. You can customize thresholds or add organization-specific checks._

---

### 5:30 – 6:45 · Acknowledgements & Remediation Tracking

**Narration:**

> Not every failed check requires immediate action — some are known limitations of your data source. Parthenon lets you **acknowledge** a failed check. Click the acknowledge button, add a note explaining why the failure is accepted — for example, "Synpuf synthetic data does not model drug-exposure durations realistically; accepted for training purposes." The check now shows an acknowledgement badge and your name and timestamp. Acknowledged checks are excluded from the pass-rate calculation in the next summary view, giving you a clearer picture of actionable issues. For checks that do need remediation, you can assign an owner and a target-fix date directly from this panel.

**Screen action:**

1. Click **Acknowledge** on the failed check → note dialog opens.
2. Type explanation: `Synpuf synthetic data limitation; accepted for training.`
3. Click **Save** → badge appears on the check row.
4. Show the alternative: click **Assign Remediation** → owner picker and date field.

**Callout:** _Acknowledgements create an audit trail. Reviewers and auditors can see who accepted a known issue, when, and why._

---

### 6:45 – 7:30 · Comparing Across Refreshes

**Narration:**

> Each time you receive a new data refresh and re-run DQD, Parthenon stores the results as a versioned snapshot. Click **Compare** and select two runs — say, the January and April refreshes. A side-by-side view shows you which checks improved, which regressed, and which are new. This trend view is essential for continuous quality monitoring: you want to see the overall pass rate trending upward over time as ETL issues are fixed, not the other way around.

**Screen action:**

1. Click **Compare** → run selector shows available snapshots.
2. Select "2024-01-15" and "2024-04-20."
3. Comparison view renders: delta column showing ↑ improved, ↓ regressed.
4. Show overall pass rate trend line across all historical runs.

**Callout:** _Integrate DQD runs into your ETL pipeline — schedule them automatically after each data refresh to catch regressions early._

---

### 7:30 – 8:00 · Recap & Next Steps

**Narration:**

> You now know how to run DQD, read the scorecard and heatmap, drill into failed checks, acknowledge known issues, and track quality trends across refreshes. Data quality is not a one-time activity — it's a continuous process. Make DQD a standing part of your data-refresh workflow. In the next video, V6, we'll shift from data quality to clinical analysis — characterization and incidence rate calculations.

**Screen action:** Recap bullets animate. End card links to V6.

---

## Production Notes

- **Pre-run DQD:** Have DQD results ready before recording to avoid wait time.
- **Threshold config:** Use the default 80% threshold in the demo; mention that organizations customize this.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
