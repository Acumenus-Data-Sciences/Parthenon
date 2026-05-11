# V7 — Treatment Pathways & Sunburst

| Field | Value |
|---|---|
| **Video ID** | V7 |
| **Title** | Treatment Pathways & Sunburst |
| **Duration** | 8 minutes |
| **Audience** | Clinical researchers, pharmacoepidemiologists, outcomes analysts |
| **Prerequisites** | V1–V3 (cohort building); at least one target cohort and several drug/procedure cohorts |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Design a treatment pathway analysis by selecting a target cohort and event cohorts.
2. Configure pathway parameters: sequence depth, minimum cell count, and combination-therapy handling.
3. Interpret Sankey diagrams showing treatment sequencing over time.
4. Interpret sunburst charts showing hierarchical pathway proportions.
5. Export pathway data for further analysis or publication.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:40 | Introduction: what are treatment pathways? |
| 0:40 – 2:30 | Designing the pathway analysis |
| 2:30 – 4:30 | Interpreting the Sankey diagram |
| 4:30 – 6:30 | Interpreting the sunburst chart |
| 6:30 – 7:20 | Exporting pathway data |
| 7:20 – 8:00 | Recap & next steps |

---

## Script

### 0:00 – 0:40 · Introduction: What Are Treatment Pathways?

**Narration:**

> Treatment pathway analysis answers the question: "After entering a cohort, what treatments do patients receive and in what order?" This is invaluable for understanding real-world prescribing patterns — first-line therapy, second-line switches, combination regimens, and how practice varies across sites. Parthenon visualizes pathways using two complementary views: a Sankey diagram that shows flows over sequential treatment lines, and a sunburst chart that shows the hierarchical breakdown of all observed pathway permutations.

**Screen action:** Title card → Parthenon Analyses module.

---

### 0:40 – 2:30 · Designing the Pathway Analysis

**Narration:**

> Navigate to **Analyses** and create a new **Treatment Pathways** analysis. First, select your **Target Cohort** — this is the population whose treatment journey you want to map. We'll use our T2DM cohort. Next, define the **Event Cohorts** — these represent the individual treatments or interventions you want to track. For diabetes, you might add cohorts for Metformin, Sulfonylureas, DPP-4 Inhibitors, GLP-1 Receptor Agonists, SGLT2 Inhibitors, and Insulin. Each event cohort should already be defined and generated. Now configure the parameters. **Sequence Depth** controls how many treatment lines to analyze — three is a good default. **Minimum Cell Count** sets the privacy threshold below which pathways are suppressed — typically five. The **Combination Window** defines how many days of overlap between two drugs constitutes a combination regimen rather than a sequential switch — 30 days is common. Click **Save & Execute**.

**Screen action:**

1. **+ New Analysis** → select **Treatment Pathways**.
2. **Target Cohort** → "T2DM with HbA1c Confirmation."
3. **Event Cohorts** → add six drug cohorts: Metformin, Sulfonylureas, DPP-4i, GLP-1 RA, SGLT2i, Insulin.
4. **Sequence Depth** → set to 3.
5. **Minimum Cell Count** → set to 5.
6. **Combination Window** → set to 30 days.
7. Click **Save & Execute**.

**Callout:** _The combination window prevents brief overlaps during a medication switch from being misclassified as intentional combination therapy. Tune it based on clinical context._

---

### 2:30 – 4:30 · Interpreting the Sankey Diagram

**Narration:**

> When the analysis completes, open the results. The default view is the **Sankey diagram**. Reading left to right, the first column shows the first-line treatment distribution. In our T2DM example, you'll likely see a large band for Metformin — reflecting its guideline status as first-line therapy. The second column shows what patients switched or added as their second treatment. Bands flow from the first column to the second, and their width is proportional to the number of patients taking that path. You might see a substantial flow from Metformin to Metformin-plus-Sulfonylurea, and another flow to Metformin-plus-SGLT2i. The third column shows third-line changes. Hover over any band to see the exact patient count and percentage. Click a band to filter the view to only that pathway, making complex diagrams easier to read.

**Screen action:**

1. Results open → Sankey diagram renders.
2. Point out the first column: Metformin dominates (e.g., 65%).
3. Trace a flow band: Metformin → Metformin + Sulfonylurea.
4. Trace another: Metformin → Metformin + SGLT2i.
5. Hover over a band → tooltip shows count and percentage.
6. Click a band → diagram filters to that single pathway.
7. Click **Reset** to restore full view.

**Callout:** _The Sankey diagram excels at showing the most common pathways at a glance. For a complete view of all permutations, switch to the sunburst._

---

### 4:30 – 6:30 · Interpreting the Sunburst Chart

**Narration:**

> Click the **Sunburst** tab to switch views. The sunburst chart is a concentric ring diagram. The innermost ring represents first-line therapy, the next ring second-line, and so on outward. Each arc's angular width is proportional to the fraction of patients on that pathway. Click on the Metformin arc in the inner ring — the chart zooms in to show only the second and third lines branching from Metformin, giving you a focused view of what happens after first-line Metformin. This is where you can spot interesting patterns — perhaps a surprising number of patients go from Metformin directly to Insulin, bypassing the oral second-line agents. Click the center circle to zoom back out. The sunburst is especially powerful for comparing pathway distributions across data sources or time periods.

**Screen action:**

1. Click **Sunburst** tab → chart renders with concentric rings.
2. Point out the inner ring (first-line) — Metformin arc is largest.
3. Point out the second ring (second-line) — multiple arcs branch from Metformin.
4. Click the Metformin arc → chart zooms into Metformin subtree.
5. Identify a Metformin → Insulin pathway arc.
6. Click center circle → zoom back to full view.
7. Toggle between data sources (if available) to show distributional differences.

**Callout:** _Color coding is consistent between the Sankey and sunburst views — Metformin is always the same color. This lets you cross-reference between the two charts._

---

### 6:30 – 7:20 · Exporting Pathway Data

**Narration:**

> To use pathway data in publications or external analytics, click **Export**. You can download the underlying pathway frequency table as CSV — each row is a unique pathway sequence with its patient count and proportion. You can also export the Sankey and sunburst charts as SVG or PNG for direct use in manuscripts or slide decks. For network studies, pathway frequency tables from each site can be shared centrally since they contain only aggregate counts.

**Screen action:**

1. Click **Export** → options: CSV (frequency table), SVG (Sankey), SVG (Sunburst), PNG.
2. Click **CSV** → file downloads.
3. Open briefly: columns are Pathway, Count, Proportion.
4. Click **SVG (Sunburst)** → file downloads.

**Callout:** _When publishing pathway results, always report the minimum cell count threshold used and the combination-therapy window. These parameters materially affect the results._

---

### 7:20 – 8:00 · Recap & Next Steps

**Narration:**

> You've now designed a treatment pathway analysis, read the Sankey and sunburst charts, and exported the results. Pathway analysis is one of the most clinically intuitive analytics in the OHDSI toolkit — clinicians and policymakers immediately grasp the visual story. Next up in V8, we'll cover migrating existing work from Atlas into Parthenon, so you can bring your prior cohort definitions and analyses along for the ride.

**Screen action:** Recap bullets animate. End card links to V8.

---

## Production Notes

- **Event cohorts:** Pre-build and generate all six drug cohorts before recording.
- **Sankey readability:** Limit to 3 sequence levels in the demo; deeper levels make the Sankey hard to read on screen.
- **Sunburst zoom:** Rehearse the click-to-zoom interaction so it's smooth on camera.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
