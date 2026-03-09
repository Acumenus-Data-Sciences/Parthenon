# Analysis Results Visualization Improvements — Design Document

**Date:** 2026-03-08
**Approach:** B (Composite Dashboards) with selective elements from A (Annotation-Rich)
**Audiences:** Clinical decision-makers, multi-site network study leads
**Interaction Model:** Layered — excellent static defaults with progressive interactive disclosure

---

## Design Principles

1. **Verdict first, evidence second.** Every analysis type gets a summary dashboard that answers "what's the finding?" before showing the supporting charts.
2. **Plain language alongside statistics.** Every key metric has a significance verdict in words, with the numbers shown as supporting detail.
3. **Static excellence.** Charts must be screenshot-ready and publication-quality by default. Interactive features are progressive enhancements.
4. **Cross-site awareness.** Multi-database results surface heterogeneity and consensus visually, not just numerically.
5. **Consistent vocabulary.** Traffic-light badges, significance verdicts, and tooltip patterns are identical across all six analysis types.

---

## Section 1: Estimation (CohortMethod)

### 1.1 Verdict Dashboard (New Component)

**Effect Summary Card** — single glanceable panel:
- Large HR value with direction arrow (down-arrow protective / up-arrow harmful)
- Calibrated p-value shown alongside uncalibrated, with visual indicator of how much calibration shifted the estimate
- **NNT or NNH** computed from KM curves at user-selectable time horizons (1yr, 3yr, 5yr)
- Significance verdict badge: "Significant protective effect", "Not statistically significant", "Significant harmful effect"
- Confidence interval bar — horizontal, colored by whether it crosses the null

**Benefit-Risk Balance Strip** — horizontal diverging bar:
- Left side: absolute risk reduction (teal)
- Right side: key safety outcomes (red)
- At-a-glance "is the benefit worth the risk" view

### 1.2 Forest Plot Enhancements

- Prediction interval (dashed line) alongside CI — expected range of effect in a new site/study
- Study weight encoding — square size proportional to sample size / precision
- Toggle between HR, OR, RR scales
- NNT/NNH column added to right-side labels

### 1.3 Kaplan-Meier Curve Enhancements

- Absolute risk difference shaded region between curves
- Restricted mean survival time (RMST) difference annotation
- Interactive time cursor — hover to see survival probability + risk difference at any timepoint
- Confidence bands toggle (on/off)

### 1.4 Systematic Error Plot Enhancements

- Calibrated estimates overlay — pre and post-calibration positions with connecting arrows
- Leave-one-out cross-validation indicator — flag negative controls with high leverage

---

## Section 2: Evidence Synthesis (Meta-Analysis)

### 2.1 Verdict Dashboard (New Component)

**Pooled Effect Card:**
- Large pooled HR with method label (Bayesian RE / Fixed Effect / DerSimonian-Laird)
- **Prediction interval** prominently displayed alongside CI
- Heterogeneity summary: I-squared percentage with interpretive label (Low <25% / Moderate 25-75% / High >75%), tau-squared, Cochran's Q p-value
- Site agreement indicator: "X of Y sites show protective effect"

**Site Heterogeneity Map** (new visualization):
- Bubble/strip plot — one bubble per site/database
- X-axis: log(HR) — position shows effect direction and magnitude
- Bubble size: proportional to study weight (inverse variance)
- Bubble color: teal (HR<1), red (HR>1), gray (CI spans null)
- Vertical reference lines at HR=1 (null) and pooled estimate (gold diamond)
- Hover: site name, sample size, HR [95% CI], weight %

### 2.2 Forest Plot Enhancements

- Prediction interval diamond — wider, semi-transparent behind the pooled CI diamond
- Weight % column per site row
- Site sample size column (N target + comparator)
- Heterogeneity band — subtle horizontal gradient behind all rows showing spread implied by tau-squared
- Leave-one-out sensitivity markers — indicator dots showing whether removing each site changes pooled significance
- Subgroup separators with sub-pooled estimates per stratum

---

## Section 3: Incidence Rates

### 3.1 Verdict Dashboard (New Component)

**Comparative IR Card:**
- Large IR per 1,000 PY for each cohort, side by side
- **Rate Difference** (IRD) with 95% CI — absolute measure
- **Rate Ratio** (IRR) with 95% CI — relative measure
- Significance verdict badge

**Stratified Comparison Panel** (when strata exist):
- Small multiples grid — one mini IR bar pair per stratum
- Highlights subgroups driving the overall effect
- Flags strata where direction reverses (effect modification)
- Sortable by IRD magnitude

### 3.2 Forest Plot Enhancements

- Dual-scale toggle: Rate Ratio (log scale) vs. Rate Difference (linear scale)
- Population attributable fraction (PAF) column when applicable
- Strata grouping with sub-summary diamonds

### 3.3 Summary Table Enhancements

- Sparkline trend column for temporal IR trends
- Gradient background on IR cells (intensity = magnitude)
- Sortable by any column
- CI width indicator — narrow = high precision (teal), wide = low precision (amber)

---

## Section 4: Prediction (Patient-Level Prediction)

### 4.1 Verdict Dashboard (New Component)

**Model Performance Scorecard** — traffic-light summary:
- **Discrimination:** AUC with traffic light (green >=0.80, amber 0.70-0.79, red <0.70) and label ("Good", "Acceptable", "Poor")
- **Calibration:** Calibration-in-the-large + slope with traffic light (green if slope 0.8-1.2 and intercept near 0)
- **Clinical Utility:** Net benefit at user-selectable threshold probability
- **Overall Verdict:** composite badge ("Ready for validation", "Needs recalibration", "Insufficient discrimination")

**Clinical Utility Threshold Selector** (interactive):
- Slider for decision threshold probability (5%, 10%, 20%)
- Dynamically updates: sensitivity, specificity, PPV, NPV, NNS
- Highlights operating point on ROC curve

### 4.2 ROC Curve Enhancements

- Optimal operating point marked (Youden's J) with sensitivity/specificity annotation
- Interactive cursor — hover along curve for threshold, sensitivity, specificity, PPV, NPV
- Confidence band (bootstrap CI)
- Comparison overlay — validation ROC (gold) alongside development ROC (teal)

### 4.3 Calibration Plot Enhancements

- Decile grouping with population histogram marginal along x-axis
- Loess smoothed line alongside decile points
- ICI (Integrated Calibration Index) and E-max annotation

### 4.4 Net Benefit Curve Enhancements

- Shaded region showing where model beats "treat all" and "treat none"
- Interpretive annotations at common threshold values
- Decision curve crossover points labeled

### 4.5 Prediction Distribution Enhancements

- Overlapping histograms for outcome vs. no-outcome groups
- Draggable threshold line with live-updating confusion matrix counts

---

## Section 5: SCCS (Self-Controlled Case Series)

### 5.1 Verdict Dashboard (New Component)

**Risk Window Summary Card:**
- Large IRR for primary exposure window with direction arrow and significance verdict
- **Absolute excess risk** during exposure period
- Pre-exposure trend test: pass/fail badge (critical SCCS validity diagnostic)
- Control period IRR as reference (deviation flags model misspecification)

**Multi-Window Comparison Strip** (new):
- Horizontal strip — all risk windows laid out sequentially
- IRR colored badge above each timeline block
- Flags concerning patterns: elevated pre-exposure (assumption violation), elevated post-exposure (carryover), dose-response across sub-windows

### 5.2 Era Timeline Enhancements

- IRR magnitude encoding — block height proportional to log(IRR)
- Confidence interval whiskers on each era block
- Event density overlay — dots/ticks showing individual events within each window
- Interactive hover — IRR [95% CI], event count, person-time per era

### 5.3 IRR Table Enhancements

- Inline mini forest plot per row (horizontal CI line with point estimate)
- Sort by IRR magnitude
- Wide CI precision warning flags

### 5.4 New: Age/Season Adjustment Diagnostic

- Line chart showing adjusted vs. unadjusted IRR — flags material changes from adjustment

---

## Section 6: Characterization

### 6.1 Verdict Dashboard (New Component)

**Cohort Balance Summary Card:**
- Balance verdict: "Well balanced" / "Marginal imbalance" / "Significant imbalance"
- Metric strip: total covariates, % with |SMD| < 0.1, % with |SMD| > 0.2, mean absolute SMD
- Before/after matching comparison strips side by side

**Top Imbalanced Covariates Spotlight** (new):
- Top 5-10 most imbalanced covariates as horizontal diverging bars
- Bar extends left (higher in target) or right (higher in comparator)
- Length = absolute SMD, color intensity = magnitude
- Covariate name + prevalence inline

### 6.2 Love Plot Enhancements

- Density marginal histogram along x-axis showing SMD distribution
- Quadrant annotations with subtle background shading ("Balanced", "Marginal", "Imbalanced")
- Interactive brush selection — drag to select dots, populates filtered table below
- Before/after animation — toggle or animated transition showing matching effect

### 6.3 Feature Comparison Table Enhancements

- Heatmap mode toggle — rows = covariates, columns = cohorts, cell color = prevalence
- Prevalence difference column with inline diverging bar
- Domain grouping with collapsible sections and per-domain summary SMD
- Export-friendly clean table view for manuscripts

---

## Cross-Cutting Enhancements (All Analysis Types)

### 7.1 Export and Sharing

- One-click SVG/PNG export per chart (publication-quality, white background option)
- "Copy summary" button — plain-text statistical summary to clipboard
- PDF report generation — full results page as formatted document

### 7.2 Interpretation Helpers

- "What does this mean?" expandable tooltip on every key metric (NNT, I-squared, AUC, etc.)
- Traffic-light badges with consistent language across all analysis types
- Glossary sidebar accessible from any results page

### 7.3 Comparison Mode

- Side-by-side execution comparison — pick two completed executions, overlay or mirror charts
- Use cases: different time windows, matching strategies, sensitivity analyses

### 7.4 Print/Publication Mode

- Toggle to white background, black text, print-optimized spacing
- Strips interactive elements, produces clean static charts for journal submission

---

## Technical Approach

- All new verdict dashboard components: custom React + SVG (consistent with existing architecture)
- Interactive elements: React state + event handlers on existing SVG (no new library dependencies)
- Recharts remains limited to Data Explorer CDM charts only
- D3 used for scale computations (log scales, color interpolation) where needed
- framer-motion for animated transitions (already in dependencies)
- Export: svg-to-png via canvas API, PDF via html2canvas + jsPDF

---

## References

- [Gatto et al. 2022 — Visualizations throughout pharmacoepidemiology study planning, implementation, and reporting](https://pmc.ncbi.nlm.nih.gov/articles/PMC9826437/)
- [OHDSI EmpiricalCalibration — Systematic error visualization](https://ohdsi.github.io/EmpiricalCalibration/)
- [Book of OHDSI — Method Validity (Ch. 18)](https://ohdsi.github.io/TheBookOfOhdsi/MethodValidity.html)
- [Divisi — Interactive subgroup analysis visualization (CHI 2025)](https://dl.acm.org/doi/10.1145/3706598.3713103)
- [Subgroup analysis graphics critical review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8647927/)
