# V3 — Cohort Builder: Advanced Criteria

| Field | Value |
|---|---|
| **Video ID** | V3 |
| **Title** | Cohort Builder: Advanced Criteria |
| **Duration** | 15 minutes |
| **Audience** | Epidemiologists, phenotype developers, study leads |
| **Prerequisites** | V1 (first cohort), V2 (concept sets) |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Configure multiple inclusion rules with AND/OR logic.
2. Apply qualifying criteria (age, gender, first occurrence, visit context).
3. Define temporal windows between clinical events.
4. Choose and configure cohort end strategies (end-of-observation, fixed duration, event-based).
5. Use correlated criteria (nested event conditions) for complex phenotypes.
6. Validate a cohort definition using the expression viewer and SQL preview.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:50 | Introduction |
| 0:50 – 3:00 | Inclusion rules & Boolean logic |
| 3:00 – 5:00 | Qualifying criteria: demographics & visit context |
| 5:00 – 7:30 | Temporal windows |
| 7:30 – 9:30 | End strategies |
| 9:30 – 12:00 | Correlated criteria & nested events |
| 12:00 – 13:30 | Expression viewer & SQL preview |
| 13:30 – 15:00 | Worked example recap & next steps |

---

## Script

### 0:00 – 0:50 · Introduction

**Narration:**

> In V1 we built a simple one-criterion cohort. Real-world phenotypes are rarely that simple. You might need patients with a diagnosis AND a lab result within 30 days, excluding those who had a prior procedure. This tutorial covers the advanced features of Parthenon's Cohort Builder — inclusion logic, temporal windows, end strategies, and correlated criteria. We'll build a moderately complex phenotype step by step.

**Screen action:** Title card → open an empty cohort definition named "T2DM with HbA1c Confirmation."

---

### 0:50 – 3:00 · Inclusion Rules & Boolean Logic

**Narration:**

> Every cohort definition has an **initial event** — the entry-point criterion — plus zero or more **inclusion rules** that further restrict who qualifies. Think of the initial event as casting a wide net, and each inclusion rule as a filter that narrows it. Within an inclusion rule, you can combine multiple criteria groups using AND or OR. Let's set up our initial event as a condition occurrence of T2DM, just like in V1. Now add an inclusion rule. Call it "HbA1c ≥ 6.5%." Inside this rule, add a Measurement criterion, wire it to an HbA1c concept set, and set a value qualifier: value as number ≥ 6.5. This rule says "among everyone who entered via the T2DM condition, keep only those who also have an HbA1c measurement of 6.5 or above."

**Screen action:**

1. Initial event: Condition Occurrence → T2DM concept set (reused from V1).
2. Click **+ Add Inclusion Rule** → name it "HbA1c ≥ 6.5%."
3. Click **+ Add Criteria Group** → select **Add Measurement**.
4. Wire to HbA1c concept set.
5. Set value qualifier: Operator = `>=`, Value = `6.5`.
6. Show the rule card with its summary line.

**Callout:** _Each inclusion rule is evaluated independently. A person must pass ALL inclusion rules to remain in the cohort (they are implicitly ANDed together)._

---

### 3:00 – 5:00 · Qualifying Criteria: Demographics & Visit Context

**Narration:**

> You can further qualify any criterion with demographic and contextual filters. Let's say we want patients who are at least 18 years old at the time of the initial event. Click the initial event card and expand **Qualifying Criteria**. Add an age filter: age at event ≥ 18. You can also restrict by gender — for instance, limit to female patients for a gestational diabetes sub-cohort. Another powerful qualifier is **visit context**. If you want the diagnosis to have occurred during an inpatient stay, add a visit-type qualifier set to "Inpatient Visit." This prevents picking up diagnosis codes recorded in non-clinical contexts.

**Screen action:**

1. Click the initial event card → expand **Qualifying Criteria**.
2. Click **+ Add Qualifier** → select **Age at Event** → set `≥ 18`.
3. Show a second qualifier option: Gender → select "Female" *(show, then remove to keep the example gender-neutral)*.
4. Click **+ Add Qualifier** → select **Visit Context** → choose "Inpatient Visit."

**Callout:** _Visit-context qualification is especially important for claims data, where a single encounter may carry multiple diagnosis codes with varying clinical significance._

---

### 5:00 – 7:30 · Temporal Windows

**Narration:**

> One of the most powerful features is the ability to define temporal relationships between events. Let's require that the HbA1c measurement occurs within 90 days before or 30 days after the initial T2DM diagnosis. Open the HbA1c inclusion rule, click the criterion, and expand **Temporal Window**. Set the start offset to minus 90 days relative to the initial event and the end offset to plus 30 days. The timeline diagram updates to show the window visually. You can also chain temporal requirements — for example, adding a second inclusion rule for a diabetes drug exposure that must start within 180 days after the initial event. Temporal windows let you express the clinical narrative as a sequence of events anchored to the index date.

**Screen action:**

1. Open the "HbA1c ≥ 6.5%" inclusion rule.
2. Click the measurement criterion → expand **Temporal Window**.
3. Set Start = `-90 days relative to initial event`.
4. Set End = `+30 days relative to initial event`.
5. Timeline diagram animates to show the window.
6. Add a second inclusion rule: "Diabetes Drug within 180 days."
7. Drug Exposure criterion → DM drug concept set → temporal window `0 to +180 days`.

**Callout:** _Offset day 0 is the index date — the date of the initial event. Negative values look back in time; positive values look forward._

---

### 7:30 – 9:30 · End Strategies

**Narration:**

> Every cohort record needs a start date and an end date. The start date is the initial event date. But when does a person's cohort membership end? Parthenon offers several end strategies. **End of continuous observation** keeps the person in the cohort until there's a gap in their data — ideal for insurance-enrollment-based analyses. **Fixed duration** sets a specific number of days after entry — for example, 365 days for an annualized exposure window. **Event-based end** terminates cohort membership when a specified clinical event occurs — such as when a patient stops taking the drug or has a specific outcome. Choose the strategy that matches your study design. Let's set ours to "end of continuous observation" since we want to follow T2DM patients for as long as they have data.

**Screen action:**

1. Click the **Cohort Exit** section of the builder.
2. Show the three strategy options as radio buttons.
3. Select **End of Continuous Observation** → summary text updates.
4. Briefly click **Fixed Duration** → show the days input field (365), then switch back.
5. Briefly click **Event-Based** → show the event selector, then switch back.

**Callout:** _Your end strategy directly affects time-at-risk calculations in downstream analyses. Choose carefully and document your rationale._

---

### 9:30 – 12:00 · Correlated Criteria & Nested Events

**Narration:**

> Correlated criteria let you express conditions like "the patient must have at least two occurrences of X within Y days" or "the patient must NOT have had event Z at any time prior." Inside an inclusion rule, expand the **Occurrence Count** setting. Change it from "at least 1" to "at least 2" and set the temporal window to 365 days. Now every qualifying person must have two separate HbA1c readings above 6.5 within a year. For exclusion logic, add a new inclusion rule, add your exclusion concept set — say, Type 1 Diabetes — set the occurrence count to "exactly 0," and set the temporal window to "all time prior to initial event." This says: exclude anyone with any Type 1 DM code at any time before their T2DM index date. This is the pattern for clean exclusion criteria.

**Screen action:**

1. Open the HbA1c inclusion rule → expand **Occurrence Count**.
2. Change from `at least 1` to `at least 2`.
3. Set temporal window to `0 to +365 days relative to initial event`.
4. Add new inclusion rule: "No Prior Type 1 DM."
5. Add Condition Occurrence → Type 1 DM concept set.
6. Set occurrence count = `exactly 0`.
7. Set temporal window = `all time prior to initial event`.

**Callout:** _"Exactly 0" within a temporal window is the pattern for exclusion criteria in the OHDSI cohort framework. You're defining a required absence of an event._

---

### 12:00 – 13:30 · Expression Viewer & SQL Preview

**Narration:**

> Before generating, let's validate the definition. Click the **Expression** tab to see a human-readable summary of the complete cohort logic — initial event, all inclusion rules, temporal windows, and end strategy in structured text. Review this carefully. Then click **SQL Preview** to see the exact SQL that Parthenon will execute against the CDM. This is invaluable for debugging and for transparency when publishing study protocols. The SQL is dialect-specific — Parthenon generates SQL for your target database platform (PostgreSQL, SQL Server, Spark, etc.).

**Screen action:**

1. Click **Expression** tab → structured text renders.
2. Scroll through the expression, highlighting each rule.
3. Click **SQL Preview** → SQL code renders with syntax highlighting.
4. Show dialect selector: toggle between PostgreSQL and SQL Server.

**Callout:** _Include the expression text in your study protocol appendix for full reproducibility. Reviewers and regulators appreciate this level of transparency._

---

### 13:30 – 15:00 · Worked Example Recap & Next Steps

**Narration:**

> Let's review the phenotype we just built. Initial event: first T2DM condition occurrence, age 18 or older, during an inpatient visit. Inclusion rule one: HbA1c at 6.5 percent or above within 90 days before to 30 days after the index date, occurring at least twice within a year. Inclusion rule two: diabetes drug exposure within 180 days after index. Inclusion rule three: no Type 1 DM at any time prior. End strategy: end of continuous observation. That's a rigorous, multi-criteria phenotype built entirely in the visual builder with no hand-written SQL. In the next video, V4, we'll generate this cohort, run Achilles characterization, and interpret the results.

**Screen action:** Animated summary card listing each component. End card links to V4.

---

## Production Notes

- **Phenotype example:** T2DM with HbA1c confirmation is a well-understood OHDSI phenotype; adapt concept IDs to the vocabulary version used at recording time.
- **Timeline diagram:** Ensure the animated temporal window diagram is clearly visible at 1080p.
- **SQL preview:** Blur or mask any data-source connection strings visible in the SQL header.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
