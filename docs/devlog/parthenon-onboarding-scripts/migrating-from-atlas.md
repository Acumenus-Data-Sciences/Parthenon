# V8 — Migrating from Atlas

| Field | Value |
|---|---|
| **Video ID** | V8 |
| **Title** | Migrating from Atlas |
| **Duration** | 10 minutes |
| **Audience** | Existing Atlas users, CDM administrators, IT teams |
| **Prerequisites** | Familiarity with OHDSI Atlas; Parthenon admin access for import |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Export cohort definitions, concept sets, and analysis configurations from Atlas.
2. Import Atlas artifacts into Parthenon using the migration wizard.
3. Validate imported objects using Parthenon's parity checker.
4. Configure URL redirects so existing bookmarks and API integrations continue to work.
5. Run a side-by-side generation comparison to confirm numeric equivalence.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:45 | Introduction: why migrate? |
| 0:45 – 2:30 | Exporting from Atlas |
| 2:30 – 5:00 | Importing into Parthenon |
| 5:00 – 7:00 | Parity check: validating imported objects |
| 7:00 – 8:30 | URL redirects |
| 8:30 – 9:30 | Side-by-side generation comparison |
| 9:30 – 10:00 | Recap & next steps |

---

## Script

### 0:00 – 0:45 · Introduction: Why Migrate?

**Narration:**

> If your organization has been using OHDSI Atlas, you likely have a library of cohort definitions, concept sets, characterization configurations, and pathway analyses built up over months or years. Parthenon is designed to be a superset of Atlas functionality, and we've built a migration path so you don't have to start from scratch. This tutorial walks through the full export-import-validate cycle.

**Screen action:** Title card → split screen showing Atlas on the left, Parthenon on the right.

---

### 0:45 – 2:30 · Exporting from Atlas

**Narration:**

> Start in Atlas. Navigate to the Cohort Definition you want to migrate. Click the **Export** tab and select **JSON**. This produces the standard OHDSI cohort-expression JSON — it contains the full definition logic including concept sets, inclusion rules, and end strategies. Save the file. Repeat for each cohort you want to migrate. For concept sets, navigate to the Concept Set library in Atlas, open each set, and export its JSON expression. For analysis configurations — characterization, incidence rates, pathways — export their JSON definitions the same way. If you have dozens or hundreds of objects, Atlas also supports a bulk export through its WebAPI endpoint. You can script this: a simple curl call to `/WebAPI/cohortdefinition` returns all definitions as JSON. We provide a migration helper script in the Parthenon documentation that automates bulk export.

**Screen action:**

1. In Atlas: open a cohort definition → click **Export** tab → click **JSON** → save file.
2. Open a concept set → export JSON.
3. Show the terminal briefly: `curl https://atlas.example.com/WebAPI/cohortdefinition` → JSON array returned.
4. Mention the bulk-export helper script in docs.

**Callout:** _The Atlas JSON export format is the OHDSI community standard. Parthenon's importer understands this format natively — no transformation needed._

---

### 2:30 – 5:00 · Importing into Parthenon

**Narration:**

> Switch to Parthenon. Navigate to **Administration** → **Migration**. You'll see the Import Wizard. There are two import modes: **Single File** for individual JSON files, and **Bulk Import** for a directory of exported files or a ZIP archive. Let's use Bulk Import. Click **Upload** and select the ZIP containing all your exported Atlas artifacts. Parthenon parses the archive and shows a preview table — each row is an artifact with its type (cohort, concept set, analysis), name, Atlas ID, and an import-readiness status. Green checkmarks mean the artifact is ready. Yellow warnings might indicate a concept set references vocabulary concepts not present in Parthenon's loaded vocabulary — you'll need to ensure vocabulary versions match. Red errors indicate structural issues in the JSON. Review the preview, resolve any warnings, and click **Import Selected**. The wizard creates all objects in Parthenon, preserving names, descriptions, and internal cross-references.

**Screen action:**

1. Parthenon: Administration → Migration → Import Wizard.
2. Select **Bulk Import** → click **Upload** → select ZIP file.
3. Preview table renders: artifact rows with type, name, Atlas ID, status badges (✅, ⚠️, ❌).
4. Click a ⚠️ row → warning detail: "Concept set references vocab v5.0 2023-07; Parthenon has v5.0 2024-01."
5. Click **Import Selected** (all green items) → progress bar → import complete.

**Callout:** _Parthenon assigns new internal IDs to imported objects but preserves the original Atlas ID as metadata for traceability. You can search by Atlas ID at any time._

---

### 5:00 – 7:00 · Parity Check: Validating Imported Objects

**Narration:**

> After import, run the **Parity Checker**. This tool compares the logical structure of each imported object against its Atlas source to confirm nothing was lost or transformed incorrectly in transit. Navigate to Administration → Migration → Parity Check. Select the batch you just imported and click **Run Check**. The checker compares concept-set expressions (concept IDs, descendant flags, exclusions), cohort-definition logic (initial events, inclusion rules, temporal windows, end strategies), and analysis parameters. Results appear as a diff report — green rows mean perfect match, yellow rows show non-critical differences (like whitespace or formatting), and red rows flag structural discrepancies that need investigation.

**Screen action:**

1. Administration → Migration → **Parity Check**.
2. Select the import batch → click **Run Check**.
3. Results table renders: artifact name, check result (✅ Match, ⚠️ Minor diff, ❌ Mismatch).
4. Click a ⚠️ row → diff view shows formatting-only difference.
5. Click a ✅ row → full match confirmed.

**Callout:** _Run the parity check before decommissioning your Atlas instance. It's your safety net to ensure nothing was lost in translation._

---

### 7:00 – 8:30 · URL Redirects

**Narration:**

> Your team likely has bookmarks, Confluence links, and API integrations that point to Atlas URLs — things like `atlas.example.com/#/cohortdefinition/42`. Parthenon's redirect feature maps old Atlas URLs to their new Parthenon equivalents. Navigate to Administration → Migration → **URL Redirects**. Parthenon auto-generates a redirect map based on the Atlas IDs preserved during import. Review the map — each row shows the old Atlas URL pattern and the new Parthenon URL. You can deploy these redirects at your web server or load balancer so that anyone hitting an old Atlas link is transparently forwarded to Parthenon. Export the map as an Nginx or Apache configuration snippet for easy deployment.

**Screen action:**

1. Administration → Migration → **URL Redirects**.
2. Auto-generated redirect table: Old URL → New URL.
3. Show a sample row: `atlas.example.com/#/cohortdefinition/42` → `parthenon.example.com/cohorts/def/107`.
4. Click **Export as Nginx Config** → file downloads.
5. Open briefly: show `rewrite` rules.

**Callout:** _URL redirects eliminate the "where did my stuff go?" problem. Deploy them before announcing the migration to your user base._

---

### 8:30 – 9:30 · Side-by-Side Generation Comparison

**Narration:**

> The ultimate validation is a numeric comparison. Generate a cohort in both Atlas and Parthenon against the same data source and compare the counts. Parthenon's comparison tool lets you enter the Atlas-generated count alongside the Parthenon-generated count for each cohort. If they match, you have high confidence the migration is faithful. If they differ, drill into the SQL preview in both tools to find the divergence — it's usually a vocabulary version difference or a subtle default-setting mismatch. Resolve any discrepancies before going live.

**Screen action:**

1. Side-by-side: Atlas generation result (Persons = 124) and Parthenon generation result (Persons = 124).
2. Show the comparison tool: enter counts, status shows ✅ Match.
3. Show an example mismatch scenario: 124 vs 121.
4. Click **View SQL Diff** → highlight the divergent clause.

**Callout:** _Document your comparison results as part of your migration validation report. This is essential for audited environments._

---

### 9:30 – 10:00 · Recap & Next Steps

**Narration:**

> You now know the full migration workflow: export from Atlas, import into Parthenon via the wizard, validate with the parity checker, set up URL redirects, and confirm numeric equivalence with side-by-side generation. Migration doesn't have to be a big-bang event — you can run Atlas and Parthenon in parallel during a transition period. In V9, we'll cover Parthenon's administration features: users, roles, and authentication configuration.

**Screen action:** Recap bullets animate. End card links to V9.

---

## Production Notes

- **Atlas instance:** If a live Atlas instance is not available for recording, use pre-captured screenshots and mock the export step.
- **ZIP file:** Prepare a demo ZIP with 3–5 cohorts and concept sets for the bulk import demo.
- **Numeric comparison:** Use Synpuf 1K on both Atlas and Parthenon to ensure identical counts for the demo.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
