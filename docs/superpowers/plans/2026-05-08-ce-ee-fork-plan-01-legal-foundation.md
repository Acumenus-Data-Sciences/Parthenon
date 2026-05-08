# CE/EE Fork — Plan 01: Legal Foundation, Org Transfer, AGPLv3 Relicense

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Parthenon repo into the state where Phase 2 (CE extension points) can begin: legal foundation drafted (CLA, EULA placeholder, NOTICE, LICENSING.md, TRADEMARKS.md), repo moved from `github.com/sudoshi/Parthenon` to `github.com/Acumenus-Data-Sciences/Parthenon`, and the public LICENSE flipped from Apache-2.0 to AGPL-3.0-only with all package manifests aligned.

**Architecture:** Phases 0 + 0.5 + 1 of the parent spec. Most tasks produce file artifacts (license/policy text, package manifest edits). A few tasks are GitHub admin runbooks for actions only the repo owner (Sanjay) can perform. The plan is executable in linear order; tasks marked **USER ACTION** require Sanjay's GitHub account access and cannot be delegated to Claude.

**Tech Stack:** Markdown, GitHub Settings, GitHub Actions, CLA Assistant (cla-assistant.io), composer (PHP), npm (Node), tomllib (Python), Docker (`docker compose exec` for build smoke tests).

**Spec reference:** [docs/superpowers/specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md](../specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md) — Phases 0, 0.5, 1.

**Existing handoff to leverage:** [docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md](../../handoffs/Apache2.0_to_AGPLv3_Conversion.md) — Workstream A audit findings + recipe.

---

## Pre-flight

Before starting any task:

1. Confirm working directory is `/home/smudoshi/Github/Parthenon` and current branch is `main` and clean.
2. Confirm `gh` CLI is authenticated as `sudoshi` (`gh auth status`).
3. Confirm Docker is running (`docker compose ps`).
4. Confirm pre-commit hooks are active (`git config core.hooksPath` should print `scripts/githooks`).

---

## File structure

**New files created during this plan:**

| Path | Owner | Purpose |
|---|---|---|
| `LICENSE` (replaces existing Apache-2.0) | CE | AGPL-3.0 verbatim from gnu.org |
| `NOTICE` | CE | Heritage attribution (OHDSI Atlas, OMOP, Achilles, Circe, DQD, HADES) |
| `LICENSING.md` | CE | Current license + dual-licensing offer + commercial contact + trademark pointer |
| `TRADEMARKS.md` | CE | Standalone trademark policy |
| `.github/workflows/license-guard.yml` | CE | CI guard asserting LICENSE/manifest license metadata stays AGPLv3 |
| `docs/superpowers/plans/2026-05-08-ce-ee-fork-plan-01-legal-foundation.md` | meta | this plan (already exists by the time you read it) |

**Files modified during this plan:**

| Path | What changes |
|---|---|
| `README.md` | Badge Apache-2.0 → AGPLv3; add Enterprise Edition pointer; license footer |
| `CONTRIBUTING.md` | License paragraph rewritten for AGPLv3 + dual-licensing CLA |
| `backend/composer.json` | `name`, `description`, `keywords`, `license` |
| `frontend/package.json` | Add `license`, `repository`, `author` fields |
| `ai/pyproject.toml` | Add `license`, `authors` fields |
| `templates/pyproject.toml` | `license = { text = "Apache-2.0" }` → `{ text = "AGPL-3.0-only" }` |
| `docker-compose.community.yml` | `ghcr.io/sudoshi/parthenon-*` → `ghcr.io/acumenus-data-sciences/parthenon-*` (after org transfer) |
| All CI workflows under `.github/workflows/` | `sudoshi/Parthenon` → `Acumenus-Data-Sciences/Parthenon` references (after org transfer) |
| `ROADMAP.md` | Mention Enterprise Edition status |

**Files deleted during this plan:**

| Path | Reason |
|---|---|
| `package-lock.json` (root, 88 bytes) | Stale empty stub — never restored |

**External artifacts created (not in repo):**

- `Parthenon-EE` placeholder commercial EULA stored at `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md` (not committed; for counsel review).
- CLA Assistant configuration at https://cla-assistant.io for `Acumenus-Data-Sciences/Parthenon`.
- GitHub teams `@Acumenus-Data-Sciences/maintainers`, `@Acumenus-Data-Sciences/employees`, `@Acumenus-Data-Sciences/ee-team` on `github.com/Acumenus-Data-Sciences`.

---

## Task 1: Draft NOTICE, LICENSING.md, TRADEMARKS.md, and EULA placeholder

**Why first:** All later tasks reference these files. Having them ready means the AGPLv3 PR (Task 8) can be a single coherent commit.

**Files:**
- Create: `/tmp/parthenon-legal/NOTICE` (staging, copied into repo at Task 8)
- Create: `/tmp/parthenon-legal/LICENSING.md`
- Create: `/tmp/parthenon-legal/TRADEMARKS.md`
- Create: `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md` (off-repo; for counsel)

- [ ] **Step 1.1: Create staging directory**

```bash
mkdir -p /tmp/parthenon-legal ~/Documents/acumenus-legal
```

- [ ] **Step 1.2: Write `NOTICE`**

File: `/tmp/parthenon-legal/NOTICE`

```
Parthenon
Copyright (c) 2024-2026 Acumenus Data Sciences, Inc.

This product is licensed under the GNU Affero General Public License,
Version 3.0 only (AGPL-3.0-only). See the LICENSE file for the full
license text. A commercial license is available — see LICENSING.md.

================================================================================
Project history and heritage attribution
================================================================================

Parthenon was originally inspired by, and incorporated source code from, the
OHDSI Atlas project (https://github.com/OHDSI/Atlas), which was licensed under
the Apache License, Version 2.0. The legacy Atlas integration (the `js/`
subtree containing Knockout.js code, OMOP CDM viewers, and Circe expression
helpers) has been removed from the current Parthenon source tree.

Heritage contributors to the now-removed legacy Atlas code include (alphabetical):
  - anton-abushkevich
  - Anthony Sena (J&J)
  - Alex Saltykov (Odysseus)
  - Chris Knoll (OHDSI / J&J)
  - Frank DeFalco (OHDSI)
  - Pavel Grafkin
  - Sigfried Gold
  - Vitaly Koulakov
  - Vlad Belousov
  - and ~15 additional contributors from Odysseus, FirstLine, J&J, NYP

Their contributions to the legacy `js/` subtree were under Apache 2.0. None of
that source code is redistributed in the current Parthenon tree.

================================================================================
Standards and specifications acknowledgments
================================================================================

Parthenon implements (but does not redistribute the source of) the following
OHDSI specifications and reference implementations, all originally distributed
under Apache 2.0:

  - OMOP Common Data Model v5.4
  - Achilles characterization framework
  - Circe cohort expression specification
  - Data Quality Dashboard (DQD) checks
  - HADES (Health Analytics Data-to-Evidence Suite) — CohortMethod,
    PatientLevelPrediction, FeatureExtraction, Cyclops, etc.

Parthenon's own implementations of these specifications are original work by
Acumenus Data Sciences, Inc. and are licensed under AGPL-3.0-only.

================================================================================
Third-party dependencies
================================================================================

Parthenon depends on numerous third-party libraries. See the following
manifests for the complete dependency tree and per-package licenses:

  - PHP: backend/composer.lock
  - JavaScript/TypeScript: frontend/package-lock.json
  - Python (AI service): ai/requirements.txt
  - Python (templates runtime): templates/pyproject.toml
  - R: r-runtime/renv.lock

================================================================================
Submodules
================================================================================

Parthenon includes git submodules pointing at separate repositories. Their
licenses are governed by their respective repositories and are NOT changed by
the Parthenon LICENSE:

  - OHDSI-scraper (github.com/sudoshi/OHDSI-scraper)
  - study-agent (github.com/sudoshi/StudyAgent)

================================================================================
Trademarks
================================================================================

"Parthenon", "Acumenus", and "Wellstack.ai" are trademarks of Acumenus Data
Sciences, Inc. The AGPL-3.0-only license does not grant trademark rights. See
TRADEMARKS.md for the trademark policy.

================================================================================
Contact
================================================================================

  General:        hello@acumenus.net
  Commercial:     licensing@acumenus.net
  Security:       security@acumenus.net
```

- [ ] **Step 1.3: Write `LICENSING.md`**

File: `/tmp/parthenon-legal/LICENSING.md`

```markdown
# Licensing

Parthenon is dual-licensed: a free, open-source **Community Edition** under
AGPL-3.0-only, and a paid, closed-source **Enterprise Edition** under a
commercial license.

---

## Community Edition (this repository)

Parthenon Community Edition is licensed under the **GNU Affero General Public
License, version 3.0 only (AGPL-3.0-only)**. The full license text is in
[LICENSE](LICENSE).

### What that means in practice

- You may use, modify, and distribute Parthenon CE under AGPLv3 terms.
- If you modify Parthenon CE and **make it accessible to users over a network**
  (a SaaS deployment, a multi-tenant hospital portal, etc.), AGPLv3 §13
  requires you to make your modified source available to those users.
- Internal use within a single organization (e.g., a research lab running
  Parthenon on its own infrastructure for its own users) does **not** trigger
  §13 if you have not modified the source.
- Linking Parthenon CE source into a closed-source application creates a
  derivative work that must also be AGPL-licensed unless you have a separate
  commercial license from Acumenus.

If you are unsure whether your intended use triggers AGPLv3 obligations,
contact `licensing@acumenus.net` — we are happy to clarify.

---

## Enterprise Edition (separate, private repository)

Parthenon Enterprise Edition adds enterprise-grade features (Keycloak SSO with
SAML/SCIM, multi-tenancy, FIPS 140-2 crypto, signed audit log retention,
Datadog/Splunk observability shippers, Kubernetes operator, n8n / Apache
Superset / DataHub / Wazuh integrations, premium support) and is distributed
under a **commercial license**. Source code is not publicly available.

To inquire about Enterprise Edition, contact `licensing@acumenus.net`.

---

## Why dual-licensing

Parthenon Community Edition serves clinical researchers, data engineers, and
healthcare organizations running OHDSI-style outcomes research. Keeping the
full research platform free and open under AGPLv3 protects the open research
mission.

Parthenon Enterprise Edition serves large hospital systems, pharma sponsors,
and government agencies that need additional infrastructure, compliance, and
support guarantees. Revenue from Enterprise Edition funds Community Edition
development and Acumenus's nonprofit research mission.

---

## Project IP history

Parthenon was originally inspired by the OHDSI Atlas project (Apache-2.0).
The legacy Atlas `js/` subtree was removed from the current Parthenon source
tree. The current source is overwhelmingly the original work of Acumenus Data
Sciences, Inc. See [NOTICE](NOTICE) for the full heritage attribution.

The relicense from Apache-2.0 to AGPL-3.0-only on **2026-05-XX** (record exact
date in the relicense PR) was performed after an audit confirmed no surviving
substantial heritage contributions in the current tree.

---

## Contributing

By contributing to Parthenon Community Edition, you agree that your
contribution will be:

1. Distributed under AGPL-3.0-only as part of the Community Edition.
2. Re-licensable by Acumenus Data Sciences, Inc. under any other terms,
   including commercial licenses for the Enterprise Edition.
3. Accompanied by a patent grant equivalent to Apache-2.0 §3.

These terms are administered by **CLA Assistant** at https://cla-assistant.io,
which automatically requests your agreement on your first pull request. See
[CONTRIBUTING.md](CONTRIBUTING.md) for full details.

---

## Trademarks

"Parthenon", "Acumenus", and "Wellstack.ai" are trademarks of Acumenus Data
Sciences, Inc. The AGPL-3.0-only license **does not grant trademark rights**.
See [TRADEMARKS.md](TRADEMARKS.md) for the trademark policy and nominative
fair use boundaries.

---

## Commercial licensing contact

  Email:    licensing@acumenus.net
  Subject:  Parthenon Enterprise inquiry — <your organization name>
  Include:  intended use case, deployment scale, regulatory context

We respond within 5 business days.
```

- [ ] **Step 1.4: Write `TRADEMARKS.md`**

File: `/tmp/parthenon-legal/TRADEMARKS.md`

```markdown
# Trademarks

"Parthenon", "Acumenus", "Acumenus Data Sciences", and "Wellstack.ai" are
trademarks of Acumenus Data Sciences, Inc. ("Acumenus"). This document
describes the trademark policy and the limits of permitted use.

---

## What the AGPL-3.0-only license does NOT grant

The AGPLv3 license under which Parthenon Community Edition is distributed
covers **copyright** in the source code. It does **not** grant trademark
rights. Specifically, the license does not give you permission to:

- Use the name "Parthenon" or the Parthenon logo to label a fork, derivative,
  or modified version of Parthenon as if it were endorsed by Acumenus.
- Use the names "Acumenus", "Acumenus Data Sciences", or "Wellstack.ai" to
  imply affiliation, sponsorship, or endorsement.
- Register a domain name, social media handle, npm/composer package name, or
  any other identifier that could be confused with Acumenus's marks.
- Use the Parthenon logo or wordmark in promotional materials for a
  commercial product or service that is not officially partnered with or
  licensed by Acumenus.

---

## Permitted nominative fair use

You **may** use the trademark "Parthenon" in the following nominative-fair-use
contexts without prior permission:

- Stating that your software, plugin, or service is "compatible with
  Parthenon" or "built on Parthenon", provided this statement is truthful.
- Referring to Parthenon by name in technical documentation, blog posts,
  academic papers, or social media commentary.
- Identifying yourself as a "Parthenon contributor" if you have had a
  contribution merged to the public `Acumenus-Data-Sciences/Parthenon` repository.
- Operating a personal or community-run fork of Parthenon for internal
  research use, provided the fork is not represented as the official version.

If you operate a public fork, please:
- Choose a distinct name (do not call your fork "Parthenon").
- Make clear in your README that the fork is unofficial and not endorsed by
  Acumenus.
- Remove or replace the Parthenon logo from your fork's branding.

---

## Use in commercial products and services

Any use of Acumenus trademarks in connection with a commercial product or
service requires written permission from Acumenus. Contact
`licensing@acumenus.net` to discuss.

This includes (non-exhaustive):

- Selling or offering paid support, hosting, training, or consulting branded
  as "Parthenon".
- Distributing a commercial fork of Parthenon under a name that incorporates
  "Parthenon" or "Acumenus".
- Using Acumenus marks in advertising for a competing product.

---

## Reporting misuse

If you encounter a use of Acumenus trademarks that appears to violate this
policy, please report it to `legal@acumenus.net`.

---

## Updates

This policy may be updated as Parthenon's commercial program evolves. The
canonical version is the one in the public `Acumenus-Data-Sciences/Parthenon` repository on
the `main` branch.

---

*Last updated: 2026-05-08*
```

- [ ] **Step 1.5: Write `LICENSE-EE` placeholder draft (off-repo, for counsel)**

File: `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md`

This is a **placeholder for counsel review**. It is NOT legally executable. Counsel should redraft on standard commercial software EULA structure.

```markdown
# Parthenon Enterprise Edition — Commercial License Agreement

**STATUS: DRAFT — NOT LEGALLY EXECUTABLE. PENDING COUNSEL REVIEW.**

This is a placeholder document. The final commercial EULA must be drafted or
reviewed by qualified legal counsel before being attached to any sale or
distribution of Parthenon Enterprise Edition.

---

## 1. Parties

This Agreement ("Agreement") is between Acumenus Data Sciences, Inc., a
Pennsylvania nonprofit corporation ("Acumenus"), and the Customer identified
in the accompanying Order Form ("Customer"). Acumenus and Customer are each
a "Party" and together the "Parties".

## 2. Definitions

- **"Software"** means the Parthenon Enterprise Edition software, including
  source code (where provided), object code, container images, Helm charts,
  Kubernetes manifests, configuration templates, documentation, and updates
  delivered to Customer under this Agreement.
- **"Subscription Term"** means the period stated in the Order Form during
  which Customer's license to use the Software is in effect.
- **"Authorized Users"** means employees, contractors, and agents of
  Customer who access the Software for Customer's internal business
  purposes within the limits stated in the Order Form.
- **"Documentation"** means the Parthenon Enterprise Edition documentation
  provided to Customer.

## 3. License Grant

Subject to Customer's payment of fees and compliance with this Agreement,
Acumenus grants Customer a non-exclusive, non-transferable, non-sublicensable
license during the Subscription Term to:

  (a) install, configure, and operate the Software within Customer's
      infrastructure for Customer's internal business purposes;
  (b) make a reasonable number of copies of the Software for backup and
      disaster recovery purposes; and
  (c) permit Authorized Users to use the Software within the seat or
      capacity limits stated in the Order Form.

## 4. Restrictions

Customer shall not, and shall not permit any third party to:

  (a) modify, reverse engineer, decompile, or disassemble the Software,
      except to the limited extent permitted by applicable law;
  (b) sublicense, sell, rent, lease, or otherwise distribute the Software
      to any third party;
  (c) use the Software to provide services to third parties (e.g., as a
      software-as-a-service offering or hosted multi-tenant platform)
      unless explicitly authorized in the Order Form;
  (d) remove or alter any proprietary notices on the Software;
  (e) use the Software to develop, train, or improve a product that
      competes with Parthenon Enterprise Edition;
  (f) use the Software in violation of applicable law, including but not
      limited to HIPAA, GDPR, or other healthcare and privacy regulations.

## 5. Acumenus Obligations

Acumenus will:

  (a) deliver the Software in accordance with the Order Form;
  (b) provide updates and security patches during the Subscription Term;
  (c) provide support at the level stated in the Order Form (e.g.,
      Standard, Premium, Mission Critical);
  (d) maintain commercially reasonable security practices for any Customer
      data Acumenus receives in connection with support.

## 6. Fees and Payment

Fees are stated in the Order Form. Customer shall pay all fees in U.S.
dollars within thirty (30) days of invoice date. Late payments accrue
interest at 1.5% per month or the maximum rate permitted by law, whichever
is less.

## 7. Confidentiality

Each Party may receive Confidential Information of the other. Each Party
shall protect the other's Confidential Information with the same degree of
care it uses for its own confidential information of similar importance,
and not less than a reasonable degree of care. The Software, including its
source code where delivered, is Acumenus's Confidential Information.

## 8. Intellectual Property

The Software is licensed, not sold. Acumenus retains all right, title, and
interest in the Software, including all intellectual property rights.

## 9. Warranty and Disclaimer

Acumenus warrants that the Software will materially conform to the
Documentation during the Subscription Term. EXCEPT FOR THE EXPRESS WARRANTY
IN THE PRECEDING SENTENCE, THE SOFTWARE IS PROVIDED "AS IS" AND ACUMENUS
DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT.

## 10. Limitation of Liability

EXCEPT FOR EITHER PARTY'S BREACH OF SECTION 4 (RESTRICTIONS), SECTION 7
(CONFIDENTIALITY), OR INDEMNIFICATION OBLIGATIONS, NEITHER PARTY SHALL BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT. EACH PARTY'S TOTAL
AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE FEES PAID BY
CUSTOMER UNDER THE APPLICABLE ORDER FORM IN THE TWELVE (12) MONTHS
PRECEDING THE CLAIM.

## 11. Indemnification

Acumenus will defend and indemnify Customer against third-party claims
that the Software, used in accordance with this Agreement, infringes a
U.S. patent, copyright, or trademark, subject to standard exclusions and
remedies (modification, replacement, or refund).

## 12. Term and Termination

This Agreement remains in effect for the Subscription Term stated in the
Order Form and renews per the Order Form's terms. Either Party may
terminate this Agreement upon material breach by the other Party that
remains uncured thirty (30) days after written notice. Upon termination,
Customer shall stop using the Software and destroy all copies in its
possession.

## 13. Governing Law and Venue

This Agreement is governed by the laws of the Commonwealth of
Pennsylvania, without regard to conflict-of-laws principles. The Parties
consent to the exclusive jurisdiction of the state and federal courts
located in [County to be specified by counsel], Pennsylvania, for any
dispute arising out of or related to this Agreement.

## 14. General

This Agreement is the entire agreement between the Parties and supersedes
all prior agreements regarding its subject matter. Amendments must be in
writing and signed by both Parties. If any provision is unenforceable,
the remainder shall remain in effect.

---

**[Acumenus Data Sciences, Inc.]**
By: __________________________
Name: ________________________
Title: _______________________
Date: ________________________

**[Customer]**
By: __________________________
Name: ________________________
Title: _______________________
Date: ________________________
```

- [ ] **Step 1.6: Verify drafts are non-empty and contain expected sections**

```bash
test -s /tmp/parthenon-legal/NOTICE && \
test -s /tmp/parthenon-legal/LICENSING.md && \
test -s /tmp/parthenon-legal/TRADEMARKS.md && \
test -s ~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md && \
echo "OK: all 4 drafts exist"

grep -q "GNU Affero" /tmp/parthenon-legal/LICENSING.md && echo "OK: LICENSING.md mentions AGPL"
grep -q "OHDSI Atlas" /tmp/parthenon-legal/NOTICE && echo "OK: NOTICE mentions Atlas heritage"
grep -q "nominative" /tmp/parthenon-legal/TRADEMARKS.md && echo "OK: TRADEMARKS.md covers nominative use"
grep -q "DRAFT" ~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md && echo "OK: EULA marked DRAFT"
```

Expected: all 4 OK lines printed.

- [ ] **Step 1.7: Send EULA draft to counsel**

**USER ACTION (Sanjay):** Email the EULA draft to your retained counsel. Suggested template:

```
To: <counsel@firm>
Subject: Parthenon Enterprise Commercial EULA — draft for your review

I'm preparing to fork Parthenon (github.com/Acumenus-Data-Sciences/Parthenon, currently
under Apache 2.0 transitioning to AGPL-3.0-only) into a paid Enterprise
Edition under a commercial license. Attached is a placeholder EULA draft
that I generated as a starting point — it is not legally binding and is
explicitly marked DRAFT.

Please redraft on your standard commercial software EULA template,
incorporating the structure of the attached as a starting reference.
Specific items I'd like your view on:

1. Whether AGPL-3.0-only for the Community Edition creates any §13 issues
   for a customer who deploys EE on a network-accessible service.
2. Whether the standard CLA wording I'm planning (AGPL distribution +
   re-license + patent grant equivalent to Apache 2.0 §3) is sufficient
   for dual-licensing rights.
3. Recommended Pennsylvania venue / governing law clause for our state of
   incorporation.
4. Trademark policy — separate document or bundled into EULA?

Timeline: I'd like to have a finalizable EULA within 4 weeks so we can
launch the EE program in Q3 2026.

Sanjay
```

**Verification:** Email sent (you have the sent record). Counsel acknowledged receipt.

- [ ] **Step 1.8: Commit nothing yet**

These drafts stay in `/tmp/` and `~/Documents/` until Task 8 copies the public ones into the repo. No git commit yet.

---

## Task 2: Configure CLA Assistant

**Why now:** Must be live before any external PR merges to `Acumenus-Data-Sciences/Parthenon` post-AGPLv3-flip, so contributors agree to dual-licensing terms.

**Files:** No file changes; this is a configuration on https://cla-assistant.io.

- [ ] **Step 2.1: USER ACTION — Sign in to CLA Assistant**

Visit https://cla-assistant.io and sign in with your `sudoshi` GitHub account.

- [ ] **Step 2.2: USER ACTION — Configure CLA for `sudoshi/Parthenon` (pre-transfer)**

Even though the repo will move to `Acumenus-Data-Sciences/` later, configure CLA Assistant now against the current `sudoshi/Parthenon` URL so we can test it before transfer. After Task 4 (transfer), re-link to `Acumenus-Data-Sciences/Parthenon`.

CLA text to paste into CLA Assistant (the standard CLA wording for our project):

```
Parthenon Contributor License Agreement (v1, 2026-05-08)

Thank you for your contribution to Parthenon, an open-source healthcare
informatics platform maintained by Acumenus Data Sciences, Inc.
("Acumenus").

By submitting a contribution to a Parthenon repository (the "Contribution"),
You ("Contributor") agree to the following terms:

1. License Grant. Contributor grants Acumenus and to recipients of
   software distributed by Acumenus a perpetual, worldwide, non-exclusive,
   no-charge, royalty-free, irrevocable copyright license to reproduce,
   prepare derivative works of, publicly display, publicly perform,
   sublicense, and distribute the Contribution and such derivative works.

2. AGPL-3.0-only Distribution. Contributor agrees that the Contribution
   will be licensed under the GNU Affero General Public License, version
   3.0 only, when distributed as part of the Parthenon Community Edition.

3. Re-licensing for Commercial Use. Contributor grants Acumenus the
   right to re-license the Contribution under any other terms, including
   proprietary commercial licenses, when distributed as part of the
   Parthenon Enterprise Edition or other commercial offerings of
   Acumenus. This grant is necessary to support Acumenus's dual-licensing
   model and the Enterprise Edition program.

4. Patent Grant. Contributor grants Acumenus and to recipients of
   software distributed by Acumenus a perpetual, worldwide, non-exclusive,
   no-charge, royalty-free, irrevocable (except as stated in this
   section) patent license to make, have made, use, offer to sell,
   sell, import, and otherwise transfer the Contribution, where such
   license applies only to those patent claims licensable by Contributor
   that are necessarily infringed by the Contribution alone or by
   combination of the Contribution with the Parthenon project. If any
   entity institutes patent litigation against Contributor or any other
   entity (including a cross-claim or counterclaim in a lawsuit) alleging
   that the Contribution, or the Parthenon project to which Contributor
   has contributed, constitutes direct or contributory patent
   infringement, then any patent licenses granted to that entity under
   this Agreement shall terminate as of the date such litigation is filed.

5. Original Work / Authorization. Contributor represents that each
   Contribution is either Contributor's original creation, or
   Contributor has the right to submit the Contribution under the terms
   of this Agreement. If Contributor's employer has rights to
   intellectual property that Contributor creates that includes
   Contributions, Contributor represents that Contributor has received
   permission to make Contributions on behalf of that employer, that
   the employer has waived such rights for the Contributions, or that
   the employer has executed a separate Corporate CLA with Acumenus.

6. No Warranty. The Contribution is provided "AS IS", without warranty
   of any kind. Acumenus is not obligated to use the Contribution.

By submitting a pull request to a Parthenon repository, Contributor
indicates agreement to the above terms.
```

In CLA Assistant settings:
- Apply to: `sudoshi/Parthenon` (will re-link to `Acumenus-Data-Sciences/Parthenon` after transfer)
- Allow list: empty initially (no bypasses)
- Require CLA on: all PRs from non-employee contributors

- [ ] **Step 2.3: USER ACTION — Test CLA flow on a no-op PR**

Open a trivial test PR (e.g., add a blank line to README) from a personal account that is NOT an Acumenus org member. Verify CLA Assistant comments asking the author to sign. Sign. Verify comment turns into "All contributors have signed the CLA."

Then close the test PR without merging.

**Verification:** CLA Assistant successfully gates and clears a test PR.

- [ ] **Step 2.4: USER ACTION — Configure bot CLA bypass**

For automated bots (Sentinel, Bolt, Palette, Jules, Dependabot), bot identities cannot personally sign a CLA. Two options:

(a) **Recommended:** Create a CLA Assistant allow-list entry with each bot's GitHub user ID (e.g., `dependabot[bot]`). The bypass is documented in `CONTRIBUTING.md` under "Bots".

(b) Create an Acumenus account (`@acumenus-data-sciences-bot`) and have it sign the CLA on behalf of all Acumenus-Data-Sciences-operated bots. Bot PRs are filed as `@acumenus-data-sciences-bot` not the individual bot identity.

Pick (a) for now (lower friction) and document in CONTRIBUTING.md update at Task 8.

**Verification:** CLA Assistant settings show the bot allow-list entries.

---

## Task 3: Notify private fork users

**Why before merge:** Per spec §2 risk row "Federated learning / Hive Networks pilots running on Apache 2.0 receive a license-change surprise" — get written ack before changing the license they cloned under.

**Files:** No file changes. Email artifacts only.

- [ ] **Step 3.1: USER ACTION — Identify private fork users**

Compile a list of organizations that have cloned `sudoshi/Parthenon` for an internal deployment with Acumenus's knowledge. Known instances per project memory:
- Geisinger Health System (research pilot)
- Hive Networks pilots (federated learning early access)
- Any others on your customer list

Record the list in `~/Documents/acumenus-legal/fork-users-2026-05-08.txt` (off-repo).

- [ ] **Step 3.2: USER ACTION — Send notification email**

Template:

```
Subject: Parthenon license change notification — Apache 2.0 → AGPL-3.0-only

Hi [Name],

A heads-up that we're changing Parthenon's open-source license from
Apache 2.0 to AGPL-3.0-only in approximately 1-2 weeks. We're also
moving the canonical repository from github.com/sudoshi/Parthenon to
github.com/Acumenus-Data-Sciences/Parthenon.

What this means for you:

1. Code you have already received under Apache 2.0 stays under Apache 2.0.
   The license change is forward-only — no retroactive obligation.

2. After the change, new versions you pull from the public repo will be
   under AGPLv3. AGPLv3 imposes one new obligation relevant to you: if
   you modify Parthenon and make the modified version accessible to
   users over a network (a SaaS or multi-user portal), AGPLv3 §13
   requires you to make your modifications available to those users.
   Pure internal deployments are unaffected.

3. We are also launching a paid Enterprise Edition (closed source,
   commercial license) which adds enterprise infrastructure: Keycloak
   SSO with SAML/SCIM, multi-tenancy, FIPS crypto, signed audit log
   retention, observability shippers, Kubernetes operator, and premium
   support. Happy to discuss if it would suit your use case.

4. If AGPLv3 §13 obligations are a concern for your organization, we
   can offer a commercial license that exempts you from §13. Contact
   licensing@acumenus.net.

Could you reply with a brief acknowledgment that you've received this
notice? No further action required from you unless you have concerns.

Thanks,
Sanjay
```

Send to each fork user.

- [ ] **Step 3.3: USER ACTION — Track acks**

Maintain a tracking entry in `~/Documents/acumenus-legal/fork-users-2026-05-08.txt`:

```
Geisinger    sent: 2026-05-08    acked: <date>    contact: <name>
Hive Networks sent: 2026-05-08    acked: <date>    contact: <name>
...
```

Do not proceed to Task 8 (AGPLv3 PR merge) until all expected acks received OR you have decided to proceed regardless. Document the decision either way.

**Verification:** Tracking file lists every fork user with sent date; acks recorded as they arrive.

---

## Task 4: Org transfer — `sudoshi/Parthenon` → `Acumenus-Data-Sciences/Parthenon`

**Why before AGPLv3 PR:** All license metadata, badge URLs, container image references, and CLA Assistant configuration generate against the canonical repo URL. Doing the transfer first means we make these changes once, in their final form.

**Files:** No file edits in this task. The post-transfer cleanup PR happens in Task 5.

- [ ] **Step 4.1: Audit current `sudoshi/Parthenon` references**

Run from repo root:

```bash
cd /home/smudoshi/Github/Parthenon
grep -rn 'sudoshi/Parthenon\|ghcr\.io/sudoshi' \
  --include='*.md' --include='*.yml' --include='*.yaml' \
  --include='*.json' --include='*.toml' --include='*.sh' \
  --include='*.py' --include='*.php' --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=vendor \
  --exclude-dir=graphify-out --exclude-dir=.git \
  > /tmp/sudoshi-refs-pre-transfer.txt
wc -l /tmp/sudoshi-refs-pre-transfer.txt
head -30 /tmp/sudoshi-refs-pre-transfer.txt
```

Expected: 50-150 hits in active source files. Save the file — Task 5 uses it.

- [ ] **Step 4.2: USER ACTION — Decide org-level structure**

On `github.com/Acumenus-Data-Sciences`, plan the following before transferring:

**Teams to create:**
- `@Acumenus-Data-Sciences/maintainers` — repo admins (Sanjay + 1 backup)
- `@Acumenus-Data-Sciences/employees` — write access to CE + EE
- `@Acumenus-Data-Sciences/ee-team` — write access to EE only (subset of employees)
- `@Acumenus-Data-Sciences/contributors` — public-facing community team (advisory; no write access by default)

**Org-level Actions secrets to migrate:**
- `RESEND_KEY` (currently per-repo; move to org)
- `GHCR_PUSH_TOKEN` (new — for pushing to `ghcr.io/acumenus-data-sciences`)
- Cosign signing key (new — for EE artifact signing)
- Codecov token (re-issue at org level)

**Org-level branch protection ruleset (apply to `Acumenus-Data-Sciences/Parthenon` after transfer):**
- Require PR review
- Require CI to pass: `pint`, `phpstan`, `tsc`, `eslint`, `vitest`, `pest`, `pytest`
- Require signed commits
- Require linear history
- Restrict force-pushes to main
- Require resolution of all review threads

Document these decisions in `~/Documents/acumenus-legal/org-transfer-plan-2026-05-08.txt`.

- [ ] **Step 4.3: USER ACTION — Pre-transfer dry-run on a dummy repo**

Create a tiny test repo under `sudoshi/parthenon-transfer-test`, transfer it to `Acumenus-Data-Sciences/parthenon-transfer-test`, verify everything works, then delete the test repo. This catches any account-level issues before touching the real one.

```bash
# create
gh repo create sudoshi/parthenon-transfer-test --public --description "transfer test, DELETE ME"
echo "test" | gh repo create sudoshi/parthenon-transfer-test --public --confirm  # if needed

# transfer (via UI: Settings → Danger Zone → Transfer ownership)
# then verify
gh repo view Acumenus-Data-Sciences/parthenon-transfer-test

# delete
gh repo delete Acumenus-Data-Sciences/parthenon-transfer-test --yes
```

**Verification:** Dummy transfer succeeded and was deleted cleanly.

- [ ] **Step 4.4: USER ACTION — Schedule the real transfer**

Pick a low-traffic window (weekend morning ET works well). Notify any active contributors 24 hours ahead via the public README or a pinned issue.

- [ ] **Step 4.5: USER ACTION — Execute the transfer**

On https://github.com/sudoshi/Parthenon/settings:

1. Scroll to **Danger Zone** → **Transfer ownership**.
2. Type repo name to confirm: `Parthenon`.
3. Enter new owner: `Acumenus-Data-Sciences`.
4. Confirm.

GitHub preserves: PRs, issues, stars, watchers, releases, branches, tags, commits, contributors, security advisories.
GitHub redirects from old URL: yes (HTTP 301 for ~the next year).

- [ ] **Step 4.6: Verify the transfer**

```bash
gh repo view Acumenus-Data-Sciences/Parthenon | head -10
gh repo view sudoshi/Parthenon 2>&1 | grep -i 'redirect\|moved\|not found'
```

Expected: First command shows the repo at Acumenus-Data-Sciences; second confirms redirect.

- [ ] **Step 4.7: USER ACTION — Update local clone remote**

```bash
cd /home/smudoshi/Github/Parthenon
git remote set-url origin git@github.com:Acumenus-Data-Sciences/Parthenon.git
git remote -v   # verify
git fetch origin
```

Expected: Both `fetch` and `push` URLs point at `Acumenus-Data-Sciences/Parthenon`. Fetch succeeds.

- [ ] **Step 4.8: USER ACTION — Re-link integrations**

For each integration, re-authorize against `Acumenus-Data-Sciences/Parthenon`:

- [ ] CLA Assistant (https://cla-assistant.io) — re-link CLA to `Acumenus-Data-Sciences/Parthenon`. Test with another no-op PR.
- [ ] Codecov (if used)
- [ ] Sentinel/Bolt/Palette/Jules bots (re-install GitHub Apps on `Acumenus-Data-Sciences` org if scoped to org)
- [ ] Dependabot — config in `.github/dependabot.yml` continues to work via redirect, but for cleanliness, the next post-transfer PR (Task 5) refreshes it.
- [ ] GitHub Pages (if any custom domain) — redomain to `acumenus-data-sciences.github.io/Parthenon` if applicable
- [ ] Public webhook recipients (Slack, Discord, etc.)

Track each in `~/Documents/acumenus-legal/org-transfer-plan-2026-05-08.txt`.

- [ ] **Step 4.9: Smoke-test CI on a no-op PR after transfer**

Create a temporary branch with a no-op change (e.g., add a blank line to README), open a PR, watch CI run.

```bash
cd /home/smudoshi/Github/Parthenon
git checkout -b test/post-transfer-smoke
echo "" >> README.md
git commit -am "test: post-transfer smoke (will revert)"
git push -u origin test/post-transfer-smoke
gh pr create --title "test: post-transfer smoke" --body "Verifying CI runs after org transfer. Will be closed without merging." --draft
```

Watch CI pipeline run to completion. All jobs green.

```bash
# clean up
gh pr close <PR_NUM> --delete-branch
git checkout main
git pull
```

**Verification:** Full CI pipeline ran on the post-transfer PR and passed.

---

## Task 5: Post-transfer cleanup PR

**Why:** Bulk-rename `sudoshi/Parthenon` → `Acumenus-Data-Sciences/Parthenon` and `ghcr.io/sudoshi` → `ghcr.io/acumenus-data-sciences` in active source. This is independent of the AGPLv3 flip (which is Task 8) so each PR's diff stays focused and reviewable.

**Files:**
- Modify (varies based on Task 4.1 audit output): `README.md`, `docker-compose.community.yml`, `.github/workflows/*`, scripts that hard-code the org/repo, `frontend/package.json` `repository` field if present, etc.
- Test: Add a CI lint step asserting no `sudoshi/Parthenon` or `ghcr.io/sudoshi` references in active source.

- [ ] **Step 5.1: Create cleanup branch**

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main
git pull
git checkout -b chore/post-transfer-rename-acumenus-ds
```

- [ ] **Step 5.2: Bulk replace `sudoshi/Parthenon` → `Acumenus-Data-Sciences/Parthenon`**

Use the audit list from Task 4.1 as the worklist. For each file, do a careful edit (`sed -i` is OK for plain matches but verify each diff before staging).

```bash
# Bulk replace, scoped to relevant file types and excluding volatile dirs
find . -type f \
  \( -name '*.md' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.json' -o -name '*.toml' -o -name '*.sh' \
     -o -name '*.py' -o -name '*.php' -o -name '*.ts' -o -name '*.tsx' \) \
  -not -path './node_modules/*' \
  -not -path './backend/vendor/*' \
  -not -path './graphify-out/*' \
  -not -path './.git/*' \
  -not -path './ai/.venv/*' \
  -not -path './backups/*' \
  -exec sed -i 's|sudoshi/Parthenon|Acumenus-Data-Sciences/Parthenon|g' {} +

find . -type f \
  \( -name '*.md' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.json' -o -name '*.toml' -o -name '*.sh' \) \
  -not -path './node_modules/*' \
  -not -path './backend/vendor/*' \
  -not -path './graphify-out/*' \
  -not -path './.git/*' \
  -not -path './ai/.venv/*' \
  -not -path './backups/*' \
  -exec sed -i 's|ghcr\.io/sudoshi/parthenon|ghcr.io/acumenus-data-sciences/parthenon|g' {} +
```

- [ ] **Step 5.3: Review the diff**

```bash
git status
git diff --stat
git diff | head -200
```

Look for:
- Unintended changes in handoff docs (those should stay historical; revert if `sed` touched them).
- Submodule URL references — `OHDSI-scraper` and `study-agent` stay at `sudoshi/` URLs (they're separate repos, not transferred).
- Any Apache-2.0 LICENSE-related references — leave those for Task 8.

If `sed` touched historical handoffs in `docs/handoffs/`, revert them:

```bash
git checkout -- docs/handoffs/2026-03-28-project-vulcan-handoff.md
git checkout -- docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md
git checkout -- docs/handoffs/parthenon-acropolis-integration-prompt.md
# (audit each; revert any that should remain historical)
```

**Verification:** `git diff` shows only intended changes in active source.

- [ ] **Step 5.4: Verify submodules unchanged**

```bash
grep -E 'OHDSI-scraper|study-agent' .gitmodules
```

Expected: URLs still point at `sudoshi/` (these are separate repos).

- [ ] **Step 5.5: Verify no `sudoshi/Parthenon` references remain in active source**

```bash
grep -rn 'sudoshi/Parthenon\|ghcr\.io/sudoshi/parthenon' \
  --include='*.md' --include='*.yml' --include='*.yaml' \
  --include='*.json' --include='*.toml' --include='*.sh' \
  --include='*.py' --include='*.php' --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=vendor \
  --exclude-dir=graphify-out --exclude-dir=.git \
  --exclude-dir=.venv --exclude-dir=backups \
  | grep -v 'docs/handoffs/' \
  | grep -v 'docs/devlog/' \
  > /tmp/sudoshi-refs-post-rename.txt
wc -l /tmp/sudoshi-refs-post-rename.txt
```

Expected: 0 lines (or only references in archived devlog/handoff docs that are explicitly historical).

If any non-historical hits remain, edit them manually.

- [ ] **Step 5.6: Add CI lint guard**

File: `.github/workflows/license-guard.yml` (new — also extended in Task 9 for license metadata)

```yaml
name: License & Org Reference Guard

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  org-references:
    name: Verify no stale sudoshi/Parthenon references
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for stale org references
        run: |
          set -e
          STALE=$(grep -rn 'sudoshi/Parthenon\|ghcr\.io/sudoshi/parthenon' \
            --include='*.md' --include='*.yml' --include='*.yaml' \
            --include='*.json' --include='*.toml' --include='*.sh' \
            --include='*.py' --include='*.php' --include='*.ts' --include='*.tsx' \
            --exclude-dir=node_modules --exclude-dir=vendor \
            --exclude-dir=graphify-out --exclude-dir=.git \
            --exclude-dir=.venv --exclude-dir=backups \
            --exclude-dir='docs/handoffs' --exclude-dir='docs/devlog' \
            . || true)
          if [ -n "$STALE" ]; then
            echo "Found stale sudoshi/Parthenon references in active source:"
            echo "$STALE"
            echo ""
            echo "Update these to Acumenus-Data-Sciences/Parthenon. Historical references in"
            echo "docs/handoffs/ and docs/devlog/ are excluded automatically."
            exit 1
          fi
          echo "OK: no stale sudoshi/Parthenon references in active source."
```

- [ ] **Step 5.7: Run pre-commit hook locally**

```bash
git add -A
git status
git diff --cached --stat
```

The pre-commit hook (`scripts/githooks/pre-commit`) runs Pint, PHPStan, tsc, ESLint, Vitest, Python syntax. For this PR, mostly docs/yaml/json changes — should pass quickly.

- [ ] **Step 5.8: Commit and open PR**

```bash
git commit -m "chore: rename sudoshi/Parthenon → Acumenus-Data-Sciences/Parthenon after org transfer

Bulk-renames all active source references following the GitHub repo
transfer from github.com/sudoshi/Parthenon to github.com/Acumenus-Data-Sciences/Parthenon.
Container image namespace ghcr.io/sudoshi/parthenon-* → ghcr.io/acumenus-data-sciences/parthenon-*.

Submodules (OHDSI-scraper, study-agent) retain sudoshi/ URLs — they are
separate repos that have not been transferred.

Historical references in docs/handoffs/ and docs/devlog/ are intentionally
preserved as-of-date documents.

Adds a CI guard (license-guard.yml :: org-references) to prevent
regression."

git push -u origin chore/post-transfer-rename-acumenus-ds

gh pr create --title "chore: rename sudoshi/Parthenon → Acumenus-Data-Sciences/Parthenon" --body "$(cat <<'EOF'
## Summary

- Bulk-rename `sudoshi/Parthenon` → `Acumenus-Data-Sciences/Parthenon` in active source
- Bulk-rename `ghcr.io/sudoshi/parthenon-*` → `ghcr.io/acumenus-data-sciences/parthenon-*` in compose/CI
- Submodules retain `sudoshi/` URLs (separate repos)
- Historical references in `docs/handoffs/` and `docs/devlog/` preserved
- Adds CI guard to prevent regression

## Test plan

- [ ] CI pipeline green
- [ ] No remaining `sudoshi/Parthenon` references in active source (`grep` from license-guard.yml)
- [ ] Container image references resolved (`docker compose pull --dry-run` if applicable)
- [ ] Smoke-deploy on staging (`./deploy.sh --frontend` checks)
EOF
)"
```

- [ ] **Step 5.9: Wait for CI, address feedback, merge**

Watch the PR's CI. The new `license-guard.yml :: org-references` job should pass (we just made it pass).

```bash
gh pr view --json statusCheckRollup
```

When green and reviewed, squash-merge.

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
```

**Verification:** PR merged, CI green on main, `grep -rn 'sudoshi/Parthenon' --include='*.md'` returns only historical hits.

---

## Task 6: Pull AGPL-3.0 license text

**Why now:** Local file we'll use in Task 8.

**Files:**
- Create (staging): `/tmp/parthenon-legal/LICENSE-AGPLv3.txt`

- [ ] **Step 6.1: Download verbatim license text**

```bash
curl -fsSL https://www.gnu.org/licenses/agpl-3.0.txt \
  -o /tmp/parthenon-legal/LICENSE-AGPLv3.txt
head -3 /tmp/parthenon-legal/LICENSE-AGPLv3.txt
wc -l /tmp/parthenon-legal/LICENSE-AGPLv3.txt
```

Expected first three lines:
```
                    GNU AFFERO GENERAL PUBLIC LICENSE
                       Version 3, 19 November 2007

```

Expected line count: ~661 (may vary ±5 if FSF reformats).

- [ ] **Step 6.2: Verify checksum (optional, defensive)**

```bash
sha256sum /tmp/parthenon-legal/LICENSE-AGPLv3.txt
# As of 2026-05-08, the canonical FSF AGPL-3.0 text has SHA256:
# 0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0
# (verify against gnu.org if mismatch)
```

If the SHA mismatches the value above, fetch from a known mirror (e.g., the OSI archive at https://opensource.org/licenses/AGPL-3.0) and compare.

**Verification:** First three lines start with "GNU AFFERO GENERAL PUBLIC LICENSE", line count ~661, file is non-empty.

---

## Task 7: Add license-metadata CI guard

**Why before the AGPLv3 PR:** The guard test is what proves Task 8's PR is correct. Write it first (TDD), watch it fail on current state, then watch it pass after Task 8.

**Files:**
- Modify: `.github/workflows/license-guard.yml` (extends the file from Task 5)

- [ ] **Step 7.1: Extend the guard workflow**

File: `.github/workflows/license-guard.yml`

Replace the file from Task 5 with the following expanded version:

```yaml
name: License & Org Reference Guard

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  org-references:
    name: Verify no stale sudoshi/Parthenon references
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for stale org references
        run: |
          set -e
          STALE=$(grep -rn 'sudoshi/Parthenon\|ghcr\.io/sudoshi/parthenon' \
            --include='*.md' --include='*.yml' --include='*.yaml' \
            --include='*.json' --include='*.toml' --include='*.sh' \
            --include='*.py' --include='*.php' --include='*.ts' --include='*.tsx' \
            --exclude-dir=node_modules --exclude-dir=vendor \
            --exclude-dir=graphify-out --exclude-dir=.git \
            --exclude-dir=.venv --exclude-dir=backups \
            --exclude-dir='docs/handoffs' --exclude-dir='docs/devlog' \
            . || true)
          if [ -n "$STALE" ]; then
            echo "Found stale sudoshi/Parthenon references in active source:"
            echo "$STALE"
            exit 1
          fi
          echo "OK: no stale sudoshi/Parthenon references in active source."

  license-text:
    name: Verify LICENSE is AGPL-3.0
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check LICENSE first lines
        run: |
          set -e
          if ! head -3 LICENSE | grep -q 'GNU AFFERO GENERAL PUBLIC LICENSE'; then
            echo "LICENSE does not appear to be AGPL-3.0:"
            head -3 LICENSE
            exit 1
          fi
          if ! head -3 LICENSE | grep -q 'Version 3'; then
            echo "LICENSE does not say Version 3:"
            head -3 LICENSE
            exit 1
          fi
          echo "OK: LICENSE is AGPL-3.0."

  license-metadata:
    name: Verify package manifests declare AGPL-3.0-only
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - name: composer.json declares AGPL-3.0-only
        run: |
          set -e
          LICENSE=$(node -e 'console.log(require("./backend/composer.json").license)')
          if [ "$LICENSE" != "AGPL-3.0-only" ]; then
            echo "backend/composer.json license is '$LICENSE', expected 'AGPL-3.0-only'"
            exit 1
          fi
          echo "OK: backend/composer.json license = AGPL-3.0-only"
      - name: frontend/package.json declares AGPL-3.0-only
        run: |
          set -e
          LICENSE=$(node -e 'console.log(require("./frontend/package.json").license)')
          if [ "$LICENSE" != "AGPL-3.0-only" ]; then
            echo "frontend/package.json license is '$LICENSE', expected 'AGPL-3.0-only'"
            exit 1
          fi
          echo "OK: frontend/package.json license = AGPL-3.0-only"
      - name: ai/pyproject.toml declares AGPL-3.0-only
        run: |
          set -e
          python3 - <<'PY'
          import tomllib
          with open('ai/pyproject.toml', 'rb') as f:
              data = tomllib.load(f)
          lic = data.get('project', {}).get('license', {}).get('text', '')
          if lic != 'AGPL-3.0-only':
              print(f"ai/pyproject.toml license is '{lic}', expected 'AGPL-3.0-only'")
              raise SystemExit(1)
          print('OK: ai/pyproject.toml license = AGPL-3.0-only')
          PY
      - name: templates/pyproject.toml declares AGPL-3.0-only
        run: |
          set -e
          python3 - <<'PY'
          import tomllib
          with open('templates/pyproject.toml', 'rb') as f:
              data = tomllib.load(f)
          lic = data.get('project', {}).get('license', {}).get('text', '')
          if lic != 'AGPL-3.0-only':
              print(f"templates/pyproject.toml license is '{lic}', expected 'AGPL-3.0-only'")
              raise SystemExit(1)
          print('OK: templates/pyproject.toml license = AGPL-3.0-only')
          PY

  notice-and-trademarks:
    name: Verify NOTICE, LICENSING.md, TRADEMARKS.md exist
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          set -e
          for f in NOTICE LICENSING.md TRADEMARKS.md; do
            if [ ! -s "$f" ]; then
              echo "Missing or empty: $f"
              exit 1
            fi
          done
          grep -q 'OHDSI Atlas' NOTICE || { echo "NOTICE missing OHDSI Atlas attribution"; exit 1; }
          grep -q 'GNU Affero' LICENSING.md || { echo "LICENSING.md missing AGPL reference"; exit 1; }
          grep -q 'nominative' TRADEMARKS.md || { echo "TRADEMARKS.md missing nominative use"; exit 1; }
          grep -q 'licensing@acumenus.net' LICENSING.md || { echo "LICENSING.md missing commercial contact"; exit 1; }
          echo "OK: NOTICE, LICENSING.md, TRADEMARKS.md present and contain expected sections"
```

- [ ] **Step 7.2: Run the guard locally to confirm it fails on current state**

```bash
# Simulate the license-text job locally
head -3 LICENSE | grep -q 'GNU AFFERO GENERAL PUBLIC LICENSE' && echo "PASS" || echo "FAIL (expected)"
```

Expected: `FAIL (expected)` — current LICENSE is Apache-2.0, not AGPL.

```bash
# Simulate the license-metadata job locally for composer.json
node -e 'console.log(require("./backend/composer.json").license)'
```

Expected: `MIT` (current value, not yet AGPL-3.0-only).

- [ ] **Step 7.3: Commit the guard workflow on its own PR**

```bash
git checkout main
git pull
git checkout -b chore/license-guard-workflow

# Edit .github/workflows/license-guard.yml with the content above
# (the workflow already exists from Task 5; this Task expands it)

git add .github/workflows/license-guard.yml
git commit -m "ci(license-guard): add license-text, license-metadata, notice-and-trademarks jobs

Adds three new jobs to license-guard.yml:
- license-text: asserts LICENSE first lines say AGPL-3.0
- license-metadata: asserts composer.json, package.json, ai/pyproject.toml,
  templates/pyproject.toml all declare AGPL-3.0-only
- notice-and-trademarks: asserts NOTICE/LICENSING.md/TRADEMARKS.md exist and
  contain key sections

These jobs WILL FAIL until the AGPLv3 relicense PR (Task 8) lands. That is
intentional: TDD for the relicense PR. The guard is the contract.

Until the AGPLv3 PR merges, this workflow is allowed to fail. Branch
protection only enforces these jobs after the relicense PR merges."

git push -u origin chore/license-guard-workflow

gh pr create --title "ci(license-guard): add license-text, license-metadata, notice/trademarks jobs" --body "$(cat <<'EOF'
## Summary

Extends `.github/workflows/license-guard.yml` with three jobs that will fail
until the AGPLv3 relicense PR (next) lands. This is TDD for the relicense.

- `license-text`: LICENSE first lines must say AGPL-3.0
- `license-metadata`: composer.json + package.json + 2 pyproject.toml files
  must declare `AGPL-3.0-only`
- `notice-and-trademarks`: NOTICE, LICENSING.md, TRADEMARKS.md must exist
  with expected content

## Test plan

- [x] Verify the new jobs FAIL on this PR (proves the test is wired up)
- [ ] After this merges, do NOT add these jobs to required status checks
- [ ] After AGPLv3 PR merges, ADD these jobs to required status checks
EOF
)"
```

- [ ] **Step 7.4: Merge the guard PR even though new jobs fail**

This PR's purpose is to install the guards. The new jobs will be **red on this PR and on main** until Task 8 lands. That is the TDD signal.

Important: do NOT add the new jobs to **required status checks** in branch protection until after Task 8 merges. Otherwise main becomes unmergeable.

```bash
# After review, merge:
gh pr merge --squash --delete-branch

git checkout main
git pull
```

**Verification:** Main now has the guard workflow, and the new jobs are intentionally red until Task 8.

---

## Task 8: AGPLv3 relicense PR — flip LICENSE and align all manifests

**Files:**
- Replace: `LICENSE` (Apache-2.0 → AGPL-3.0)
- Create: `NOTICE`
- Create: `LICENSING.md`
- Create: `TRADEMARKS.md`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `backend/composer.json`
- Modify: `frontend/package.json`
- Modify: `ai/pyproject.toml`
- Modify: `templates/pyproject.toml`
- Modify: `ROADMAP.md`
- Delete: `package-lock.json` (root, 88-byte stub)

- [ ] **Step 8.1: Create relicense branch**

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main
git pull
git checkout -b chore/relicense-agplv3
```

- [ ] **Step 8.2: Replace LICENSE with AGPL-3.0 verbatim**

```bash
cp /tmp/parthenon-legal/LICENSE-AGPLv3.txt LICENSE
head -3 LICENSE
wc -l LICENSE
```

Expected first three lines:
```
                    GNU AFFERO GENERAL PUBLIC LICENSE
                       Version 3, 19 November 2007

```

- [ ] **Step 8.3: Add NOTICE**

```bash
cp /tmp/parthenon-legal/NOTICE NOTICE
test -s NOTICE && grep -q 'OHDSI Atlas' NOTICE && echo "OK"
```

- [ ] **Step 8.4: Add LICENSING.md**

```bash
cp /tmp/parthenon-legal/LICENSING.md LICENSING.md
test -s LICENSING.md && grep -q 'GNU Affero' LICENSING.md && echo "OK"
```

- [ ] **Step 8.5: Add TRADEMARKS.md**

```bash
cp /tmp/parthenon-legal/TRADEMARKS.md TRADEMARKS.md
test -s TRADEMARKS.md && grep -q 'nominative' TRADEMARKS.md && echo "OK"
```

- [ ] **Step 8.6: Update `backend/composer.json`**

Read the current file first:

```bash
head -10 backend/composer.json
```

Expected current state:
```json
{
    "$schema": "https://getcomposer.org/schema.json",
    "name": "laravel/laravel",
    "type": "project",
    "description": "The skeleton application for the Laravel framework.",
    "keywords": ["laravel", "framework"],
    "license": "MIT",
```

Edit to:

```json
{
    "$schema": "https://getcomposer.org/schema.json",
    "name": "acumenus-data-sciences/parthenon-backend",
    "type": "project",
    "description": "Parthenon — unified OHDSI outcomes research platform on OMOP CDM v5.4. Backend (Laravel).",
    "keywords": ["parthenon", "ohdsi", "omop", "cdm", "healthcare", "informatics", "outcomes-research"],
    "license": "AGPL-3.0-only",
```

Use the Edit tool with `old_string` / `new_string` matching the exact existing block.

- [ ] **Step 8.7: Update `frontend/package.json`**

Current head:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
```

Edit to:

```json
{
  "name": "@acumenus-data-sciences/parthenon-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "license": "AGPL-3.0-only",
  "repository": {
    "type": "git",
    "url": "https://github.com/Acumenus-Data-Sciences/Parthenon.git",
    "directory": "frontend"
  },
  "author": "Acumenus Data Sciences, Inc.",
```

After the rename of `name` from `frontend` to `@acumenus-data-sciences/parthenon-frontend`, search for any imports that reference the old package name:

```bash
grep -rn '"frontend"' frontend/src 2>/dev/null | grep -v node_modules
```

Expected: no hits (the package name is not used as an import root in this codebase).

If hits appear, leave the name as `frontend` (rollback the name change) and only add the `license`, `repository`, and `author` fields. Document the rollback decision in the commit message.

- [ ] **Step 8.8: Update `ai/pyproject.toml`**

Current state (9 lines, no license):

```toml
[project]
name = "parthenon-ai"
version = "0.1.0"
description = "AI/ML service for Parthenon - concept mapping, embeddings, and clinical NLP"
requires-python = ">=3.12"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

Edit to:

```toml
[project]
name = "parthenon-ai"
version = "0.1.0"
description = "AI/ML service for Parthenon - concept mapping, embeddings, and clinical NLP"
requires-python = ">=3.12"
license = { text = "AGPL-3.0-only" }
authors = [{ name = "Acumenus Data Sciences, Inc." }]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 8.9: Update `templates/pyproject.toml`**

Current line 7:

```toml
license = { text = "Apache-2.0" }
```

Replace with:

```toml
license = { text = "AGPL-3.0-only" }
```

The rest of the file already has appropriate AGPL-vs-commercial structure (it references `community-wheel-isolation` CI and the proprietary `runtime/commercial/` exclusion). Don't touch the rest.

- [ ] **Step 8.10: Update `README.md` — badge and footer**

Current line 11:
```markdown
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)
```

Replace with:
```markdown
[![License](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
```

Current footer (line 292-294):
```markdown
## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
```

Replace with:
```markdown
## License

Parthenon Community Edition is licensed under **GNU AGPL-3.0-only** — see
[LICENSE](LICENSE) and [LICENSING.md](LICENSING.md) for details.

A commercial **Enterprise Edition** is available with additional features
(SSO with SAML/SCIM, multi-tenancy, FIPS crypto, signed audit retention,
Kubernetes operator, premium support). Contact `licensing@acumenus.net` for
inquiries.
```

- [ ] **Step 8.11: Update `CONTRIBUTING.md` — License section**

Current footer:
```markdown
## License

By contributing, you agree that your contributions will be licensed under Apache 2.0 (the same license as Parthenon).
```

Replace with:
```markdown
## License and Contributor License Agreement

Parthenon Community Edition is licensed under **GNU AGPL-3.0-only**. By
contributing, you agree to the Parthenon Contributor License Agreement (CLA),
which grants Acumenus Data Sciences, Inc.:

1. The right to distribute your contribution under AGPL-3.0-only as part of
   Parthenon Community Edition.
2. The right to re-license your contribution under any other terms,
   including commercial licenses for the Parthenon Enterprise Edition. This
   grant is necessary to support the project's dual-licensing model.
3. A patent grant equivalent to Apache-2.0 §3.

The CLA is administered by **CLA Assistant** at https://cla-assistant.io,
which automatically requests your agreement on your first pull request. The
full CLA text is at the cla-assistant.io page for this repository.

For details on dual licensing and the Enterprise Edition, see
[LICENSING.md](LICENSING.md).

### Bots

Automated contribution bots (Sentinel, Bolt, Palette, Jules, Dependabot) are
allow-listed in CLA Assistant. They are not subject to per-PR CLA prompts.
```

- [ ] **Step 8.12: Update `ROADMAP.md` — note Enterprise Edition status**

Find the section that mentions the Enterprise edition (already exists, see grep at the start of this plan). Add a note near the top of `ROADMAP.md` after the "Where We Are" section:

```markdown
> **Editions:** Parthenon is now distributed in two editions. **Community
> Edition** (this repository, AGPL-3.0-only) is the full research platform.
> **Enterprise Edition** (commercial license, separate distribution) adds
> enterprise infrastructure: Keycloak SSO with SAML/SCIM, multi-tenancy,
> FIPS-validated crypto, signed audit log retention, observability shippers,
> Kubernetes operator, premium support. Contact `licensing@acumenus.net`.
```

Place it as a callout block right after the existing "What follows is our plan..." paragraph in the "Where We Are" section.

- [ ] **Step 8.13: Delete stale root `package-lock.json`**

```bash
ls -la package-lock.json   # should show ~88 bytes
cat package-lock.json      # should be empty packages object stub
rm package-lock.json
```

- [ ] **Step 8.14: Verify package manifests still parse**

```bash
# composer
docker compose exec -T php sh -c "cd /var/www/html && composer validate --strict --no-check-publish 2>&1 | tail -5"

# npm (dry-run)
cd frontend && npm install --legacy-peer-deps --dry-run 2>&1 | tail -5
cd ..

# Python tomllib
python3 -c "import tomllib; tomllib.load(open('ai/pyproject.toml','rb')); print('OK ai')"
python3 -c "import tomllib; tomllib.load(open('templates/pyproject.toml','rb')); print('OK templates')"
```

Expected: `composer validate` succeeds; `npm install --dry-run` succeeds; both Python tomllib loads succeed.

- [ ] **Step 8.15: Run the license-guard workflow locally (simulated)**

```bash
# Simulate license-text job
head -3 LICENSE | grep -q 'GNU AFFERO GENERAL PUBLIC LICENSE' && echo "license-text PASS" || echo "license-text FAIL"

# Simulate license-metadata job
node -e 'console.log(require("./backend/composer.json").license)' | grep -q 'AGPL-3.0-only' && echo "composer.json PASS"
node -e 'console.log(require("./frontend/package.json").license)' | grep -q 'AGPL-3.0-only' && echo "package.json PASS"
python3 -c "import tomllib; assert tomllib.load(open('ai/pyproject.toml','rb'))['project']['license']['text'] == 'AGPL-3.0-only'" && echo "ai/pyproject PASS"
python3 -c "import tomllib; assert tomllib.load(open('templates/pyproject.toml','rb'))['project']['license']['text'] == 'AGPL-3.0-only'" && echo "templates/pyproject PASS"

# Simulate notice-and-trademarks job
test -s NOTICE && test -s LICENSING.md && test -s TRADEMARKS.md && \
grep -q 'OHDSI Atlas' NOTICE && \
grep -q 'GNU Affero' LICENSING.md && \
grep -q 'nominative' TRADEMARKS.md && \
grep -q 'licensing@acumenus.net' LICENSING.md && \
echo "notice-and-trademarks PASS"
```

Expected: all PASS lines printed.

- [ ] **Step 8.16: Run pre-commit hook**

```bash
git add -A
git status --short
```

Pre-commit will run Pint (no PHP files changed; will skip), PHPStan (skip), tsc (skip), ESLint (skip), Vitest (skip), Python syntax (no Python file behavior changed).

Expected: pre-commit passes (mostly skipped because we only edited docs/manifests).

- [ ] **Step 8.17: Commit and open PR**

```bash
git commit -m "chore(license): relicense from Apache-2.0 to AGPL-3.0-only

Switches Parthenon Community Edition's outbound license from Apache 2.0
to AGPL-3.0-only.

Adds:
  LICENSE          AGPL-3.0 verbatim from gnu.org (~661 lines)
  NOTICE           Heritage attribution (OHDSI Atlas, OMOP, Achilles,
                   Circe, DQD, HADES — all Apache-2.0, not redistributed)
  LICENSING.md     Current license + dual-licensing offer + commercial
                   contact (licensing@acumenus.net) + trademark pointer
  TRADEMARKS.md    Standalone trademark policy

Aligns license metadata across all package manifests:
  backend/composer.json     MIT       → AGPL-3.0-only
                            laravel/laravel → acumenus-data-sciences/parthenon-backend
  frontend/package.json     (none)    → AGPL-3.0-only + repository + author
                            frontend  → @acumenus-data-sciences/parthenon-frontend
  ai/pyproject.toml         (none)    → AGPL-3.0-only + authors
  templates/pyproject.toml  Apache-2.0 → AGPL-3.0-only

Resolves pre-existing inconsistency: backend/composer.json declared MIT
while root LICENSE was Apache 2.0. Both now AGPL-3.0-only.

Heritage contributor audit (per docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md):
60k+ heritage author commit touches were all in the legacy js/ Atlas tree,
which was deleted long before this change. Surviving heritage author
touches in current tree are .gitignore (mechanical), LICENSE text itself
(public domain), README.md (overwritten), and the stale root
package-lock.json (deleted in this PR). Defensible relicense without
per-author consent.

Updates README badge, ROADMAP editions callout, CONTRIBUTING License
section (now references CLA Assistant + dual-licensing terms).

Deletes stale 88-byte root package-lock.json.

CLA Assistant is live at https://cla-assistant.io for this repo. Bot PRs
(Sentinel/Bolt/Palette/Jules/Dependabot) allow-listed.

Private fork users (Geisinger, Hive Networks pilots) notified prior to
this commit; acks tracked in counsel records.

Pairs with the license-guard.yml CI jobs (added in chore/license-guard-workflow):
  - license-text
  - license-metadata
  - notice-and-trademarks
which will turn green when this PR merges."

git push -u origin chore/relicense-agplv3

gh pr create --title "chore(license): relicense to AGPL-3.0-only + add NOTICE/LICENSING.md/TRADEMARKS.md" --body "$(cat <<'EOF'
## Summary

Switches Parthenon Community Edition from **Apache 2.0** to **AGPL-3.0-only**.
This is a one-way door — see `LICENSING.md` for the rationale and the
dual-licensing offer for Enterprise Edition.

## Files changed

- `LICENSE` — replaced with AGPL-3.0 verbatim
- `NOTICE` — new (heritage attribution)
- `LICENSING.md` — new (dual-licensing offer + commercial contact)
- `TRADEMARKS.md` — new (standalone trademark policy)
- `backend/composer.json` — license MIT → AGPL-3.0-only; name laravel/laravel → acumenus-data-sciences/parthenon-backend
- `frontend/package.json` — added license + repository + author; name → @acumenus-data-sciences/parthenon-frontend
- `ai/pyproject.toml` — added license + authors
- `templates/pyproject.toml` — Apache-2.0 → AGPL-3.0-only
- `README.md` — badge + footer + EE pointer
- `CONTRIBUTING.md` — License section rewritten for AGPLv3 + CLA
- `ROADMAP.md` — editions callout
- `package-lock.json` — deleted (88-byte stub)

## Test plan

- [ ] CI green (Pint, PHPStan, tsc, ESLint, Vitest, Pest, pytest, mypy)
- [ ] `license-guard.yml :: license-text` PASSES
- [ ] `license-guard.yml :: license-metadata` PASSES (4 manifests)
- [ ] `license-guard.yml :: notice-and-trademarks` PASSES
- [ ] `composer validate --strict` succeeds
- [ ] `npm install --legacy-peer-deps --dry-run` succeeds
- [ ] `tomllib.load` succeeds for ai/ and templates/ pyproject.toml
- [ ] Production deploy on parthenon.acumenus.net unaffected (no functional change)

## Counsel and CLA

- EULA placeholder at `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md` sent to counsel for review.
- CLA Assistant configured at https://cla-assistant.io for this repo. CLA text matches the wording in CONTRIBUTING.md.
- Bot PRs allow-listed.

## Notification

Private fork users (Geisinger, Hive Networks pilots) notified on 2026-05-08; acks tracked.

## Heritage audit

See `docs/handoffs/Apache2.0_to_AGPLv3_Conversion.md` §2.2.
EOF
)"
```

- [ ] **Step 8.18: Wait for CI**

```bash
gh pr view --json statusCheckRollup
```

Expected: all jobs green, including the previously-red license-guard jobs.

- [ ] **Step 8.19: USER ACTION — Review and merge**

Review the diff carefully — this is a one-way legal change. Once satisfied:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull
```

**Verification:** `Acumenus-Data-Sciences/Parthenon` main now has LICENSE = AGPL-3.0, all manifests AGPL-3.0-only, NOTICE/LICENSING.md/TRADEMARKS.md present, license-guard CI green.

---

## Task 9: Add license-guard jobs to required status checks

**Why:** Now that the AGPLv3 PR has merged, the guard jobs reliably pass on main. Add them to branch protection so future PRs cannot regress.

**Files:** No source changes. GitHub Settings only.

- [ ] **Step 9.1: USER ACTION — Update branch protection**

On https://github.com/Acumenus-Data-Sciences/Parthenon/settings/branches → branch protection rule for `main`:

Required status checks (add these to existing list):
- `License & Org Reference Guard / org-references`
- `License & Org Reference Guard / license-text`
- `License & Org Reference Guard / license-metadata`
- `License & Org Reference Guard / notice-and-trademarks`

Save.

- [ ] **Step 9.2: USER ACTION — Test the guard regression-blocks**

Open a no-op PR that intentionally breaks one guard (e.g., touch composer.json to set license back to MIT). Watch CI fail. Confirm the PR cannot be merged. Close the PR without merging.

```bash
git checkout main && git pull
git checkout -b test/license-guard-regression
# manually edit backend/composer.json setting license back to MIT
git commit -am "test: regress license to verify guard blocks"
git push -u origin test/license-guard-regression
gh pr create --title "test: license-guard regression check (DO NOT MERGE)" --body "Verifying license-guard blocks regression. Will be closed without merging." --draft
# observe CI fail, then close
gh pr close <PR_NUM> --delete-branch
git checkout main
```

**Verification:** Guard correctly fails on the regression PR.

---

## Task 10: Post-relicense announcements and bookkeeping

- [ ] **Step 10.1: USER ACTION — Public announcement**

Post a blog entry or pinned issue announcing:
- The license change to AGPL-3.0-only
- The repo move to `github.com/Acumenus-Data-Sciences`
- The Enterprise Edition program (forthcoming)
- The CLA Assistant requirement on new contributions

Suggested location: `docs/blog/2026-05-XX-license-change-and-acumenus-data-sciences-org.md` (already AGPLv3-published doc).

- [ ] **Step 10.2: USER ACTION — Update SAM.gov / nonprofit filings**

Acumenus is SAM.gov registered. If your registration mentions the project's IP or licensing posture, update the relevant entries.

- [ ] **Step 10.3: USER ACTION — Counsel follow-up on EULA**

Schedule a follow-up call with counsel to walk through the EULA placeholder draft and the CLA wording. Target: counsel-finalized EULA in hand within 4 weeks (i.e., before Phase 3 EE bootstrap).

- [ ] **Step 10.4: Update memory + project records**

User memory updates (your call, not Claude's):
- Note the org transfer date and new canonical URL
- Note the AGPLv3 flip date
- Note where the EULA draft lives
- Note CLA Assistant configuration

These are off-repo records; nothing to commit.

---

## Plan completion checklist

- [ ] CLA Assistant is live and gating PRs at `Acumenus-Data-Sciences/Parthenon`
- [ ] Repo moved from `sudoshi/` to `Acumenus-Data-Sciences/`; CI green on transferred repo
- [ ] All `sudoshi/Parthenon` references in active source updated to `Acumenus-Data-Sciences/Parthenon`
- [ ] LICENSE is AGPL-3.0
- [ ] NOTICE, LICENSING.md, TRADEMARKS.md exist with correct content
- [ ] All package manifests declare `AGPL-3.0-only`
- [ ] README badge says AGPLv3
- [ ] ROADMAP has editions callout
- [ ] CONTRIBUTING.md references CLA Assistant + dual-licensing
- [ ] license-guard CI workflow exists with 4 jobs and all are required status checks
- [ ] EULA placeholder draft sent to counsel
- [ ] Private fork users notified and acked
- [ ] Public announcement posted

---

## What this plan does NOT do (out of scope, deferred to subsequent plans)

- **Phase 2** — CE extension points (8 PRs adding `AuthDriver`, `TenantResolver`, `CryptoProvider`, `AuditSink`, `ObservabilityShipper`, frontend `featureFlags` + `<EnterpriseGate>`, Acropolis installer phase registry, compose composition contract). See **Plan 02**.
- **Phase 3** — `Acumenus-Data-Sciences/Parthenon-EE` private repo bootstrap, `git subtree` setup, sync GH Action, EE CI on self-hosted runners, signed image build, private GHCR namespace. See **Plan 03**.
- **Phase 4** — First-pass EE migration: move Acropolis enterprise services CE → EE, build Keycloak/SAML/SCIM drivers, MultiTenantResolver, FipsCryptoProvider, SignedAuditSink, Datadog/Splunk shippers, Operator skeleton, license module. See **Plan 04**.
- Counsel-finalized EULA (counsel turnaround time, not in our control).
- Trademark filings/registrations (parallel legal effort with counsel).

*End of Plan 01.*
