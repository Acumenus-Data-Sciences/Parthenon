---
doc_type: plan
status: proposed
date: 2026-06-21
owner: acumenus
module: editions
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - acropolis/installer/editions.py
  - installer/license.py
  - backend/app/FeatureFlags/FeatureFlagResolver.php
  - backend/config/feature-flags.php
  - backend/app/Services/Agents/AgentProviderResolver.php
  - ai/app/config.py
  - docker/claude-router/Dockerfile
  - docker-compose.community.yml
  - acropolis/docker-compose.enterprise.yml
  - frontend/src/components/EnterpriseGate.tsx
related_docs:
  - LICENSING.md
  - acropolis/docs/editions.md
  - docs/lineage/plans/closed/2026-05-09-ce-ee-fork-plan-02-06-feature-flags-enterprise-gate.md
  - docs/lineage/plans/closed/2026-06-15-local-model-agent-backend-ce.md
related_prs: []
---

# Parthenon CE vs EE — Edition Differentiation & Gating Strategy

**Purpose.** (1) Comprehensively document how Parthenon's Community Edition (CE)
and Enterprise Edition (EE) are differentiated **today**, and (2) define and prove
the feasibility of a strategy change: **only EE gets the Acropolis stack services
and API-based frontier-model access via Claude Code; CE gets neither.**

---

## 0. Executive summary

Parthenon already ships a substantial dual-edition apparatus — an AGPL-3.0-only CE
in this repo and a commercial EE in a separate private repo — built across three
**independent and loosely-coupled** mechanisms:

| Axis | Mechanism | Where | Gated today? |
|---|---|---|---|
| **A. Acropolis infra tier** | Installer license key + `TIER_SERVICES` | `acropolis/installer/editions.py`, `installer/license.py` | **Weak** — installer-time only, *fails open*, compose `include:` is unconditional |
| **B. App capabilities / drivers** | Feature flags + 8 pluggable extension points | `backend/app/FeatureFlags/*`, `frontend/.../EnterpriseGate.tsx` | **Strong** — by code *omission* (EE drivers live only in the private EE repo) |
| **C. AI / frontier model** | Provider resolver + `claude-router` proxy | `AgentProviderResolver.php`, `ai/app/config.py`, `docker/claude-router/` | **None** — fully ungated; CE even *defaults* to Anthropic |

**The single most important finding:** there is **no runtime source of truth for
"which edition am I?"**. `PARTHENON_EDITION` is written into `.env` by the installer
(`installer/config.py:872`, default `community`) but **nothing in the running backend
or AI service reads it**. Edition-awareness today is *emergent* — it falls out of
which driver classes happen to be bound and which env flags an operator set.

**Verdict on the strategy.** It is **feasible and roughly 70% scaffolded.** Both
target capabilities already have the seams they need:

- The Acropolis CE/EE split already exists (`TIER_SERVICES`), and the compose
  composition contract already reserves `parthenon-ee-*` volumes for EE.
- The CE local-model agent backend (Qwen via `claude-router` → Ollama) **already
  shipped** (PR #365, 2026-06-16), so CE can run the *same* omnipresent Abby/Studies/
  Publish copilots without any cloud dependency.

What is missing is **enforcement and defaulting**, not capability. To make the
strategy "real going forward" we need: (1) a single authoritative edition/entitlement
signal consulted by all three axes; (2) an `ai.frontier` entitlement that forces CE
to the local provider and refuses the cloud provider; (3) the CE installer to default
AI to local and ship no Anthropic key; (4) a decision on Acropolis scope (see §6) and
moving the EE overlay to the private repo; (5) doc/legal alignment.

**One hard truth (read §7).** CE is **open source under AGPL-3.0**. You cannot DRM an
open-source binary — a determined operator has the source and can patch out any runtime
check. "Real" enforcement for an AGPL CE therefore rests on three pillars, in order of
strength: **(a) gate-by-omission** (never ship EE code, overlays, or keys in CE);
**(b) the managed/funded moat** (Acumenus-provided Anthropic access + a supported,
entitlement-bound Acropolis stack — absolute when *we* host it); and **(c) license/
contract** (AGPL + commercial terms). A runtime flag is the honest *default and UX*,
not a security boundary.

---

## 1. The edition & licensing frame

Source of truth: [`LICENSING.md`](../../../../LICENSING.md), `TRADEMARKS.md`,
[`acropolis/docs/editions.md`](../../../../acropolis/docs/editions.md).

| | Community Edition | Enterprise Edition |
|---|---|---|
| Repository | **this repo** (public) | separate **private** repo (`Acumenus-Data-Sciences/Parthenon-EE`) |
| License | **AGPL-3.0-only** (relicensed from Apache-2.0, ~2026-05) | **Commercial**, closed-source |
| Distribution | Free, self-managed | Paid, managed update path, SLA support |
| Contributor terms | CLA grants Acumenus the right to re-license contributions into EE | — |
| Trademarks | "Parthenon"/"Acumenus"/"Wellstack.ai" reserved; AGPL grants no trademark rights | — |
| Sales contact | — | `licensing@acumenus.net` |

AGPL §13 (the "network use" clause) is the key lever: a third party that modifies CE
and offers it over a network must publish their modifications. EE exists to serve
hospital systems, pharma sponsors, and government agencies that need additional
infrastructure, compliance, and support guarantees, and EE revenue funds CE.

`LICENSING.md` already enumerates the intended EE feature set: *"Keycloak SSO with
SAML/SCIM, multi-tenancy, FIPS 140-2 crypto, signed audit log retention,
Datadog/Splunk observability shippers, Kubernetes operator, n8n / Apache Superset /
DataHub / Wazuh integrations, premium support."* **Frontier-model access is not yet
named there** — adding it is part of this strategy (§9, Phase 5).

---

## 2. "Edition" is three independent axes, not one switch

This is the structural reality you must design around. The three axes do not share a
control plane today:

```
                         ┌─────────────────────────────────────────────┐
   installer writes ───► │ PARTHENON_EDITION  (cosmetic label, .env)    │  ◄── read by NOTHING at runtime
                         └─────────────────────────────────────────────┘

  Axis A  Acropolis tier        Axis B  App capabilities        Axis C  AI provider
  ───────────────────────       ───────────────────────        ───────────────────────
  editions.py TIER_SERVICES     FeatureFlagResolver +           AgentProviderResolver (PHP)
  + license.py key check        bound driver classes           + resolve_agent_provider (py)
  + app.enterprise_licenses     + EnterpriseGate (frontend)     + claude-router proxy (profile: ce)
  + acropolis/*.compose.yml     + 8 extension-point contracts   + agents.provider_mode setting

  Gated: installer-time,        Gated: by code OMISSION         Gated: NOT AT ALL
  fails OPEN, dumb include      (EE driver code not in CE)      (defaults to Anthropic even in CE)
```

The fix that unlocks the whole strategy is **collapsing this into one entitlement
resolver** that all three axes consult (§8, Phase 0).

---

## 3. What is identical in both editions (the platform baseline)

Everything that makes Parthenon a research platform is **CE baseline** and stays that
way. The full core application stack (`docker-compose.yml` + `docker-compose.community.yml`)
is identical between editions:

`nginx`, `php`, `postgres`, `redis`, `horizon`, `solr` (10 cores), `qdrant`,
`chromadb`, `python-ai`, `darkstar` (R/HADES), `hecate`, `shinyproxy`, `study-agent`,
`blackrabbit`, `fhir-to-cdm`, `orthanc`, `reverb`.

All 39 research modules — cohorts, analyses, Achilles/DQD, vocabulary, genomics,
imaging, GIS, HEOR, Studies, Publish, **the omnipresent Abby copilot UX** — are CE
baseline. CE auth drivers (`local`, `authentik-oidc`) are baseline and deliberately
*not* projected as feature flags (`FeatureFlagResolver.php:34`). The strategy in this
doc changes **only** the Acropolis infra layer (Axis A) and the AI *provider* (Axis C);
it does not remove any research capability from CE.

---

## 4. Comprehensive current-state differentiation matrix

### 4.A — Acropolis infrastructure (Axis A)

Acropolis is a **separate optional infra layer** (the `acropolis/` directory), distinct
from the core app stack. Edition definitions are canonical in
[`acropolis/installer/editions.py:47`](../../../../acropolis/installer/editions.py):

```python
TIER_SERVICES = {
    "community": ["traefik", "portainer", "pgadmin"],
    "enterprise": ["traefik","portainer","pgadmin",
        "n8n","superset","superset-worker","superset-beat","superset-db","superset-cache",
        "datahub-frontend","datahub-gms","datahub-mysql","datahub-opensearch","datahub-broker",
        "wazuh-manager","wazuh-indexer","wazuh-dashboard",
        "authentik-server","authentik-worker","authentik-db","authentik-redis"],
}
```

| Service group | CE Acropolis | EE Acropolis |
|---|---|---|
| Reverse proxy / SSL | Traefik | Traefik |
| Container mgmt | Portainer | Portainer |
| DB admin | pgAdmin | pgAdmin |
| Observability | Grafana + Prometheus/Loki/Alloy/cAdvisor/Node-Exporter¹ | same |
| Workflow automation | — | **n8n** |
| BI / analytics | — | **Apache Superset** (+ worker/beat/db/cache) |
| Data catalog & lineage | — | **DataHub** (frontend/gms/mysql/opensearch/kafka [+schema-registry/actions]) |
| Identity / SSO | — | **Authentik** (server/worker/db/redis) |
| Security / SIEM | — | **Wazuh** (manager/indexer/dashboard) |
| Kubernetes | — | **Helm chart + Kustomize `enterprise` overlay** |

¹ *Doc drift:* `editions.md` lists the 9-service CE observability set; `editions.py`
`TIER_SERVICES["community"]` enumerates only the 3 port-checked services. Versions also
drift (`editions.md` says Superset 4.1.2 / Authentik 2025.2; the live enterprise compose
pins Superset 6.0.0 / Authentik 2026.2.1). Reconcile as a cleanup item (§9, Phase 5).

**How it is gated today** ([`installer/license.py`](../../../../installer/license.py),
[`acropolis/installer/editions.py:90`](../../../../acropolis/installer/editions.py)):

1. Installer Phase 3 asks Community vs Enterprise (default Community).
2. Enterprise requires a key `ACRO-XXXX-XXXX-XXXX` → SHA-256 → looked up in
   `app.enterprise_licenses` (`key_hash`, `key_prefix`, `tier`, `org_name`,
   `activated_at`, `expires_at`); **one-time activation** stamps `activated_at`.
3. **It fails OPEN:** if the DB is unreachable, validation degrades to format-only and
   the install proceeds.
4. The compose layer is **"dumb":** `acropolis/docker-compose.yml` `include:`s base +
   community + enterprise + local **unconditionally** — there is no conditional include.
   The composition contract forbids conditional service definitions (variability only via
   `${VAR:-default}`).

**Net:** nothing at runtime stops a CE operator from running
`docker compose -f acropolis/docker-compose.enterprise.yml up`. Enforcement is
installer-time + honor system + commercial license. **Strength: WEAK.**

### 4.B — Application capabilities & pluggable extension points (Axis B)

Eleven feature-flag keys exist; CE ships **zero static flag entries**
([`backend/config/feature-flags.php:20`](../../../../backend/config/feature-flags.php)).
Flags are *derived at runtime* by
[`FeatureFlagResolver.php`](../../../../backend/app/FeatureFlags/FeatureFlagResolver.php)
from (1) which auth drivers are registered, (2) whether a non-`SingleTenantResolver` is
bound, and (3) the `agents.enabled` system setting.

| Flag key | Gates | Source | CE default |
|---|---|---|---|
| `auth.saml` | SAML SSO driver | EE | off (driver absent) |
| `auth.scim` | SCIM provisioning | EE | off |
| `auth.keycloak` | Keycloak OIDC driver | EE | off |
| `tenancy.multi` | Multi-tenant request routing | EE | off (`SingleTenantResolver`) |
| `audit.signed` | Signed WORM audit retention | EE | off (`DatabaseAuditSink`) |
| `observability.datadog` | Datadog shipper | EE | off |
| `observability.splunk` | Splunk shipper | EE | off |
| `observability.opentelemetry` | OTel shipper | EE | off |
| `crypto.fips` | FIPS 140-2 crypto provider | EE | off (`LaravelNativeCryptoProvider`) |
| `operator.k8s` | Kubernetes operator distribution | EE | off |
| `ai.agents` | Agent copilots on/off (provider-agnostic) | `system_settings.agents.enabled` | off until toggled |

**The 8 pluggable extension points** (from the closed `2026-05-09-ce-ee-fork-plan-02-*`
series). Each ships a CE default implementation *in this repo* behind an interface; the
EE implementation lives *only in the private EE repo* and is bound by an EE service
provider when the overlay is installed:

| Extension point | CE default (in this repo) | EE implementation (private repo) |
|---|---|---|
| AuthDriver | `local`, `authentik-oidc` | Keycloak, SAML, SCIM, step-up |
| TenantResolver | `SingleTenantResolver` (always tenant #1) | `MultiTenantResolver` |
| CryptoProvider | `LaravelNativeCryptoProvider` | `FipsCryptoProvider` |
| AuditSink | `DatabaseAuditSink` | `SignedAuditSink` (S3/Blob WORM) |
| ObservabilityShipper | no-op / local logging | Datadog / Splunk / OTel |
| FeatureFlags | derived, EE flags off | `EnterpriseFeatureFlagsProvider` flips flags on |
| Installer phase registry | core phases | EE phases (Keycloak, FIPS, observability) |
| Compose composition | base + community | `enterprise` overlay, `parthenon-ee-*` volumes |

**Frontend presentation** ([`EnterpriseGate.tsx`](../../../../frontend/src/components/EnterpriseGate.tsx)):
flags are fetched from `GET /api/v1/system/feature-flags` (unauthenticated) into a
Zustand store. `EnterpriseGate` renders one of three ways: **enabled** → children;
**disabled + unlocked** → hidden (fallback/null); **disabled + locked** → dimmed
children with an `EnterpriseBadge` upsell overlay.

**Net:** strong, because the actual EE capability code is **not present in the CE repo**.
The flags are advisory UI; the real gate is omission. **Strength: STRONG (by omission).**

### 4.C — AI / agents / frontier model (Axis C) — the weakest axis today

This is the axis the strategy most needs to change. The action-taking copilots
(Studies, Publish, Abby orchestrator) run the **Claude Agent SDK** inside `python-ai`,
which drives the `claude` CLI. The agent *loop* (9-tool in-process MCP server,
`can_use_tool` approval gating, Reverb streaming, HIGHSEC lockdown) is **model-agnostic
and lives in our code** — only *where the CLI sends requests* and *which tools are
auto-enabled* change between editions.

| Dimension | "EE" today (`anthropic`) | "CE" today (`local`) |
|---|---|---|
| Provider default | `agent_provider="anthropic"` (`ai/app/config.py:128`) | flip to `local` (claude-router) |
| Model | Claude Opus (config default `claude-opus-4-7`; chat/RAG uses `claude-sonnet-4-*`) | `qwen2.5-coder:32b` via Ollama |
| Transport | direct Anthropic API + `ANTHROPIC_API_KEY` | `http://claude-router:8787` (Anthropic→Ollama proxy) |
| Effort | `xhigh` | `medium` (local models break on high effort) |
| Write actions | always enabled | `agent_local_actions_enabled=false` by default |
| External cost | yes | $0 |
| Deploy of proxy | n/a | `claude-router` service, `profiles: ["ce"]` (`docker-compose.yml:286`) |

Provider selection precedence ([`AgentProviderResolver.php`](../../../../backend/app/Services/Agents/AgentProviderResolver.php)
+ [`config.py:187 resolve_agent_provider`](../../../../ai/app/config.py)): Laravel's
runtime `agents.provider_mode` (`cloud`/`local`/`auto`, **default `cloud`**) →
profile provider → env default. **There is no edition or entitlement check anywhere
in this path.**

The shipped CE-backend plan ([`2026-06-15-local-model-agent-backend-ce.md`](../closed/2026-06-15-local-model-agent-backend-ce.md),
PR #365) states the problem precisely:

> *"Nothing in the code gates this by edition — it is 'EE-only' purely because it
> depends on a funded Anthropic key."*

Two compounding gaps confirmed by inspection:

1. **Ungated:** any deployment can set `ANTHROPIC_API_KEY` (`backend/config/services.php`)
   and toggle `agents.provider_mode=cloud` via the super-admin UI
   (`AgentSettingsController`). No tier check.
2. **Not even CE-defaulted:** the installer does **not** set `AGENT_PROVIDER` or
   `agents.provider_mode` per edition (grep of `installer/` and `acropolis/installer/`
   returns nothing). A CE install therefore inherits the **`anthropic`/`cloud` default**.

**Strength: NONE.**

### 4.D — Consolidated CE vs EE matrix (target state in **bold**)

| Capability | CE today | EE today | CE target | EE target |
|---|---|---|---|---|
| Full research platform (39 modules) | ✅ | ✅ | ✅ | ✅ |
| Abby/Studies/Publish copilots (UX) | ✅ | ✅ | ✅ (local model) | ✅ |
| **Frontier model via Claude Code** | ⚠️ available & default | ✅ | **❌ removed/blocked** | ✅ |
| Local-model agent backend | ✅ (not default) | ✅ | ✅ **(default)** | optional |
| Acropolis base (Traefik/Portainer/pgAdmin/Grafana) | ✅ | ✅ | **decision (§6)** | ✅ |
| **Acropolis EE services (n8n/Superset/DataHub/Authentik/Wazuh)** | ⚠️ runnable | ✅ | **❌** | ✅ |
| SSO (SAML/SCIM/Keycloak) | ❌ | ✅ | ❌ | ✅ |
| Multi-tenancy / FIPS / signed audit / obs shippers | ❌ | ✅ | ❌ | ✅ |
| Kubernetes operator | ❌ | ✅ | ❌ | ✅ |
| License | AGPL-3.0 | Commercial | AGPL-3.0 | Commercial |

---

## 5. Enforcement reality check (how "real" is each gate?)

| Axis | Current enforcement | What stops a CE operator today | Strength |
|---|---|---|---|
| A — Acropolis | Installer license key, **fails open**; unconditional compose `include:` | Nothing technical at runtime; honor + license | **Weak** |
| B — App capabilities | EE driver code **absent** from CE repo; flags hide/lock UI | The capability genuinely isn't present | **Strong** |
| C — Frontier AI | None; `anthropic` is the default | Nothing — they just need a key | **None** |

The strategy's job is to lift Axis A to **Strong** and Axis C from **None** to the
strongest level AGPL allows (Medium on-prem / Absolute when managed).

---

## 6. Decision required — what does "CE gets no Acropolis stack" mean?

The phrase "Acropolis stack services" admits two readings. **This choice changes the
implementation; please pick one.**

**Option A — EE-only data-platform services (minimal change, already ~true).**
CE keeps the *base* Acropolis (Traefik reverse proxy/SSL, Portainer, pgAdmin, Grafana
+ observability). Only the value-add services (n8n, Superset, DataHub, Authentik, Wazuh)
become EE-only. This is essentially today's `TIER_SERVICES` split, just *enforced*.

**Option B — the entire Acropolis layer is EE-only (cleaner product story). ◄ recommended.**
"Acropolis" becomes synonymous with "the enterprise infrastructure product." CE ships
**only** the core app compose (`docker-compose.yml` + `docker-compose.community.yml`,
which already includes its own `nginx` for serving); the `acropolis/` runtime overlays
move to the private EE repo. CE operators who want a reverse proxy/monitoring bring
their own or use the bundled `nginx`.

| | Option A | Option B (recommended) |
|---|---|---|
| CE reverse proxy/SSL | Traefik (Acropolis base) | core `nginx` only; BYO proxy |
| CE monitoring | Grafana/Prometheus stack | none bundled |
| Product narrative | "Acropolis has a free tier" | **"Acropolis = the EE infra layer"** |
| Implementation | enforce existing `TIER_SERVICES` split | move `acropolis/` overlays to EE repo |
| Matches user intent "CE does **not** get Acropolis stack services" | partially | **fully** |

**Recommendation: Option B.** It matches the literal ask, gives the cleanest marketing
boundary, and maximizes gate-by-omission (the strongest enforcement for AGPL). It also
aligns with `LICENSING.md`, which already frames the Acropolis services as EE features.

---

## 7. Is it possible and real going forward? — the enforcement architecture

**Yes — with the enforcement model matched to each axis and to the AGPL reality.**

You cannot DRM open-source CE. Anyone with the AGPL source can delete a runtime check.
So "real" is built from three pillars, strongest first:

1. **Gate-by-omission (strongest).** Don't ship the capability in CE at all.
   - *Acropolis (Axis A):* move the `enterprise` overlay + EE installer phases to the
     private EE repo. A CE clone has no enterprise compose to run. **Works fully.**
   - *Frontier (Axis C):* **only partially possible.** The Claude Agent SDK must remain
     in CE because the *local* path reuses the exact same loop, pointed at `claude-router`.
     You cannot remove "the ability to reach Anthropic" without removing the local
     capability too. Therefore frontier cannot be gated by omission — it must be gated
     by **credential + entitlement + default** (pillars 2–3).

2. **The managed / funded moat (absolute when we host).** The real EE value is not code,
   it is the **funded Anthropic relationship + cost governance + a supported,
   entitlement-bound stack.** When Acumenus hosts/manages the deployment, enforcement is
   server-side and absolute (the operator never holds the key, and the entitlement is
   signed by us). `ai/app/config.py` already carries the cost-control primitives
   (`cloud_monthly_budget_usd`, alert thresholds, cutoff) — turn these into an EE-grade
   managed-frontier product.

3. **Entitlement default + license (honest, defeatable on-prem).** A runtime entitlement
   check that forces CE → local and refuses cloud, plus the AGPL + commercial license.
   This is the correct *default and UX* and the contractual boundary; it is defeatable by
   a determined on-prem operator, and that is acceptable because pillars 1–2 carry the
   weight.

**Conclusion:** the strategy is real to the maximum extent AGPL permits. Acropolis
becomes *strongly* real via omission (Option B). Frontier becomes *strongly* real for
the managed offering and *honestly defaulted + contractually* real on-prem. This is the
same posture every credible open-core company (GitLab, Elastic, etc.) operates under.

---

## 8. Assets already in place (why this is ~70% done)

- ✅ Dual-license legal foundation (`LICENSING.md`, `TRADEMARKS.md`, CLA).
- ✅ Acropolis CE/EE tier definitions + license-key infra (`editions.py`, `license.py`,
  `app.enterprise_licenses`, `generate_license_keys.py`).
- ✅ Compose composition contract reserving `parthenon-ee-*` volumes + a verifier
  (`scripts/verify_compose_contract.py`).
- ✅ Feature-flag system + `EnterpriseGate`/`EnterpriseBadge` upsell UI + 8 extension
  points with CE defaults.
- ✅ **CE local-model agent backend shipped** (PR #365): `claude-router` proxy
  (`profiles: ["ce"]`), `AgentProviderResolver`, `resolve_agent_provider`, write-action
  gating — the entire CE-without-cloud path exists and is tested.

What's missing is the unifying signal + enforcement + defaulting + the Acropolis move.

---

## 9. Go-forward implementation plan

### Phase 0 — One authoritative edition/entitlement signal *(unblocks everything)*
- Add an `entitlements` column (text/JSONB list, e.g. `["acropolis","ai.frontier","sso"]`)
  to `app.enterprise_licenses` (new migration); tier alone is too coarse.
- New `backend/app/Editions/EditionResolver.php` (+ `EditionServiceProvider`) that resolves
  `edition` and `entitlements` from the activated license row (falling back to CE / empty).
  Bind as a singleton; make `PARTHENON_EDITION` *actually consulted* here (or drop it).
- Expose entitlements through the existing `/api/v1/system/feature-flags` payload so the
  frontend gets one consistent signal.
- `ai/app/config.py`: read an `edition`/`entitlements` value (env injected by Laravel or
  installer) for Phase 1.

### Phase 1 — Frontier gating (Axis C)
- Add feature flag **`ai.frontier`** (EE) — distinct from `ai.agents` (CE, local).
- `AgentProviderResolver::resolveProvider()`: if `ai.frontier` is **not** entitled, return
  `PROVIDER_LOCAL` unconditionally and ignore a `cloud`/`anthropic` mode even if set.
- Mirror in `ai/app/config.py:resolve_agent_provider()`: reject `request_provider=anthropic`
  unless entitled; fall back to local.
- `AgentSettingsController`: refuse to persist `agents.provider_mode=cloud` without
  `ai.frontier`; surface a 403 + upsell.
- **CE installer**: set `AGENT_PROVIDER=local`, seed `agents.provider_mode=local`, deploy
  `claude-router` (`--profile ce`), and **provision no `ANTHROPIC_API_KEY`**.
- Frontend: wrap the provider-mode toggle and any "cloud" copy in `<EnterpriseGate
  flag="ai.frontier" showAsLocked>` (upsell badge).
- Tests: PHP (resolver forces local without entitlement), Python (`_options` never injects
  Anthropic endpoint without entitlement), Vitest (toggle locked in CE). All mock the client.

### Phase 2 — Acropolis gating (Axis A) — per §6 decision
- **If Option B (recommended):** move `acropolis/docker-compose.enterprise.yml`,
  `acropolis/docker-compose.community.yml`/base, and the enterprise installer phases into
  the private EE repo; CE ships only `docker-compose.yml` + `docker-compose.community.yml`.
- **If Option A or transitional:** keep overlays in-repo but make the license check
  **fail closed**, and add a runtime entitlement entrypoint that refuses to start the
  enterprise services without a valid `acropolis` entitlement.
- Either way: stop the fails-open behavior in `installer/license.py`.

### Phase 3 — Frontend upsell surfaces
- Add locked `EnterpriseGate` surfaces for the now-EE Acropolis links and frontier-AI
  controls, with `EnterpriseBadge` → `licensing@acumenus.net`.

### Phase 4 — Installer: one choice drives all three axes
- Edition selection in the installer must set: Acropolis tier **and** AI provider default
  **and** seed entitlements. Today it only sets the Acropolis tier.

### Phase 5 — Docs & legal alignment
- Add "API-based frontier-model access" and (Option B) "the Acropolis infrastructure
  layer" to the EE feature list in `LICENSING.md`.
- Reconcile `acropolis/docs/editions.md` drift (service list + versions) with `editions.py`
  and the live compose.
- Update `ROADMAP.md` and marketing copy.

### Phase 6 — CI guardrails
- Extend `scripts/verify_compose_contract.py` (or add a sibling) to assert: a CE build has
  **no** enterprise overlay, **no** `anthropic` AI default, and **no** committed Anthropic
  key. Fail CI on regression.

---

## 10. Risks & caveats

1. **AGPL is not DRM-able.** Mitigated by gate-by-omission (Acropolis) + the managed moat
   (frontier) + license. Accept that a determined on-prem operator can self-enable; that's
   the open-core bargain.
2. **The SDK stays in CE.** Frontier cannot be removed by omission (the local path reuses
   the SDK). Gate by entitlement + credential + default, not deletion.
3. **Fails-open license check** must become fail-closed for enterprise services.
4. **BYO-Anthropic-key policy.** Decide explicitly: does a CE operator's own key in a
   self-modified CE constitute a license violation? Document it in `LICENSING.md`.
5. **Don't break existing deployments.** Production (`parthenon.acumenus.net`) currently
   runs the cloud/Anthropic path. The migration must **seed an `enterprise` license row
   with `ai.frontier` + `acropolis` entitlements** for existing prod before flipping
   defaults, or it will silently drop to local. Verify end-to-end before deploy.
6. **Doc/version drift** between `editions.md`, `editions.py`, and the live compose — clean
   up in Phase 5 to avoid customer confusion.

---

## 11. File/line reference index

| Concern | File |
|---|---|
| Acropolis tier definitions | `acropolis/installer/editions.py:47` |
| License key validation (fails open) | `installer/license.py` |
| Edition label (cosmetic) | `installer/config.py:872` |
| Feature-flag config (CE = empty) | `backend/config/feature-flags.php:20` |
| Feature-flag resolver (derived flags) | `backend/app/FeatureFlags/FeatureFlagResolver.php` |
| Feature-flag API | `backend/app/Http/Controllers/Api/V1/System/FeatureFlagsController.php` |
| AI provider resolver (PHP, no edition check) | `backend/app/Services/Agents/AgentProviderResolver.php` |
| AI provider resolution (Python) | `ai/app/config.py:187` |
| AI defaults (Anthropic default) | `ai/app/config.py:117,128` |
| CE local-model proxy | `docker/claude-router/`, `docker-compose.yml:286` |
| Frontend gate | `frontend/src/components/EnterpriseGate.tsx` |
| Frontend flag contracts | `frontend/src/types/featureFlags.ts`, `frontend/src/contracts/featureFlags.ts` |
| Core CE app compose | `docker-compose.yml`, `docker-compose.community.yml` |
| EE Acropolis overlay | `acropolis/docker-compose.enterprise.yml` |
| Compose contract verifier | `scripts/verify_compose_contract.py` |
| Editions doc (drift) | `acropolis/docs/editions.md` |
| Licensing | `LICENSING.md` |
| CE local-agent plan (shipped) | `docs/lineage/plans/closed/2026-06-15-local-model-agent-backend-ce.md` |
| CE/EE fork plan series | `docs/lineage/plans/closed/2026-05-09-ce-ee-fork-plan-02-*.md` |
