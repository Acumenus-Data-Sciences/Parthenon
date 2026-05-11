# V1 — Getting Started: Your First Cohort

| Field | Value |
|---|---|
| **Video ID** | V1 |
| **Title** | Getting Started: Your First Cohort |
| **Duration** | 8 minutes |
| **Audience** | New Parthenon users, epidemiologists, data analysts |
| **Prerequisites** | Valid Parthenon account; at least one CDM data source configured |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Log in to Parthenon and orient yourself within the main navigation.
2. Create a new cohort definition using the Cohort Builder.
3. Add a simple inclusion criterion (e.g., a diagnosis concept set).
4. Generate the cohort against a connected CDM data source.
5. Review the generation results and basic cohort counts.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:45 | Introduction & what you'll build |
| 0:45 – 2:00 | Logging in & navigating the home screen |
| 2:00 – 3:15 | Creating a new cohort definition |
| 3:15 – 4:45 | Adding your first concept set & inclusion criterion |
| 4:45 – 6:00 | Selecting a data source & generating the cohort |
| 6:00 – 7:15 | Reviewing generation results |
| 7:15 – 8:00 | Recap & next steps |

---

## Script

### 0:00 – 0:45 · Introduction & What You'll Build

**Narration:**

> Welcome to Parthenon. In this tutorial we'll walk through the most fundamental workflow in the platform — building your very first cohort definition. A cohort is simply a set of patients who share one or more clinical characteristics during a specific time window. By the end of the next eight minutes you'll have a working cohort you can use in downstream analyses like characterization, incidence rates, and treatment pathways.

**Screen action:** Title card with Parthenon logo fades to the browser login page.

**Callout:** _A cohort in OMOP CDM terms is a set of person-period records stored in the `cohort` table._

---

### 0:45 – 2:00 · Logging In & Navigating the Home Screen

**Narration:**

> Open your browser and navigate to your organization's Parthenon URL. Enter your credentials — this may be a local account or your single-sign-on identity if your administrator has configured LDAP or OIDC. Once you're in, you'll see the Home dashboard. On the left navigation rail you'll find the main modules: Cohorts, Concept Sets, Analyses, Data Sources, Jobs, and Administration. We'll spend most of our time today in the Cohorts section.

**Screen action:**

1. Type URL in browser address bar. *(Highlight the address bar.)*
2. Enter username and password; click **Sign In**.
3. Home dashboard loads — show the left navigation rail.
4. Hover over each icon in the rail; tooltip labels appear.

**Callout:** _If your organization uses SSO, you'll see a "Sign in with SSO" button instead of the username/password fields. See V9 (Administration) for configuration details._

---

### 2:00 – 3:15 · Creating a New Cohort Definition

**Narration:**

> Click **Cohorts** in the left rail. You'll land on the Cohort Library, which lists every cohort definition visible to you. To create a new one, click the **+ New Cohort** button in the upper-right corner. Give it a meaningful name — we'll call ours "Type 2 Diabetes Mellitus – First Diagnosis." Add a brief description so colleagues know the intent. Then click **Create**.

**Screen action:**

1. Click **Cohorts** in left rail → Cohort Library loads.
2. Click **+ New Cohort** → modal appears.
3. Type name: `Type 2 Diabetes Mellitus – First Diagnosis`.
4. Type description: `Persons with a first recorded diagnosis of T2DM on or after 2018-01-01.`
5. Click **Create** → Cohort Builder canvas opens.

**Callout:** _Naming tip — include the key clinical concept plus any temporal qualifier. This makes the library easy to search later._

---

### 3:15 – 4:45 · Adding Your First Concept Set & Inclusion Criterion

**Narration:**

> The Cohort Builder opens on the **Definition** tab. Every cohort starts with an **initial event** — the clinical record that marks a person's entry into the cohort. Click **Add Initial Event** and select "Add Condition Occurrence." Now we need to tell Parthenon which conditions we mean. Click the concept set selector and choose **Create New Concept Set**. Search for "Type 2 diabetes mellitus" — you'll see the standard SNOMED concept at the top. Select it, then expand its descendants to include all child concepts. Save the concept set and return to the builder. You'll see your criterion is now wired up.

**Screen action:**

1. On the Definition tab, click **Add Initial Event** → dropdown appears.
2. Select **Add Condition Occurrence**.
3. Click the concept set pill → options appear; click **Create New Concept Set**.
4. In the concept search modal, type `Type 2 diabetes mellitus`.
5. Results appear — click the row for SNOMED `201826` (Type 2 diabetes mellitus).
6. Toggle **Include Descendants** on.
7. Click **Save Concept Set** → return to the builder canvas.
8. The criterion card now shows the concept set name and concept count badge.

**Callout:** _Including descendants captures all more-specific child codes beneath the selected concept. For T2DM this pulls in variants like "Type 2 diabetes mellitus with renal complication" and others._

---

### 4:45 – 6:00 · Selecting a Data Source & Generating the Cohort

**Narration:**

> With the definition in place, let's generate. Click the **Generation** tab at the top of the builder. You'll see a list of data sources your administrator has connected. Select the one you'd like to query — for this demo we'll use the "Synpuf 1K" synthetic dataset. Click **Generate** and Parthenon will submit a job to build the cohort table against that source. The progress indicator shows the job status. Most small-to-mid-size generations complete within seconds.

**Screen action:**

1. Click the **Generation** tab.
2. Data source cards appear — click **Synpuf 1K**.
3. Click the **Generate** button → progress spinner appears.
4. After a few seconds the status changes to ✅ **Complete**.

**Callout:** _Generation writes results to the CDM `cohort` table. You can generate the same definition against multiple data sources to compare counts across databases._

---

### 6:00 – 7:15 · Reviewing Generation Results

**Narration:**

> Once generation completes, Parthenon displays a summary card. You'll see the total number of persons who entered the cohort and the total number of records. Click **View Reports** to drill into a quick breakdown — an age-at-entry histogram, a gender distribution chart, and a cohort-entry-over-time trend line. These give you an immediate sanity check. If the numbers look wildly off, revisit your concept set or inclusion criteria before running any downstream analysis.

**Screen action:**

1. Summary card shows: Persons = 124, Records = 124.
2. Click **View Reports**.
3. Age histogram renders — *(highlight the median bucket)*.
4. Gender pie chart renders.
5. Entry-date time-series renders.

**Callout:** _If records > persons, it means some patients re-entered the cohort in a separate era. Check your "end strategy" settings if this is unexpected — more on that in V3._

---

### 7:15 – 8:00 · Recap & Next Steps

**Narration:**

> That's it — you've just created your first cohort in Parthenon. Let's recap what we covered: logging in, navigating the home screen, creating a cohort definition, adding a concept-set-driven inclusion criterion, generating against a data source, and reviewing the results. From here you can dive deeper into concept sets in V2, explore advanced cohort criteria in V3, or jump straight into data quality checks with V5. Thanks for watching — see you in the next tutorial.

**Screen action:** Recap bullet list animates on screen beside a view of the completed cohort. End card with links to V2, V3, V5.

**Callout:** _Bookmark the Quick Start section in the Parthenon documentation for a text version of everything we covered today._

---

## Production Notes

- **Demo data source:** Use Synpuf 1K or an equivalent synthetic CDM so no PHI is shown.
- **Screen resolution:** Record at 1920 × 1080; UI zoom set to 100%.
- **Mouse highlight:** Use a yellow-circle cursor highlight for all click actions.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
