# V10 — AI Concept Mapping Review

| Field | Value |
|---|---|
| **Video ID** | V10 |
| **Title** | AI Concept Mapping Review |
| **Duration** | 8 minutes |
| **Audience** | Vocabulary stewards, informaticists, CDM administrators |
| **Prerequisites** | V2 (vocabulary and concept sets); understanding of source-to-standard mapping |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Understand how Parthenon's AI engine generates candidate source-to-standard concept mappings.
2. Navigate the mapping review queue and interpret confidence scores.
3. Accept, reject, or modify individual mapping suggestions.
4. Use batch-accept workflows for high-confidence mappings.
5. Review the audit trail for all mapping decisions and export mapping tables.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:45 | Introduction: the mapping challenge |
| 0:45 – 2:15 | How the AI engine works |
| 2:15 – 4:00 | The review queue |
| 4:00 – 5:30 | Accept, reject, modify |
| 5:30 – 6:30 | Batch accept for high-confidence mappings |
| 6:30 – 7:15 | Audit trail & export |
| 7:15 – 8:00 | Recap & next steps |

---

## Script

### 0:00 – 0:45 · Introduction: The Mapping Challenge

**Narration:**

> Every organization that transforms source data into the OMOP Common Data Model faces the mapping challenge: thousands of local source codes — lab tests, diagnoses, procedures, medications — need to be mapped to OMOP Standard Concepts. Traditionally this is a manual, expert-driven process that can take weeks or months. Parthenon introduces an AI-assisted approach. The platform's machine learning engine analyzes your unmapped source codes, evaluates textual similarity, semantic context, and hierarchical relationships, and proposes candidate Standard Concept mappings ranked by confidence. Your job as a vocabulary steward is to review, validate, and approve those candidates. Let's see how it works.

**Screen action:** Title card → Parthenon Administration → Vocabulary Management module.

**Callout:** _AI-assisted mapping augments — it does not replace — human expert review. Every mapping must be reviewed and approved by a qualified steward before it enters the production vocabulary._

---

### 0:45 – 2:15 · How the AI Engine Works

**Narration:**

> Under the hood, Parthenon's mapping engine uses a multi-signal approach. First, it performs **lexical matching** — comparing the source code's description text against Standard Concept names using fuzzy string similarity. Second, it uses **embedding-based semantic similarity** — dense vector representations of clinical terms trained on biomedical corpora — to catch synonyms and paraphrases that lexical matching misses. Third, it considers **hierarchical context** — if a source code belongs to a category (like "cardiology lab tests"), the engine up-weights Standard Concepts in the relevant OMOP domains and vocabularies. The result is a ranked list of candidate mappings for each unmapped source code, each with a confidence score from zero to one. Scores above 0.9 indicate very high confidence. Scores between 0.7 and 0.9 are moderate — worth reviewing but likely correct. Below 0.7, the engine is less certain and human judgment is essential.

**Screen action:**

1. Diagram overlay: Source Code → [Lexical Match + Semantic Embedding + Hierarchical Context] → Ranked Candidates.
2. Show a sample source code: "HgbA1c" → candidate list with scores:
   - 0.96: LOINC 4548-4 "Hemoglobin A1c/Hemoglobin.total in Blood"
   - 0.82: LOINC 17856-6 "Hemoglobin A1c/Hemoglobin.total in Blood by HPLC"
   - 0.61: LOINC 59261-8 "Hemoglobin A1c in Blood by IFCC protocol"

**Callout:** _The confidence score is calibrated — a score of 0.9 means the engine is correct roughly 90% of the time on held-out validation sets. Your organization's accuracy may vary based on source code quality._

---

### 2:15 – 4:00 · The Review Queue

**Narration:**

> Navigate to **Administration** → **Vocabulary Management** → **Mapping Review**. The review queue shows all source codes awaiting review, organized by data source. Each row shows the source code, source description, the top candidate Standard Concept, its confidence score, and the domain. The queue is sortable and filterable. Sort by confidence descending to start with the easy wins — high-confidence mappings you can validate quickly. Or filter by domain to work through all Condition mappings, then all Drug mappings, and so on. The badge in the header shows the total count of unmapped codes and a breakdown by confidence tier: green (above 0.9), yellow (0.7–0.9), red (below 0.7).

**Screen action:**

1. Administration → Vocabulary Management → **Mapping Review**.
2. Queue table loads: Source Code, Description, Top Candidate, Score, Domain.
3. Header badge: "847 unmapped codes — 312 high, 401 moderate, 134 low."
4. Sort by score descending — high-confidence rows at top.
5. Filter by Domain = "Condition" → filtered view.

**Callout:** _Tackle high-confidence mappings first with batch accept (covered shortly). This lets you clear the bulk of the queue quickly and focus manual effort on the uncertain cases._

---

### 4:00 – 5:30 · Accept, Reject, Modify

**Narration:**

> Click a row to open the mapping review panel. On the left you see the source code details: the code, its description, the source vocabulary, and any existing partial mappings. On the right you see the ranked candidate list. The top candidate is pre-selected. Review it — does this Standard Concept accurately represent the clinical meaning of the source code? If yes, click **Accept**. The mapping is saved and the source code moves to the "Reviewed" state. If the top candidate is wrong, you have two options. **Reject** it and move to the next candidate in the list — perhaps the second or third option is correct. Or click **Search** to manually find the right Standard Concept using the vocabulary search tools from V2 — type a keyword, find the concept, and assign it. Once you assign a mapping manually, the AI engine learns from your correction and improves future suggestions for similar codes.

**Screen action:**

1. Click a row → review panel opens (split view: source on left, candidates on right).
2. Review top candidate — it's correct. Click **Accept** → green checkmark, row moves to Reviewed.
3. Click next row → top candidate is wrong (e.g., mapped to wrong specificity level).
4. Click **Reject** on top candidate → second candidate highlights.
5. Second candidate is also wrong → click **Search** → vocabulary search opens.
6. Find the correct concept → click **Assign** → mapping saved.

**Callout:** _Every accept, reject, and manual assignment is recorded with your user ID and timestamp. This builds a complete provenance chain for regulatory and reproducibility purposes._

---

### 5:30 – 6:30 · Batch Accept for High-Confidence Mappings

**Narration:**

> For large source vocabularies, reviewing codes one by one is impractical. Parthenon's batch-accept feature lets you approve all mappings above a confidence threshold in one action. In the review queue, click **Batch Actions** and select **Accept All Above Threshold**. Set the threshold — 0.95 is conservative; 0.90 is more aggressive. The preview shows how many codes will be accepted and invites you to spot-check a random sample before committing. Review the sample — if they look right, click **Confirm Batch Accept**. In our example, setting the threshold to 0.95 might clear 280 of the 312 high-confidence codes in one click, leaving only 32 for individual review.

**Screen action:**

1. Click **Batch Actions** → select **Accept All Above Threshold**.
2. Set threshold slider to 0.95.
3. Preview: "280 mappings will be accepted."
4. Spot-check sample: 5 random mappings displayed — review each briefly.
5. Click **Confirm Batch Accept** → progress bar → "280 mappings accepted."
6. Queue count updates: 847 → 567.

**Callout:** _Batch accept is powerful but irreversible in bulk. Always spot-check the random sample. If any sample mapping is wrong, lower the threshold or switch to individual review for that domain._

---

### 6:30 – 7:15 · Audit Trail & Export

**Narration:**

> Every mapping decision is captured in the audit trail. Navigate to **Mapping Audit** to see a chronological log of all actions: who accepted or rejected which mapping, when, and with what confidence score. You can filter by reviewer, action type, or date range. For downstream use, click **Export Mapping Table** to download the complete source-to-standard mapping as a CSV or JSON file. This export follows the OMOP `source_to_concept_map` format, ready to load into your CDM's vocabulary schema. You can also push approved mappings directly to your CDM via Parthenon's vocabulary deployment pipeline if configured.

**Screen action:**

1. Click **Mapping Audit** → chronological log of mapping actions.
2. Filter by reviewer → show one reviewer's decisions.
3. Click **Export Mapping Table** → choose CSV → file downloads.
4. Open briefly: columns match `source_to_concept_map` schema.

**Callout:** _The exported mapping table is versioned. Each export captures a snapshot so you can track how your mappings evolve over time and roll back if needed._

---

### 7:15 – 8:00 · Recap & Next Steps

**Narration:**

> Let's recap. Parthenon's AI concept mapping engine accelerates one of the most time-consuming steps in CDM management. You've learned how the engine generates candidate mappings, how to navigate the review queue, how to accept, reject, or modify suggestions individually or in batch, and how to maintain a complete audit trail. With all ten tutorials complete, you now have a comprehensive foundation in Parthenon — from your first cohort to advanced analytics to administration and AI-assisted vocabulary management. Visit the Parthenon documentation site for detailed reference material, and reach out to your administrator or the Parthenon support team with any questions. Thanks for watching.

**Screen action:** Recap bullets animate. Final end card: "Explore the full Parthenon documentation at docs.parthenon.example.com." Series logo.

---

## Production Notes

- **AI confidence scores:** Use realistic but synthetic scores; do not claim specific accuracy metrics that haven't been validated on real data.
- **Batch accept demo:** Pre-populate the queue with a realistic number of entries so the batch action feels substantial.
- **Source codes:** Use generic example source codes (e.g., local lab codes) that don't reveal any organization's proprietary vocabulary.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
