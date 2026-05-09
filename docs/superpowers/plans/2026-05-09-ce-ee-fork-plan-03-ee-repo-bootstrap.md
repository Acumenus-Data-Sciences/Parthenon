# CE/EE Fork — Plan 03: Enterprise Edition Repo Bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. This plan establishes the private `Acumenus-Data-Sciences/Parthenon-EE` repository and its CI/CD foundation. Most steps run on GitHub.com or on a self-hosted runner host (`beastmode`) — they cannot be performed from inside the CE working tree.

**Goal:** Stand up `github.com/Acumenus-Data-Sciences/Parthenon-EE` (private), wire CE in as a `git subtree` under `parthenon/`, build the daily CE→EE sync GitHub Action, set up self-hosted CI on `beastmode`, configure private GHCR namespaces with cosign signing + SBOM generation, and prove the whole pipeline end-to-end with a sample EE container build.

**Architecture:** Approach B from the spec — single working tree, CE merged via `git subtree` at a pinned commit under `parthenon/`, EE-only code under `enterprise/`. Hard rule (CI-enforced): EE never patches files under `parthenon/` — only `[ce-sync]` merge commits modify that subtree. EE artifacts publish to `ghcr.io/acumenus-data-sciences/parthenon-ee-*` (private), signed via cosign with an Acumenus-controlled key, with SBOM attestations attached.

**Spec reference:** Spec §3.4, §6, §7 Phase 3.

**Prerequisites:**
- Plan 01 fully merged (AGPLv3 live on `Acumenus-Data-Sciences/Parthenon` main)
- Sanjay is owner of the `Acumenus-Data-Sciences` GitHub Organization
- Counsel has signed off on `LICENSE-EE` (or you accept the placeholder DRAFT for now and re-commit when counsel returns)
- A host capable of running GitHub Actions self-hosted runners is available (default: `beastmode`)
- Cosign + syft are installed on the runner host (or the CI installs them per-run)

**Out of scope:**
- Building any specific EE driver (Keycloak, SAML, FIPS, etc.) — that's Plan 04.
- Migrating Acropolis enterprise services from CE to EE — that's Plan 04.
- Publishing the first paid customer license — that's a sales/legal track, not engineering.

---

## Pre-flight

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main && git pull
head -3 LICENSE | grep AFFERO                     # AGPLv3 confirmed
gh auth status                                    # Logged in as sudoshi (org owner of Acumenus-Data-Sciences)
gh api orgs/Acumenus-Data-Sciences --jq '.login'  # → "Acumenus-Data-Sciences"
which cosign syft || echo "Install cosign + syft before Task 8"
```

---

## File structure (final state of `Parthenon-EE`)

After all tasks complete, the private repo looks like:

```
Parthenon-EE/                               # github.com/Acumenus-Data-Sciences/Parthenon-EE (private)
├── parthenon/                              # CE merged in as git subtree at pinned tag
│   └── ... (full CE source — read-only by convention; only [ce-sync] commits touch this)
├── enterprise/                             # EE-only overlay (mirrors CE structure where it extends)
│   ├── backend/        # PHP drivers (Keycloak, SAML, SCIM, FIPS, multi-tenant, signed audit, license)
│   ├── frontend/       # React EE-only views (admin-enterprise/)
│   ├── ai/             # Python EE compliance modules
│   ├── acropolis/      # n8n, superset, datahub, wazuh, keycloak compose+config
│   ├── k8s/            # Helm + Kustomize
│   ├── operator/       # Parthenon Operator skeleton
│   ├── installer/      # EE installer phases (entry-points-registered)
│   └── docs/           # Private customer-facing docs
├── docker-compose.ee.yml                   # EE composition (extends parthenon/docker-compose.yml)
├── scripts/
│   ├── sync-from-ce.sh                     # daily git subtree pull from CE
│   ├── build-ee.sh                         # combined CE+EE container image build
│   └── verify-no-ce-patches.sh             # pre-commit + CI guard
├── .github/
│   ├── workflows/
│   │   ├── ce-sync.yml                     # daily scheduled sync (GH Action)
│   │   ├── ee-ci.yml                       # CE+EE test pipeline on every EE PR
│   │   └── ee-release.yml                  # signed image build + GHCR push on release tags
│   └── CODEOWNERS                          # Acumenus-employees-only on EE
├── .gitignore
├── .git-blame-ignore-revs                  # ignore the initial subtree-add commit in blame
├── LICENSE-EE                              # commercial EULA
├── COMMERCIAL.md                           # offering structure (no prices)
├── THIRD_PARTY_LICENSES.md                 # n8n / Superset / DataHub / Wazuh / Keycloak licenses
├── README.md                               # private; oriented to Acumenus team + customers
├── CE_VERSION                              # pinned CE commit sha + tag (validated at build time)
├── CHANGELOG-EE.md                         # EE-only changelog (separate semver: vEE-1.x.y)
└── pyproject.toml / composer.json / package.json (EE-specific, lighter than CE)
```

---

## Task 1: Create the private repo

**USER ACTION (Sanjay) — cannot be done from this terminal:**

- [ ] **Step 1.1: Create `Acumenus-Data-Sciences/Parthenon-EE` (private)**

```bash
gh repo create Acumenus-Data-Sciences/Parthenon-EE \
  --private \
  --description "Parthenon Enterprise Edition — proprietary overlay for the AGPLv3 Community Edition. Source available to paying customers only." \
  --homepage "https://parthenon.acumenus.net" \
  --gitignore "" \
  --license ""
```

Verify:

```bash
gh api repos/Acumenus-Data-Sciences/Parthenon-EE --jq '{full_name, private, default_branch}'
# Expected: {"full_name":"Acumenus-Data-Sciences/Parthenon-EE","private":true,"default_branch":"main"}
```

- [ ] **Step 1.2: Set repo metadata**

In Settings:
- Default branch: `main`
- Visibility: Private
- Features: disable Wiki (we use docs/ in repo); enable Issues; disable Projects (use Linear or Jira if any)
- Merge button: only Squash; disable Merge commits and Rebase

- [ ] **Step 1.3: Disable forking**

`Settings → General → Allow forking` → unchecked. (Critical — proprietary code must not be forkable, even by employees, to limit accidental exfiltration.)

---

## Task 2: Bootstrap the working tree locally

```bash
cd /home/smudoshi/Github
git clone git@github.com:Acumenus-Data-Sciences/Parthenon-EE.git
cd Parthenon-EE
```

- [ ] **Step 2.1: Initial empty commit**

```bash
git commit --allow-empty -m "chore: initial empty commit (subtree add lands next)"
git push -u origin main
```

- [ ] **Step 2.2: Add CE as a remote and merge it into a `parthenon/` subtree**

Pin to a known-good CE tag. Use the latest tag at `Acumenus-Data-Sciences/Parthenon` main:

```bash
# Determine the latest CE commit to pin (use a tag if one exists, otherwise the current main sha)
CE_TAG=$(gh api repos/Acumenus-Data-Sciences/Parthenon/tags --jq '.[0].name // empty')
CE_SHA=$(gh api repos/Acumenus-Data-Sciences/Parthenon/commits/main --jq '.sha')
PIN="${CE_TAG:-$CE_SHA}"
echo "Pinning CE at: $PIN"

git remote add ce-upstream git@github.com:Acumenus-Data-Sciences/Parthenon.git
git fetch ce-upstream

# Use git subtree (not submodule) to merge CE into ./parthenon/
git subtree add --prefix=parthenon ce-upstream "$PIN" --squash
```

This creates two commits:
1. `Squashed 'parthenon/' content from commit <PIN>`
2. `Merge commit 'XXX' as 'parthenon'`

Both are tagged in messages with the CE pin sha. Subsequent `git subtree pull` operations reference these.

- [ ] **Step 2.3: Record the pin**

```bash
echo "$PIN" > CE_VERSION
echo "# CE_VERSION" >> CE_VERSION
echo "# Pinned commit/tag of acumenus-data-sciences/Parthenon merged into parthenon/" >> CE_VERSION
echo "# Updated by scripts/sync-from-ce.sh" >> CE_VERSION
git add CE_VERSION
git commit -m "chore: record CE version pin in CE_VERSION file"
```

- [ ] **Step 2.4: Push**

```bash
git push origin main
```

---

## Task 3: License + commercial documents

- [ ] **Step 3.1: `LICENSE-EE`** — copy from `~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md` if counsel hasn't returned a finalized version yet. The header MUST clearly mark as DRAFT until counsel signs off.

```bash
cp ~/Documents/acumenus-legal/LICENSE-EE-draft-v1.md LICENSE-EE
# Or if counsel has returned a final version, use that path instead.
```

- [ ] **Step 3.2: `COMMERCIAL.md`** — describes the offering structure (without prices)

```markdown
# Parthenon Enterprise Edition — Commercial Offering

> **Pricing is not published in this repository.** Contact `licensing@acumenus.net` for a quote tailored to your deployment scale, support tier, and regulatory context.

## What Enterprise Edition adds

Enterprise Edition is built on top of Parthenon Community Edition (AGPL-3.0-only) and adds the following capabilities:

### Identity & access
- Keycloak SSO with SAML 2.0 and SCIM 2.0 user provisioning
- OIDC IdP federation
- Group → role mapping with JIT account creation

### Multi-tenancy
- Tenant model with subdomain / header / JWT-claim resolution
- Per-tenant data isolation, tenant-aware Eloquent scopes
- Tenant-scoped storage paths and Solr collections (where applicable)

### Compliance
- FIPS 140-2-validated cryptographic provider
- HIPAA-grade audit log retention with WORM (S3 Object Lock or Azure Blob immutability)
- Cryptographically-signed audit log chain with tamper-evident verification
- SOC 2 controls module

### Observability
- Datadog, Splunk, OpenTelemetry shippers (logs, metrics, traces)
- Enterprise Grafana dashboards

### Kubernetes
- Production Helm charts + Kustomize overlays
- Parthenon Operator with CRDs for Sources, Cohorts, Analyses
- HorizontalPodAutoscaler + PodDisruptionBudget configurations

### Acropolis enterprise services
- n8n workflow automation
- Apache Superset BI dashboards
- DataHub data catalog
- Wazuh security monitoring

### Support
- 5×8 / 24×7 / Mission-Critical tiers
- Named technical account manager
- Quarterly business reviews

## Deployment options

- Customer-managed on-premise (most common)
- Customer-managed cloud (AWS / Azure / GCP)
- Acumenus-managed (future, pending Hyperscaler Terraforms)

## Source escrow

Available via Iron Mountain at customer cost. Contact `licensing@acumenus.net`.

## Trial

A no-cost 30-day evaluation license is available for qualified customers. Contact `licensing@acumenus.net` with your organization name, intended use case, and deployment scale.
```

- [ ] **Step 3.3: `THIRD_PARTY_LICENSES.md`**

```markdown
# Third-Party Licenses (Enterprise Edition)

Parthenon Enterprise Edition bundles or integrates with the following third-party services. These services retain their original licenses; deployment by customers is subject to those licenses.

## Bundled / orchestrated services

| Service | Version (pinned) | License | Notes |
|---|---|---|---|
| n8n | 2.x | Sustainable Use License | Workflow automation. Customer self-hosted under SUL terms; commercial use is permitted within customer org. |
| Apache Superset | 4.x | Apache 2.0 | BI dashboards |
| DataHub | 0.13.x | Apache 2.0 | Data catalog + lineage |
| Wazuh | 4.x | GPL-2.0 | SIEM. Customer self-hosted. |
| Keycloak | 25.x | Apache 2.0 | SSO IdP (replaces Authentik in EE deployments) |

## EE-specific PHP/Python/JS dependencies

See `enterprise/backend/composer.lock`, `enterprise/frontend/package-lock.json`, and `enterprise/ai/requirements.txt` for the complete dependency tree. Each package's license is pinned in those manifests.

## CE source (transitively included)

Parthenon Community Edition ships under AGPL-3.0-only. Its source is checked into `parthenon/` of this repository via `git subtree`. The AGPLv3 obligations of CE pass through to anyone redistributing this repository's source — but EE customers receive ONLY the binary container images and the EE overlay source under the EE commercial license; they do NOT receive the right to redistribute the CE source under non-AGPL terms unless they have separately obtained a CE commercial license from Acumenus.
```

- [ ] **Step 3.4: `README.md`** (private, customer/team-facing)

```markdown
# Parthenon Enterprise Edition

Private repository. Source available to Acumenus employees and licensed Enterprise customers only. See `LICENSE-EE` for terms.

## What this repo contains

- `parthenon/` — Parthenon Community Edition (AGPL-3.0-only), merged in as a git subtree from `github.com/Acumenus-Data-Sciences/Parthenon`.
- `enterprise/` — Acumenus proprietary code that extends CE via documented extension points (see `parthenon/docs/architecture/extension-points.md`).
- `docker-compose.ee.yml` — EE composition (extends CE compose).
- `.github/workflows/` — CI/CD for EE-specific testing and signed image builds.

## Getting started (Acumenus team)

```bash
git clone git@github.com:Acumenus-Data-Sciences/Parthenon-EE.git
cd Parthenon-EE
# parthenon/ subtree is already populated — no submodule init needed.
docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml up -d
```

## Hard rule: don't patch CE files

EE never edits files under `parthenon/`. All EE behavior is added via `enterprise/` overlays consuming CE extension points. If EE needs a new extension point in CE, that's a CE PR (public, AGPL).

`scripts/verify-no-ce-patches.sh` enforces this as a pre-commit hook and a CI gate. The only exception is `[ce-sync]`-tagged merge commits produced by `scripts/sync-from-ce.sh`.

## Daily CE sync

A scheduled GitHub Action (`.github/workflows/ce-sync.yml`) runs `scripts/sync-from-ce.sh` daily at 06:00 UTC. If the merge is clean, it auto-pushes; if there are conflicts, it opens a PR for `@Acumenus-Data-Sciences/maintainers` to resolve.

## Contributing

EE is developed by Acumenus employees only. CODEOWNERS enforces this on all PRs.

## Customer access

Customers receive container images + license keys, not source. See `COMMERCIAL.md` for the offering structure.
```

- [ ] **Step 3.5: Commit + push the legal/marketing trio**

```bash
git add LICENSE-EE COMMERCIAL.md THIRD_PARTY_LICENSES.md README.md
git commit -m "docs: add EE legal + commercial documents

- LICENSE-EE: commercial EULA placeholder (pending counsel finalization)
- COMMERCIAL.md: offering structure without prices
- THIRD_PARTY_LICENSES.md: bundled service licenses (n8n, Superset, DataHub, Wazuh, Keycloak)
- README.md: private team-facing intro"
git push origin main
```

---

## Task 4: Sync tooling

- [ ] **Step 4.1: `scripts/sync-from-ce.sh`** — daily CE→EE merge

```bash
mkdir -p scripts
cat > scripts/sync-from-ce.sh <<'EOF'
#!/usr/bin/env bash
# scripts/sync-from-ce.sh
#
# Pull the latest Acumenus-Data-Sciences/Parthenon main into the
# parthenon/ subtree. Intended to run daily via .github/workflows/ce-sync.yml.
#
# Behavior:
#   - Clean merge → commit with [ce-sync] marker, update CE_VERSION, push.
#   - Conflict → open a PR titled "sync: CE main → EE @ <sha>" and ping
#     @Acumenus-Data-Sciences/maintainers.

set -euo pipefail

CE_REMOTE="ce-upstream"
CE_REMOTE_URL="https://github.com/Acumenus-Data-Sciences/Parthenon.git"
CE_BRANCH="main"
SUBTREE_PREFIX="parthenon"
SYNC_BRANCH="sync/ce-main-$(date -u +%Y%m%d-%H%M%S)"

# Ensure ce-upstream remote exists
if ! git remote get-url "$CE_REMOTE" >/dev/null 2>&1; then
  git remote add "$CE_REMOTE" "$CE_REMOTE_URL"
fi
git fetch "$CE_REMOTE" "$CE_BRANCH"

NEW_SHA=$(git rev-parse "$CE_REMOTE/$CE_BRANCH")
PINNED_SHA=$(head -1 CE_VERSION)

if [ "$NEW_SHA" = "$PINNED_SHA" ]; then
  echo "Already up to date with CE main at $NEW_SHA"
  exit 0
fi

echo "Syncing CE: $PINNED_SHA -> $NEW_SHA"

# Try to merge into a sync branch first to allow PR fallback on conflict.
git checkout -b "$SYNC_BRANCH"

if git subtree pull --prefix="$SUBTREE_PREFIX" "$CE_REMOTE" "$CE_BRANCH" --squash --message "[ce-sync] CE main @ $NEW_SHA"; then
  # Clean merge — update CE_VERSION and push to main directly
  echo "$NEW_SHA" > CE_VERSION
  echo "# CE_VERSION" >> CE_VERSION
  echo "# Pinned commit of Acumenus-Data-Sciences/Parthenon merged into parthenon/" >> CE_VERSION
  echo "# Last sync: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> CE_VERSION
  git add CE_VERSION
  git commit --amend --no-edit  # fold CE_VERSION update into the merge commit

  git checkout main
  git merge --ff-only "$SYNC_BRANCH"
  git branch -D "$SYNC_BRANCH"
  git push origin main
  echo "Sync complete; CE_VERSION now $NEW_SHA"
else
  # Conflict — push the branch and let CI / a maintainer take it from here.
  echo "Subtree merge had conflicts; pushing branch for maintainer review."
  git push -u origin "$SYNC_BRANCH"
  exit 2
fi
EOF
chmod +x scripts/sync-from-ce.sh
```

- [ ] **Step 4.2: `scripts/verify-no-ce-patches.sh`** — pre-commit / CI guard

```bash
cat > scripts/verify-no-ce-patches.sh <<'EOF'
#!/usr/bin/env bash
# scripts/verify-no-ce-patches.sh
#
# Reject any commit (or staged changes) that modifies files under parthenon/
# unless the commit message contains [ce-sync] (subtree merge marker).
#
# Used as:
#   - pre-commit hook (looks at staged changes)
#   - CI gate on every EE PR (looks at PR diff)

set -euo pipefail

MODE="${1:-staged}"   # "staged" | "pr"

if [ "$MODE" = "staged" ]; then
  CHANGED=$(git diff --cached --name-only)
elif [ "$MODE" = "pr" ]; then
  # CI: compare PR head to base
  BASE="${GITHUB_BASE_REF:-main}"
  CHANGED=$(git diff --name-only "origin/$BASE"...HEAD)
else
  echo "Usage: $0 [staged|pr]" >&2
  exit 64
fi

CE_FILES=$(echo "$CHANGED" | grep -E '^parthenon/' || true)

if [ -z "$CE_FILES" ]; then
  echo "OK: no parthenon/ changes."
  exit 0
fi

# parthenon/ changes are only allowed via [ce-sync] commits.
# In staged mode the commit hasn't happened yet — check the staged diff has
# no human-authored changes by comparing the HEAD parthenon/ tree to staged.
# In pr mode iterate the PR's commits and verify each parthenon/-touching commit
# has the [ce-sync] marker.

if [ "$MODE" = "pr" ]; then
  COMMITS=$(git log --format='%H %s' "origin/$BASE"...HEAD)
  while IFS= read -r line; do
    sha=$(echo "$line" | cut -d' ' -f1)
    msg=$(echo "$line" | cut -d' ' -f2-)
    if git diff-tree --no-commit-id --name-only -r "$sha" | grep -qE '^parthenon/'; then
      if ! echo "$msg" | grep -qF '[ce-sync]'; then
        echo "FAIL: commit $sha touches parthenon/ but does not have [ce-sync] marker."
        echo "  message: $msg"
        echo "  EE never patches CE files. Use scripts/sync-from-ce.sh, or add the change as an enterprise/ overlay."
        exit 1
      fi
    fi
  done <<< "$COMMITS"
  echo "OK: all parthenon/-touching commits are [ce-sync] merges."
  exit 0
fi

# Staged mode: any staged parthenon/ change is suspect.
echo "FAIL: staged changes touch parthenon/:"
echo "$CE_FILES" | sed 's/^/  /'
echo ""
echo "EE never patches CE files. Either:"
echo "  1. Revert the changes: git restore --staged parthenon/<file> && git checkout parthenon/<file>"
echo "  2. Add the change as an enterprise/ overlay (preferred)"
echo "  3. If this is a CE bug, open a PR against Acumenus-Data-Sciences/Parthenon, then sync with scripts/sync-from-ce.sh"
exit 1
EOF
chmod +x scripts/verify-no-ce-patches.sh
```

- [ ] **Step 4.3: `scripts/build-ee.sh`** — combined CE+EE container build

```bash
cat > scripts/build-ee.sh <<'EOF'
#!/usr/bin/env bash
# scripts/build-ee.sh — build EE container images (CE base + EE overlay).
#
# Usage:
#   ./scripts/build-ee.sh                       # build all EE images at git HEAD
#   ./scripts/build-ee.sh --tag vEE-1.2.3       # tag images with the release tag
#   ./scripts/build-ee.sh --service php         # build a single service
#   ./scripts/build-ee.sh --push                # push to ghcr.io after building
#
# Images are tagged: ghcr.io/acumenus-data-sciences/parthenon-ee-<service>:<tag>
# The CE_VERSION file is embedded as a label for traceability.

set -euo pipefail

TAG="${TAG:-$(git rev-parse --short HEAD)}"
SERVICE="${SERVICE:-}"
PUSH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --service) SERVICE="$2"; shift 2;;
    --push) PUSH=true; shift;;
    *) echo "Unknown arg: $1" >&2; exit 64;;
  esac
done

CE_PIN=$(head -1 CE_VERSION)
REGISTRY="ghcr.io/acumenus-data-sciences"

EE_SERVICES=("php" "nginx" "node" "python-ai" "operator" "license-server")

build_one() {
  local svc="$1"
  local image="${REGISTRY}/parthenon-ee-${svc}:${TAG}"
  local dockerfile="enterprise/${svc}/Dockerfile"
  if [ ! -f "$dockerfile" ]; then
    echo "Skipping ${svc} (no Dockerfile at ${dockerfile})"
    return 0
  fi
  echo "Building ${image} ..."
  docker buildx build \
    --label "org.opencontainers.image.source=https://github.com/Acumenus-Data-Sciences/Parthenon-EE" \
    --label "com.acumenus.parthenon.ce_pin=${CE_PIN}" \
    --label "com.acumenus.parthenon.ee_tag=${TAG}" \
    -t "$image" \
    -f "$dockerfile" \
    .
  if [ "$PUSH" = "true" ]; then
    docker push "$image"
  fi
}

if [ -n "$SERVICE" ]; then
  build_one "$SERVICE"
else
  for svc in "${EE_SERVICES[@]}"; do
    build_one "$svc"
  done
fi

echo "Done."
EOF
chmod +x scripts/build-ee.sh
```

- [ ] **Step 4.4: Pre-commit hook installation note**

Add to `README.md`:

```markdown
## First-time setup (Acumenus contributors)

After cloning, install the pre-commit guard:

\`\`\`bash
mkdir -p .git/hooks
ln -sf ../../scripts/verify-no-ce-patches.sh .git/hooks/pre-commit
\`\`\`

This rejects any commit that touches \`parthenon/\` without a \`[ce-sync]\` marker.
```

- [ ] **Step 4.5: Commit + push**

```bash
git add scripts/ README.md
git commit -m "feat(scripts): sync-from-ce, verify-no-ce-patches, build-ee"
git push origin main
```

---

## Task 5: GitHub Actions — daily sync workflow

- [ ] **Step 5.1: `.github/workflows/ce-sync.yml`**

```bash
mkdir -p .github/workflows
cat > .github/workflows/ce-sync.yml <<'EOF'
name: CE Sync (daily subtree pull)

on:
  schedule:
    # 06:00 UTC daily — low-traffic window
    - cron: '0 6 * * *'
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git identity
        run: |
          git config user.name 'acumenus-ee-sync[bot]'
          git config user.email 'ee-sync@acumenus.net'

      - name: Run sync-from-ce.sh
        id: sync
        run: |
          set +e
          ./scripts/sync-from-ce.sh
          rc=$?
          echo "exit_code=$rc" >> "$GITHUB_OUTPUT"
          if [ $rc -eq 0 ]; then
            echo "result=clean" >> "$GITHUB_OUTPUT"
          elif [ $rc -eq 2 ]; then
            echo "result=conflict" >> "$GITHUB_OUTPUT"
          else
            echo "result=error" >> "$GITHUB_OUTPUT"
            exit $rc
          fi

      - name: Skip if a sync-conflict PR is already open (I3 dedup)
        id: dedup
        if: steps.sync.outputs.result == 'conflict'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          OPEN=$(gh pr list --label sync-conflict --state open --json number --jq 'length')
          echo "open_conflict_prs=$OPEN" >> "$GITHUB_OUTPUT"
          if [ "$OPEN" -gt 0 ]; then
            echo "::notice::A sync-conflict PR is already open ($OPEN). Skipping new PR creation."
          fi

      - name: Ensure sync-conflict label exists
        if: steps.sync.outputs.result == 'conflict' && steps.dedup.outputs.open_conflict_prs == '0'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh label create sync-conflict --color BFD4F2 --description "Daily CE→EE sync hit a merge conflict; needs maintainer resolution" 2>/dev/null || true

      - name: Open conflict PR (if needed and none open)
        if: steps.sync.outputs.result == 'conflict' && steps.dedup.outputs.open_conflict_prs == '0'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          BR=$(git rev-parse --abbrev-ref HEAD)
          CE_SHORT=$(git rev-parse --short ce-upstream/main)
          # I3: title includes the CE pin sha so duplicate detection works
          # and so each PR title is human-distinguishable.
          gh pr create \
            --title "sync: CE main → EE @ $CE_SHORT" \
            --body "Automated sync hit conflicts at CE \`$CE_SHORT\`. \`@Acumenus-Data-Sciences/maintainers\` please resolve.

          ### Conflicted files

          \`\`\`
          $(git diff --name-only --diff-filter=U || true)
          \`\`\`

          ### Resolution

          1. Check out this branch locally
          2. Manually resolve conflicts under \`parthenon/\` (these are CE files; \`[ce-sync]\` marker required when committing the resolution)
          3. Commit with message starting \`[ce-sync]\` to satisfy verify-no-ce-patches.sh
          4. Push; CI runs full EE suite
          5. Once green, squash-merge

          The next daily sync run will be skipped while this PR remains open." \
            --base main \
            --head "$BR" \
            --label sync-conflict \
            --reviewer Acumenus-Data-Sciences/maintainers
EOF

git add .github/workflows/ce-sync.yml
git commit -m "ci(ce-sync): daily scheduled subtree pull from CE main"
git push origin main
```

- [ ] **Step 5.2: Smoke test by triggering manually**

```bash
gh workflow run ce-sync.yml
sleep 30
gh run list --workflow=ce-sync.yml --limit 1
```

Expected on first run: "Already up to date" if CE main hasn't moved since the subtree-add. Otherwise: clean merge + push.

---

## Task 6: GitHub Actions — EE CI pipeline

- [ ] **Step 6.1: `.github/workflows/ee-ci.yml`** — runs CE tests + EE-specific tests on every EE PR

```bash
cat > .github/workflows/ee-ci.yml <<'EOF'
name: EE CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  verify-no-ce-patches:
    name: Guard - EE never patches CE
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run guard
        run: ./scripts/verify-no-ce-patches.sh pr

  ce-tests:
    name: CE test suite (against pinned subtree)
    runs-on: [self-hosted, beastmode]   # use self-hosted runner for speed + cache
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run CE Pest
        working-directory: parthenon
        run: |
          docker compose -f docker-compose.yml up -d postgres redis
          docker compose -f docker-compose.yml exec -T php sh -c \
            "cd /var/www/html && composer install --no-progress && vendor/bin/pest"
      - name: Run CE TypeScript / Vitest
        working-directory: parthenon/frontend
        run: |
          npm ci --legacy-peer-deps
          npx tsc --noEmit
          npx vitest run
      - name: Run CE pytest (AI service)
        working-directory: parthenon/ai
        run: |
          pip install -r requirements.txt
          pytest

  ee-tests:
    name: EE-specific test suite
    needs: ce-tests
    runs-on: [self-hosted, beastmode]
    steps:
      - uses: actions/checkout@v4
      - name: Run EE Pest (drivers)
        run: |
          # EE PHP drivers test against the CE PHP container with EE source mounted.
          docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml exec -T php sh -c \
            "cd /var/www/html && vendor/bin/pest enterprise/backend/tests/"
      - name: Run EE TypeScript / Vitest
        working-directory: enterprise/frontend
        run: |
          npm ci --legacy-peer-deps
          npx tsc --noEmit
          npx vitest run
      - name: Run EE pytest (operator + installer phases)
        working-directory: enterprise
        run: |
          pip install -r requirements.txt
          pytest

  build-ee-images:
    name: Build EE container images (no push)
    needs: ee-tests
    runs-on: [self-hosted, beastmode]
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build-ee.sh --tag pr-${{ github.event.pull_request.number || 'main' }}
EOF

git add .github/workflows/ee-ci.yml
git commit -m "ci(ee-ci): full pipeline (no-ce-patches guard, CE tests, EE tests, image build)"
git push origin main
```

- [ ] **Step 6.2: First run will fail until self-hosted runner is up — that's Task 7. Don't add ee-ci.yml jobs to required status checks yet.**

---

## Task 7: Self-hosted runner on `beastmode`

- [ ] **Step 7.1: USER ACTION — register a runner**

On `beastmode` (or wherever you decide):

```bash
mkdir -p ~/actions-runner-acumenus-ee && cd ~/actions-runner-acumenus-ee
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz

# Get a registration token from GitHub
# https://github.com/Acumenus-Data-Sciences/Parthenon-EE/settings/actions/runners/new
# (or via API):
TOKEN=$(gh api -X POST repos/Acumenus-Data-Sciences/Parthenon-EE/actions/runners/registration-token --jq '.token')

./config.sh \
  --url https://github.com/Acumenus-Data-Sciences/Parthenon-EE \
  --token "$TOKEN" \
  --name beastmode \
  --labels self-hosted,beastmode,linux,x64 \
  --work _work \
  --runasservice  # optional — install as systemd service
```

- [ ] **Step 7.2: Verify the runner shows up**

```bash
gh api repos/Acumenus-Data-Sciences/Parthenon-EE/actions/runners --jq '.runners[] | {name, status, labels: [.labels[].name]}'
# Expected: name=beastmode, status=online, labels include "self-hosted" and "beastmode"
```

- [ ] **Step 7.3: Re-run ee-ci.yml to validate**

```bash
gh workflow run ee-ci.yml
gh run watch
```

- [ ] **Step 7.4: Set up runner auto-restart + log rotation** on `beastmode`

```bash
# systemd unit (if not already installed)
sudo systemctl status actions.runner.Acumenus-Data-Sciences-Parthenon-EE.beastmode.service
# logs:
journalctl -u actions.runner.Acumenus-Data-Sciences-Parthenon-EE.beastmode.service -f
```

---

## Task 8: GHCR namespace + cosign signing + SBOM

- [ ] **Step 8.1: Create the private GHCR namespace**

GHCR auto-creates the namespace on first push. We pre-create with a placeholder so permissions can be set immediately:

```bash
# Build a tiny placeholder
echo 'FROM scratch' > /tmp/Dockerfile.ee-placeholder
docker buildx build -t ghcr.io/acumenus-data-sciences/parthenon-ee-php:0.0.0-bootstrap -f /tmp/Dockerfile.ee-placeholder /tmp/
docker push ghcr.io/acumenus-data-sciences/parthenon-ee-php:0.0.0-bootstrap

# Set the package's visibility to PRIVATE
gh api -X PATCH /orgs/Acumenus-Data-Sciences/packages/container/parthenon-ee-php \
  --field visibility=private
```

- [ ] **Step 8.2: Generate a cosign key for image signing**

USER ACTION (Sanjay) — keys must be created on a trusted host, not in CI.

```bash
mkdir -p ~/.acumenus/cosign && cd ~/.acumenus/cosign
cosign generate-key-pair  # prompts for passphrase

# Save the passphrase + private key in your password manager.
# Store the private key OUTSIDE the repo. Never commit cosign.key.

# Add the public key + private key + passphrase as repo secrets
COSIGN_PUB=$(cat cosign.pub)
gh secret set COSIGN_PUBLIC_KEY -b "$COSIGN_PUB" -R Acumenus-Data-Sciences/Parthenon-EE
gh secret set COSIGN_PRIVATE_KEY -f cosign.key -R Acumenus-Data-Sciences/Parthenon-EE
gh secret set COSIGN_PASSWORD -b "<the passphrase>" -R Acumenus-Data-Sciences/Parthenon-EE
```

- [ ] **Step 8.3: Commit the public key into the repo for verification convenience**

```bash
mkdir -p .acumenus/cosign
cp ~/.acumenus/cosign/cosign.pub .acumenus/cosign/cosign.pub
git add .acumenus/cosign/cosign.pub
git commit -m "chore: commit cosign public key for image signature verification"
git push origin main
```

Verify with: `cosign verify --key .acumenus/cosign/cosign.pub ghcr.io/acumenus-data-sciences/parthenon-ee-php:<tag>`

- [ ] **Step 8.4: `.github/workflows/ee-release.yml`** — release pipeline

```bash
cat > .github/workflows/ee-release.yml <<'EOF'
name: EE Release (signed images + SBOM + GHCR push)

on:
  push:
    tags:
      - 'vEE-*'

jobs:
  release:
    runs-on: [self-hosted, beastmode]
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Install cosign + syft
        run: |
          go install github.com/sigstore/cosign/v2/cmd/cosign@latest
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b ~/bin

      - name: Build EE images
        run: |
          ./scripts/build-ee.sh --tag "${GITHUB_REF_NAME}" --push

      - name: Sign images with cosign
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
        run: |
          for svc in php nginx node python-ai operator license-server; do
            img="ghcr.io/acumenus-data-sciences/parthenon-ee-${svc}:${GITHUB_REF_NAME}"
            cosign sign --key env://COSIGN_PRIVATE_KEY -y "$img" || true
          done

      - name: Generate SBOMs (syft)
        run: |
          mkdir -p sboms
          for svc in php nginx node python-ai operator license-server; do
            img="ghcr.io/acumenus-data-sciences/parthenon-ee-${svc}:${GITHUB_REF_NAME}"
            ~/bin/syft "$img" -o spdx-json > "sboms/${svc}-${GITHUB_REF_NAME}.spdx.json" || true
          done

      - name: Attach SBOMs as cosign attestations
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
        run: |
          for svc in php nginx node python-ai operator license-server; do
            img="ghcr.io/acumenus-data-sciences/parthenon-ee-${svc}:${GITHUB_REF_NAME}"
            sbom="sboms/${svc}-${GITHUB_REF_NAME}.spdx.json"
            [ -f "$sbom" ] && cosign attest --key env://COSIGN_PRIVATE_KEY -y --predicate "$sbom" --type spdx "$img" || true
          done

      - name: Upload SBOMs as release artifacts
        uses: softprops/action-gh-release@v2
        with:
          files: sboms/*.spdx.json
EOF

git add .github/workflows/ee-release.yml
git commit -m "ci(ee-release): signed image build + SBOM on vEE-* tags"
git push origin main
```

- [ ] **Step 8.5: Validate by cutting a sample release**

```bash
git tag vEE-0.0.1-bootstrap -m "Bootstrap release — verifies signed image + SBOM pipeline"
git push origin vEE-0.0.1-bootstrap

# Watch the release run
gh run watch

# After it completes, verify
cosign verify --key .acumenus/cosign/cosign.pub ghcr.io/acumenus-data-sciences/parthenon-ee-php:vEE-0.0.1-bootstrap
gh release view vEE-0.0.1-bootstrap --json assets --jq '.assets[].name'
```

---

## Task 9: Branch protection + CODEOWNERS

- [ ] **Step 9.1: `.github/CODEOWNERS`** — every PR needs an Acumenus employee reviewer

```bash
cat > .github/CODEOWNERS <<'EOF'
# Every PR requires review by @Acumenus-Data-Sciences/maintainers.
# This is the IP-boundary enforcement: only Acumenus employees can
# approve EE code merges.

* @Acumenus-Data-Sciences/maintainers

# Higher-sensitivity paths require additional reviewers
.github/                      @Acumenus-Data-Sciences/maintainers
LICENSE-EE                    @Acumenus-Data-Sciences/maintainers
COMMERCIAL.md                 @Acumenus-Data-Sciences/maintainers
.acumenus/cosign/             @Acumenus-Data-Sciences/maintainers
scripts/sync-from-ce.sh       @Acumenus-Data-Sciences/maintainers
parthenon/                    @Acumenus-Data-Sciences/maintainers
EOF

git add .github/CODEOWNERS
git commit -m "chore: CODEOWNERS — Acumenus employees-only on EE"
git push origin main
```

- [ ] **Step 9.2: Add `@Acumenus-Data-Sciences/maintainers` team if not present**

USER ACTION:

```bash
gh api -X PUT orgs/Acumenus-Data-Sciences/teams/maintainers/repos/Acumenus-Data-Sciences/Parthenon-EE -f permission=admin
```

- [ ] **Step 9.3: Branch protection ruleset**

```bash
cat > /tmp/parthenon-ee-ruleset.json <<'EOF'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "exclude": [], "include": ["~DEFAULT_BRANCH"] } },
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          {"context": "Guard - EE never patches CE"},
          {"context": "CE test suite (against pinned subtree)"},
          {"context": "EE-specific test suite"},
          {"context": "Build EE container images (no push)"}
        ]
      }
    },
    {
      "type": "required_signatures"
    }
  ]
}
EOF

gh api -X POST repos/Acumenus-Data-Sciences/Parthenon-EE/rulesets --input /tmp/parthenon-ee-ruleset.json
```

- [ ] **Step 9.4: Verify**

```bash
gh api repos/Acumenus-Data-Sciences/Parthenon-EE/rulesets --jq '.[0] | {name, enforcement, rules: [.rules[].type]}'
```

---

## Task 10: Bootstrap the `enterprise/` directory tree (empty placeholders)

Plan 04 fills these in. For now, create empty placeholder dirs so the directory layout is visible:

```bash
mkdir -p enterprise/{backend/src/{Auth,Tenant,Crypto,Audit,License,Telemetry,Observability},frontend/src/features/admin-enterprise,ai/compliance,acropolis/{n8n,superset,datahub,wazuh,keycloak},k8s/{helm,kustomize},operator/crds,installer/phases,docs}

for d in enterprise/backend enterprise/frontend enterprise/ai enterprise/acropolis enterprise/k8s enterprise/operator enterprise/installer enterprise/docs; do
  echo "# Placeholder — Plan 04 fills this in." > "$d/README.md"
done

git add enterprise/
git commit -m "chore: bootstrap empty enterprise/ directory tree (placeholders for Plan 04)"
git push origin main
```

---

## Task 11: `docker-compose.ee.yml` — EE composition stub

Per Plan 02-08's compose contract, EE composition lives at the EE repo root and extends CE compose. Plan 04 actually adds services; for now a minimal stub validates the layering works.

```bash
cat > docker-compose.ee.yml <<'EOF'
# docker-compose.ee.yml — Parthenon EE composition (extends parthenon/docker-compose.yml).
#
# Usage:
#   docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml up -d
#
# This file is intentionally minimal at bootstrap; Plan 04 adds Keycloak,
# n8n, Superset, DataHub, Wazuh, FIPS-mode env vars, and signed-audit
# shipper sidecars. Plan 02-08's compose composition contract gates
# what changes are valid here.

services:
  # Bootstrap placeholder — Plan 04 replaces with real services.
  ee-license-server:
    container_name: parthenon-ee-license-server
    image: alpine:3
    command: sh -c 'echo "EE license server (placeholder for Plan 04)"; sleep infinity'
    networks:
      - parthenon

networks:
  parthenon:
    external: true
EOF

git add docker-compose.ee.yml
git commit -m "feat(compose): minimal docker-compose.ee.yml (Plan 04 fills in services)"
git push origin main
```

- [ ] **Step 11.1: Smoke** — verify the layered compose validates

```bash
docker compose -f parthenon/docker-compose.yml -f docker-compose.ee.yml config --quiet
echo "Exit: $?"
```

Expected: exit 0, no warnings.

---

## Task 12: `CHANGELOG-EE.md`

```bash
cat > CHANGELOG-EE.md <<'EOF'
# Parthenon Enterprise Edition — Changelog

EE follows independent semver: `vEE-MAJOR.MINOR.PATCH`. Each EE release pins a
specific CE version (recorded in `CE_VERSION`). EE may release more often than
CE for customer hotfixes.

## vEE-0.0.1-bootstrap (2026-05-XX)

Initial bootstrap release. Establishes the repository structure, sync tooling,
CI/CD pipelines, and signed image build process. No customer-functional
changes — placeholder license server only. Plan 04 ships the first real EE
features.

  - CE pin: <CE_SHA at bootstrap>
  - Container images: ghcr.io/acumenus-data-sciences/parthenon-ee-* (private)
  - Signed: cosign verify --key .acumenus/cosign/cosign.pub <image>
EOF

git add CHANGELOG-EE.md
git commit -m "docs: initial CHANGELOG-EE.md"
git push origin main
```

---

## Task 13: Sample customer install path (smoke)

The customer install flow is documented in the spec §6.5. Validate the basic mechanics here:

- [ ] **Step 13.1: Customer-side script (placeholder)**

Customers receive a `parthenon-ee install --license <key>` wrapper. Plan 04 builds the actual installer; for now a stub validates the GHCR pull path:

```bash
cat > scripts/sample-customer-install.sh <<'EOF'
#!/usr/bin/env bash
# Smoke test for customer install: pull EE image with a customer-scoped PAT.
#
# In production: customer receives a GHCR Personal Access Token scoped to
# their org. They run:
#   echo $CUSTOMER_PAT | docker login ghcr.io -u <customer-org> --password-stdin
#   ./scripts/sample-customer-install.sh

set -euo pipefail
TAG="${TAG:-vEE-0.0.1-bootstrap}"

echo "Pulling EE images at tag $TAG..."
for svc in php nginx node python-ai operator license-server; do
  docker pull "ghcr.io/acumenus-data-sciences/parthenon-ee-${svc}:${TAG}" || \
    echo "  (skipped: not yet published — placeholder release)"
done

echo "Verifying signatures..."
PUB=".acumenus/cosign/cosign.pub"
for svc in php nginx node python-ai operator license-server; do
  cosign verify --key "$PUB" "ghcr.io/acumenus-data-sciences/parthenon-ee-${svc}:${TAG}" 2>/dev/null && \
    echo "  $svc: signature OK" || \
    echo "  $svc: not signed yet"
done
EOF
chmod +x scripts/sample-customer-install.sh

git add scripts/sample-customer-install.sh
git commit -m "feat(scripts): sample-customer-install.sh smoke test"
git push origin main
```

---

## Task 14: Documentation index

- [ ] **Step 14.1: `enterprise/docs/index.md`** — entry point for customer-facing docs

```bash
cat > enterprise/docs/index.md <<'EOF'
# Parthenon Enterprise Edition Documentation

This is the customer-facing documentation entry point. The structure mirrors
`parthenon/docs/site/` (Docusaurus) for users transitioning from CE.

## Sections (TBD by Plan 04)

- Installation guide
- Keycloak SSO setup
- SAML / SCIM configuration
- Multi-tenancy onboarding
- FIPS deployment guide
- Signed audit log retention setup
- Datadog / Splunk integration
- Kubernetes operator usage
- Customer support runbook
EOF
```

- [ ] **Step 14.2: Architecture decision records folder**

```bash
mkdir -p enterprise/docs/adr
cat > enterprise/docs/adr/0001-overlay-vs-fork.md <<'EOF'
# ADR-0001-EE: Overlay (subtree) over fork or submodule

**Status:** Accepted (2026-05-XX)
**Context:** See `parthenon/docs/superpowers/specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md` §3.4.
**Decision:** Approach B — `git subtree`.
**Rationale:**
  - Single working tree → one IDE window, one test run, cross-cutting changes in one PR.
  - No `git submodule update --init` UX pain.
  - Subtree squash keeps EE history readable while preserving full CE history in the public repo.
  - Easy to migrate to packages (Approach C) later in v2.5.

**Trade-offs:**
  - Sync conflicts when CE deletes/renames a file EE depends on. Mitigated by the "EE never patches CE" rule.
  - `parthenon/` content appears in EE search results. Acumenus team learns to filter this; not a customer-facing concern (customers only get binaries).
EOF

git add enterprise/docs/
git commit -m "docs: customer-facing docs index + ADR-0001-EE"
git push origin main
```

---

## Task 15: End-to-end smoke

- [ ] **Step 15.1: Open a no-op PR to validate the full pipeline**

```bash
git checkout -b smoke/post-bootstrap-no-op
echo "" >> README.md
git commit -am "test: post-bootstrap pipeline smoke (no-op)"
git push -u origin smoke/post-bootstrap-no-op
gh pr create --title "test: post-bootstrap pipeline smoke" --body "Validating full CI on Parthenon-EE after bootstrap. Will close without merging." --draft
gh pr view --json statusCheckRollup
```

Expected:
- `Guard - EE never patches CE` ← PASS (no parthenon/ changes)
- `CE test suite (against pinned subtree)` ← PASS (runs full Parthenon Pest/Vitest/pytest against the pinned subtree on the self-hosted runner)
- `EE-specific test suite` ← PASS (tests are empty for now; the workflow itself runs)
- `Build EE container images (no push)` ← PASS

- [ ] **Step 15.2: Close without merging**

```bash
gh pr close --delete-branch
```

---

## Task 16: Notify maintainers and close Plan 03

- [ ] **Step 16.1: Add a top-level pinned issue summarizing the EE pipeline**

```bash
gh issue create --title "Parthenon-EE: bootstrap complete, pipeline live" \
  --body "## Bootstrap completed $(date -u +%Y-%m-%d)

- Repo private, default branch protected
- CE merged in via git subtree under \`parthenon/\` (pinned at <CE_SHA>)
- Daily sync workflow (\`.github/workflows/ce-sync.yml\`) running 06:00 UTC
- Self-hosted runner \`beastmode\` registered
- GHCR namespace \`ghcr.io/acumenus-data-sciences/parthenon-ee-*\` private
- cosign signing key live; public key at \`.acumenus/cosign/cosign.pub\`
- Sample release \`vEE-0.0.1-bootstrap\` published with signed images + SBOMs

## Plan 04 starts here

EE drivers, multi-tenancy, FIPS, observability, operator skeleton — all deferred to Plan 04 in \`Acumenus-Data-Sciences/Parthenon\` repo at \`docs/superpowers/plans/\`."
gh issue pin <issue-number>
```

---

## Plan 03 completion checklist

- [ ] `Acumenus-Data-Sciences/Parthenon-EE` private repo created and accessible
- [ ] CE merged in via `git subtree` at `parthenon/`
- [ ] `LICENSE-EE` placeholder, `COMMERCIAL.md`, `THIRD_PARTY_LICENSES.md`, private `README.md` published
- [ ] `scripts/sync-from-ce.sh`, `verify-no-ce-patches.sh`, `build-ee.sh` working
- [ ] Daily sync GH Action live; manual run succeeded
- [ ] EE CI workflow in place; runs on every PR
- [ ] Self-hosted runner `beastmode` online with `self-hosted` + `beastmode` labels
- [ ] Private GHCR namespace + cosign signing + SBOM generation working end-to-end
- [ ] Sample `vEE-0.0.1-bootstrap` release tagged and signed
- [ ] CODEOWNERS + branch protection ruleset enforce Acumenus-only review + signed commits + status checks
- [ ] `enterprise/` directory skeleton in place for Plan 04
- [ ] `docker-compose.ee.yml` validates against CE compose layering
- [ ] End-to-end smoke PR ran green and was closed cleanly

## Out of scope (deferred to Plan 04)

- Any Keycloak / SAML / SCIM / FIPS / multi-tenant / signed-audit / observability / operator code
- Moving Acropolis enterprise services from CE to EE
- Customer-facing installer beyond the smoke script
- License server implementation
- Customer onboarding documentation depth
- Revenue / billing tooling

*End of Plan 03.*
