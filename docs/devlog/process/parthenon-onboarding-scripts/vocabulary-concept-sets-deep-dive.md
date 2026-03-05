# V2 — Vocabulary & Concept Sets Deep Dive

| Field | Value |
|---|---|
| **Video ID** | V2 |
| **Title** | Vocabulary & Concept Sets Deep Dive |
| **Duration** | 12 minutes |
| **Audience** | Cohort designers, vocabulary stewards, informaticists |
| **Prerequisites** | Completed V1 or equivalent familiarity with Parthenon navigation |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Search the OMOP Standardized Vocabularies using keyword, code, and concept-ID lookups.
2. Navigate concept hierarchies and understand the role of Standard vs. Non-Standard concepts.
3. Use the "Include Descendants" and "Include Mapped" toggles to broaden or narrow a concept set.
4. Create, save, version, and share a concept set with team members.
5. Compare concept sets across vocabulary versions to detect drift.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:40 | Introduction |
| 0:40 – 2:30 | Searching the vocabulary |
| 2:30 – 4:30 | Understanding hierarchy & relationships |
| 4:30 – 6:30 | Descendants, mapped concepts & set logic |
| 6:30 – 8:30 | Creating & managing concept sets |
| 8:30 – 10:30 | Sharing, versioning & export |
| 10:30 – 11:30 | Concept set comparison across vocab versions |
| 11:30 – 12:00 | Recap & next steps |

---

## Script

### 0:00 – 0:40 · Introduction

**Narration:**

> Concept sets are the building blocks of almost everything you do in Parthenon — from cohort definitions to characterization analyses. If the concept set is wrong, every downstream result will be wrong too. In this tutorial we'll take a deep dive into how Parthenon's vocabulary tools help you find the right concepts, assemble them into reusable sets, and keep those sets current as vocabularies evolve.

**Screen action:** Title card → transition to Parthenon home screen.

---

### 0:40 – 2:30 · Searching the Vocabulary

**Narration:**

> Open the **Concept Sets** module from the left rail and click **Search Vocabulary**. The search bar accepts three input types: free-text keywords like "hypertension," source vocabulary codes like ICD-10-CM code I10, or OMOP concept IDs like 320128. Let's start with a keyword search. Type "atrial fibrillation" and press Enter. Results appear in a table sorted by relevance. Each row shows the concept ID, concept name, domain, vocabulary, standard-concept flag, and the number of records in the selected data source. Notice the blue "S" badge — that marks a Standard concept, which is what you'll use in most analyses. Non-standard concepts appear with a grey "N" badge; these are source codes that map to a standard concept.

**Screen action:**

1. Click **Concept Sets** → click **Search Vocabulary**.
2. Type `atrial fibrillation` → press Enter.
3. Results table renders. *(Highlight the "S" and "N" badges in the Standard column.)*
4. Clear search → type `I10` → show ICD-10-CM result.
5. Clear search → type `320128` → show direct concept-ID lookup.

**Callout:** _Standard concepts are the lingua franca of OMOP. When you build cohorts, always anchor your concept sets on Standard concepts and then optionally include mapped source codes._

---

### 2:30 – 4:30 · Understanding Hierarchy & Relationships

**Narration:**

> Click on the row for "Atrial fibrillation" (concept 313217) to open the Concept Detail panel. You'll see three relationship tabs: **Hierarchy**, **Relationships**, and **Mappings**. The Hierarchy tab shows where this concept sits in SNOMED's classification tree. You can navigate up to broader parent concepts like "Cardiac arrhythmia" or down to narrower children like "Paroxysmal atrial fibrillation" and "Persistent atrial fibrillation." The Relationships tab lists all non-hierarchical links — things like "has finding site → heart structure." The Mappings tab shows which source vocabulary codes (ICD-10-CM, Read, etc.) map to this standard concept. Understanding these relationships is critical when deciding how wide to cast your net.

**Screen action:**

1. Click concept 313217 row → detail panel slides in.
2. Click **Hierarchy** tab → tree view renders.
3. Expand parent: "Cardiac arrhythmia."
4. Expand children: show "Paroxysmal atrial fibrillation," "Persistent atrial fibrillation."
5. Click **Relationships** tab → relationship list loads.
6. Click **Mappings** tab → mapping table loads, highlight ICD-10-CM `I48.0`, `I48.1`, `I48.2`, `I48.91`.

**Callout:** _The hierarchy depth varies by vocabulary. SNOMED typically has deep hierarchies; RxNorm has ingredient → clinical drug → branded drug levels._

---

### 4:30 – 6:30 · Descendants, Mapped Concepts & Set Logic

**Narration:**

> Now let's talk about the two most powerful toggles in concept set design: **Include Descendants** and **Include Mapped**. When you add concept 313217 to a concept set and turn on Include Descendants, Parthenon automatically pulls in every child, grandchild, and deeper descendant beneath it. This is the recommended approach for most clinical phenotypes — you define the intent at a high level and let the hierarchy do the work. Include Mapped adds non-standard source codes that map to any concept already in your resolved set. This is useful when your ETL preserves source codes and you want to query them directly. You can also **Exclude** specific concepts. For instance, if you want atrial fibrillation but not atrial flutter, you'd add atrial flutter as an excluded item. The resolved concept set preview at the bottom updates in real time so you always see exactly what's included.

**Screen action:**

1. Return to Concept Set Editor. Add concept 313217.
2. Toggle **Include Descendants** on → resolved count increases (e.g., 5 → 23).
3. Toggle **Include Mapped** on → resolved count increases further (e.g., 23 → 47).
4. Add concept 314665 (Atrial flutter) → toggle **Exclude** on for it.
5. Resolved set preview table at bottom updates — flutter concepts disappear.

**Callout:** _Always review the resolved preview before saving. Descendant trees can be surprisingly large — for broad concepts like "Neoplasm" the resolved set can contain thousands of entries._

---

### 6:30 – 8:30 · Creating & Managing Concept Sets

**Narration:**

> Let's create a concept set from scratch. Click **+ New Concept Set** and give it a name — "Atrial Fibrillation – Broad." Add a description. Now use the search to find and add your anchor concepts, configure descendants and exclusions as we just discussed, and click **Save**. Your concept set now appears in the library. You can open it any time to review or edit. The concept set has a unique numeric ID — you'll reference this ID when wiring concept sets into cohort definitions or analysis configurations. You can also tag concept sets with labels like "Cardiology" or "Validated" to make the library easier to filter.

**Screen action:**

1. Click **+ New Concept Set** → name it `Atrial Fibrillation – Broad`.
2. Add description.
3. Search and add concepts as shown in previous section.
4. Click **Save**.
5. Return to library → new concept set appears.
6. Click the tag icon → add tag "Cardiology."

**Callout:** _Concept sets are reusable across cohort definitions and analyses. Build once, reference many times — this keeps your phenotype logic consistent._

---

### 8:30 – 10:30 · Sharing, Versioning & Export

**Narration:**

> Parthenon tracks every change to a concept set as a version. Click the **History** tab to see a timestamped changelog. Each version records who made the change, what was added or removed, and a diff view. To share a concept set with another user or team, click **Permissions** and add read or write access. You can also export a concept set to JSON or CSV for use in external tools or for archiving. The JSON export follows the OHDSI concept-set-expression schema, so it's directly importable into legacy Atlas instances or other OMOP tools if needed.

**Screen action:**

1. Open the concept set → click **History** tab.
2. Show two version entries with diff highlights.
3. Click **Permissions** → add a team member with "Read" access.
4. Click **Export** → choose JSON → file downloads.
5. Open the JSON briefly in a code viewer to show the structure.

**Callout:** _The JSON export captures the expression logic (concept IDs, descendants flags, exclusions) — not the resolved concept list. This means the same expression can resolve differently against a newer vocabulary version._

---

### 10:30 – 11:30 · Concept Set Comparison Across Vocabulary Versions

**Narration:**

> Vocabularies are updated periodically — SNOMED releases twice a year, ICD-10-CM annually, RxNorm monthly. When a vocabulary update lands, your concept sets may resolve to a different set of concepts. Parthenon's **Concept Set Comparison** tool lets you select two vocabulary versions side by side and see which concepts were added, removed, or changed. This is essential for maintaining reproducibility in longitudinal studies. Run the comparison, review the diff report, and decide whether your concept set expression needs adjustment.

**Screen action:**

1. Open the concept set → click **Compare Versions**.
2. Select "Vocabulary v5.0 2024-01" vs. "Vocabulary v5.0 2024-07."
3. Diff report renders: green rows (added), red rows (removed), yellow rows (modified).
4. Review a removed concept row — hover for details.

**Callout:** _Schedule quarterly concept set reviews aligned with vocabulary releases. This prevents silent phenotype drift in long-running studies._

---

### 11:30 – 12:00 · Recap & Next Steps

**Narration:**

> Let's recap. You now know how to search the OMOP vocabulary using keywords, codes, and IDs. You understand the hierarchy and how Include Descendants and Include Mapped work. You can create, version, share, and export concept sets, and you can compare them across vocabulary releases. In the next video, V3, we'll put these concept sets to work inside the Cohort Builder with advanced inclusion criteria, temporal windows, and end strategies.

**Screen action:** Recap bullets animate. End card links to V3.

---

## Production Notes

- **Vocabulary version:** Record against a specific vocabulary version and display it on screen (e.g., "v5.0 2024-07").
- **Concept counts:** Will vary by data source; use Synpuf or a synthetic CDM and note counts are illustrative.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
