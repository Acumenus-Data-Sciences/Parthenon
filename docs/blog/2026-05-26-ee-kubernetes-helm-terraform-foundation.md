---
doc_type: blog
status: active
date: 2026-05-26
owner: acumenus
module: blog
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - enterprise/helm/parthenon-ee
  - enterprise/terraform/modules/kubernetes-helm-release
  - enterprise/terraform/examples/existing-kubernetes
  - enterprise/terraform/modules/native-contract-runner
related_prs: []
slug: ee-kubernetes-helm-terraform-foundation
title: "Parthenon EE Kubernetes Foundation: A Second Deployment Lane"
description: "Parthenon Enterprise now has a Kubernetes deployment foundation: a Helm chart, a Terraform existing-cluster module, explicit native-vs-Kubernetes boundaries, validation gates, and a critical path toward EKS, AKS, and GKE."
authors: [mudoshi, claude]
tags: [development, enterprise, kubernetes, helm, terraform, devops, infrastructure]
---

Parthenon Enterprise Edition has crossed an important infrastructure
milestone: it now has a real Kubernetes deployment foundation.

This is not a marketing placeholder, and it is not a pile of disconnected YAML.
The new work establishes a second, deliberately separate deployment lane beside
the host-native VPS and bare-metal installer track. The native path remains
focused on non-Docker Linux hosts. The Kubernetes path now has its own
architecture, Helm chart, Terraform module, existing-cluster example, validation
evidence, and todo trail toward cloud-provider orchestration on AWS, Azure, and
GCP.

The point of this milestone is simple: Parthenon EE can support two very
different enterprise realities without letting them blur into one fragile
installer.

<!-- truncate -->

## Why this matters

Enterprise healthcare deployments rarely come in one shape.

Some teams want a single VPS or bare-metal host they can reason about directly:
system packages, systemd units, nginx, PHP-FPM, local PostgreSQL, Redis, Solr,
and a browser-reachable service. That is the native installer track. It matters
for hospitals, research groups, air-gapped environments, small teams, and
operators who need a direct Linux install without Docker or Kubernetes.

Other teams already run Kubernetes as their standard operating model. They
expect workloads to be packaged as containers, configured with Helm, deployed by
Terraform, connected to managed PostgreSQL and Redis, exposed by ingress, wired
to cloud secrets, and monitored through cluster-native controls. That is a
different product surface. It deserves a different deployment architecture.

The milestone this week is that Parthenon EE now has the beginning of that
second surface.

## The architectural decision

The key decision was to keep the deployment lanes separate:

```text
Native VPS / bare metal
  Terraform -> SSH -> native installer contracts -> Linux host

Kubernetes
  Terraform -> Kubernetes API -> Helm release -> container workloads
```

That split sounds obvious, but it is easy to get wrong. Terraform can be abused
into a second installer. Helm can be forced to run host-level bootstraps it was
never meant to own. A native installer can quietly grow Kubernetes assumptions.
All three paths lead to a support problem.

The architecture now draws a hard boundary.

The native track owns:

- operating-system capability detection
- package-manager differences
- filesystem layout
- service users and groups
- nginx and PHP-FPM host configuration
- systemd units
- local PostgreSQL, Redis, and Solr policy
- host-native health, backup, and restore contracts
- LAN and public browser exposure for VPS installs

The Kubernetes track owns:

- Kubernetes namespace and workload manifests
- packaged EE PHP and nginx images
- Deployments, Services, Ingress, Jobs, CronJobs, PVCs, probes, labels, and
  resource requests
- external dependency wiring for PostgreSQL, Redis, and Solr
- image pull secrets and runtime Secret references
- Helm release lifecycle
- future EKS, AKS, and GKE orchestration through shared Terraform modules

That is the foundation for a maintainable enterprise platform: two deployment
lanes, one product, no accidental overlap.

## What shipped

The first Kubernetes foundation landed as a focused EE branch with four main
parts.

```text
enterprise/
  helm/
    parthenon-ee/
      Chart.yaml
      values.yaml
      values.schema.json
      templates/
  terraform/
    modules/
      kubernetes-helm-release/
    examples/
      existing-kubernetes/
  docs/
    kubernetes-helm-terraform-architecture.md
    kubernetes-helm-terraform-todo.md
```

The branch does not try to solve every cloud production question in one pass.
That restraint is intentional. The milestone is a foundation that can be
validated, reviewed, and extended.

## The Helm chart

The chart is named `parthenon-ee`. It targets the packaged Enterprise images:

```text
ghcr.io/acumenus-data-sciences/parthenon-ee-php:<tag>
ghcr.io/acumenus-data-sciences/parthenon-ee-nginx:<tag>
```

The chart models the core application runtime:

- PHP-FPM application deployment
- nginx/frontend/docs/OHIF deployment
- Horizon worker deployment
- Reverb websocket deployment
- scheduler CronJob
- migration Job
- runtime ConfigMap
- optional runtime Secret creation for local drills
- PVCs for Laravel storage and bootstrap cache
- optional Ingress
- optional HPAs
- resource requests and memory limits
- readiness and liveness probes
- image pull secret support

The chart is not pretending that Kubernetes production is just Compose in a
different syntax. It uses a Kubernetes-specific nginx template so it does not
depend on Docker's embedded DNS resolver. It renders Kubernetes Services for
the app workloads. It separates static frontend/docs/OHIF serving from PHP-FPM,
while keeping the existing Parthenon routing model intact.

The first chart also records one explicit compatibility bridge:

```yaml
composeCompatibleServiceNames: true
```

The packaged nginx image historically expects upstream names such as `php` and
`reverb`. The chart therefore defaults to short service names within the target
namespace. That is acceptable for one Parthenon EE release per namespace and
gets us to a testable first deployment faster.

It is not the final word. The todo already tracks the production decision:
either prove release-scoped service names with a Kubernetes-native nginx
template, or document one release per namespace as the supported service-name
model.

## External state by default

The chart deliberately does not bundle PostgreSQL, Redis, or Solr as the
production default.

That is one of the most important decisions in the milestone.

For serious enterprise Kubernetes deployments, stateful services should usually
be operated independently:

- PostgreSQL on RDS, Azure Database for PostgreSQL, Cloud SQL, or a dedicated
  operator-managed database
- Redis on ElastiCache, Azure Cache for Redis, Memorystore, or an equivalent
  managed/cache service
- Solr as a managed or separately operated search tier with persistent storage,
  core bootstrap, backup, and performance tuning
- object storage on S3, Azure Blob, GCS, or an S3-compatible service

In-cluster PostgreSQL, Redis, and Solr can be useful for development and
staging. They should not become the default enterprise production story.

The chart values reflect that:

```yaml
database:
  host: postgres.example.invalid
  port: 5432
  database: parthenon
  username: parthenon

redis:
  host: redis.example.invalid
  port: 6379

solr:
  mode: external
  url: http://solr.example.invalid:8983/solr
```

This keeps the first chart honest. It deploys application workloads and expects
production state to be managed with production-grade tools.

## The Terraform module

The Terraform foundation is a shared module named
`kubernetes-helm-release`.

Its job is intentionally narrow:

- create or target a namespace
- assemble base Helm values
- pass image tag, endpoint, ingress, Secret, and persistence settings
- install or upgrade the Helm release
- expose release status and application URL outputs

It does not create a cluster. It does not create a database. It does not create
Redis or Solr. It does not generate application secrets. That work belongs to
provider-specific modules and secret-management tooling.

The module boundary looks like this:

```hcl
module "parthenon_ee" {
  source = "../../modules/kubernetes-helm-release"

  release_name        = "parthenon-ee"
  namespace           = "parthenon-ee"
  image_tag           = "vEE-0.1.0"
  app_url             = "https://parthenon.example.com"
  runtime_secret_name = "parthenon-ee-runtime"

  database_host     = "postgres.example.internal"
  database_name     = "parthenon"
  database_username = "parthenon"

  redis_host = "redis.example.internal"
  solr_url   = "http://solr.example.internal:8983/solr"
}
```

That is the contract future cloud modules should call after they provision
infrastructure.

## Existing cluster first

The first example is intentionally `existing-kubernetes`, not `aws-eks`,
`azure-aks`, or `gcp-gke`.

That ordering is deliberate. Before we encode AWS, Azure, or GCP assumptions,
we need a provider-neutral deployment that proves the application shape:

- the chart renders
- Terraform can install it
- runtime Secrets are referenced correctly
- image pull secrets work
- migrations run
- probes behave
- ingress routes traffic
- PHP, nginx, Horizon, scheduler, Reverb, Redis, PostgreSQL, and Solr all line
  up

The existing-cluster example also becomes the inner module that cloud-specific
orchestration wraps. EKS, AKS, and GKE should not each invent their own
Parthenon release logic. They should provision their cloud resources and then
call the shared Kubernetes Helm module.

## Secrets are not values

The chart can create a Kubernetes Secret for local drills, but the default is
to reference an existing Secret:

```yaml
secrets:
  create: false
  existingSecret: parthenon-ee-runtime
```

Expected keys include:

- `APP_KEY`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `LICENSE_TOKEN`
- `PARTHENON_INTERNAL_TOKEN`
- `ORTHANC_AUTH_HEADER` when Orthanc proxying is enabled

That choice is about production hygiene. Terraform state is not where
application secrets should live by default. The production path should use
External Secrets, Sealed Secrets, SOPS, a cloud secret sync, or a similarly
auditable secret-management system. Terraform can name the Secret. Kubernetes
can mount it. A dedicated secret tool should own its contents.

## The release image policy

The chart defaults to `latest` only because a chart needs a development
default. Production deployments should pass an explicit EE release tag:

```text
vEE-0.1.0
```

That matters because EE release traceability is tied to two artifacts:

- the Enterprise release tag used for the packaged EE images
- the Community Edition source and runtime image pin embedded in those images

The Kubernetes deployment path should eventually verify the deployed image
digests against release provenance metadata. That is already tracked in the
todo. The principle is clear: a production cluster should not be a mystery
about what it is running.

## Validation completed

This milestone was not committed as unchecked scaffolding. The branch was
validated locally before it was pushed.

The Helm chart passed:

```bash
helm lint enterprise/helm/parthenon-ee
helm template parthenon-ee enterprise/helm/parthenon-ee \
  --set ingress.enabled=true \
  --set 'ingress.hosts[0].host=parthenon.example.com' \
  --set 'ingress.hosts[0].paths[0].path=/' \
  --set 'ingress.hosts[0].paths[0].pathType=Prefix'
```

The chart lint passes with only Helm's non-blocking icon recommendation.

The Terraform module and example passed:

```bash
terraform fmt -check -recursive enterprise/terraform

cd enterprise/terraform/modules/kubernetes-helm-release
terraform init -backend=false
terraform validate

cd ../../examples/existing-kubernetes
terraform init -backend=false
terraform validate
```

Additional checks passed:

```bash
yamllint enterprise/helm/parthenon-ee/Chart.yaml \
  enterprise/helm/parthenon-ee/values.yaml

python3 -m json.tool enterprise/helm/parthenon-ee/values.schema.json
git diff --check
./scripts/verify-no-ce-patches.sh pr
graphify update .
```

Two small issues were caught and fixed during validation:

- The first Terraform module draft used the older Helm provider v2 nested
  `set` block style. Local validation resolved Helm provider v3, where `set`
  and `set_sensitive` are attributes. The module now pins and uses the v3 API.
- Helm lint rejected a multi-PVC template separator even though the chart
  rendered. Splitting storage and bootstrap-cache PVCs into separate template
  files removed the ambiguity.

Those are exactly the kind of defects a foundation branch should catch early,
before provider modules multiply the pattern.

## What this does not claim yet

This is a milestone, not a production-complete declaration.

It does not yet claim:

- a successful live Kubernetes install
- EKS, AKS, or GKE module support
- managed PostgreSQL provisioning
- managed Redis provisioning
- managed Solr provisioning
- external secret backend integration
- ingress/TLS automation for every cloud
- Kubernetes backup and restore coverage
- production network policy
- pod disruption budgets
- cost sizing
- full observability guidance

Those are not omissions. They are the next phases, written down explicitly
instead of hidden in a conversation.

## The critical path from here

The todo now tracks a clear sequence.

First, add CI gates:

- Helm lint
- Helm render with production-like values
- Terraform formatting
- Terraform validation for both native and Kubernetes modules

Second, run a disposable cluster drill:

- create namespace
- create runtime Secret
- create image pull Secret
- connect to external PostgreSQL
- connect to external Redis
- connect to external Solr
- apply the existing-cluster Terraform example
- capture `kubectl get pods`, `kubectl get jobs`, describes, and targeted logs

Third, smoke the app through the configured ingress:

- `/api/health`
- `/`
- `/login`
- `/docs/`
- `/ohif/`
- Reverb websocket route `/app/`
- Horizon queue behavior
- scheduler execution
- Solr-backed vocabulary or search flow

Fourth, add provider modules:

- AWS EKS
- Azure AKS
- GCP GKE
- self-managed Kubernetes

Each provider module should provision its cloud resources and then call the
same shared Helm release module. The cloud modules should not fork the app
deployment logic.

Fifth, close the operations story:

- backup scope
- restore into a clean namespace
- Helm upgrade and rollback
- image provenance verification
- secret backend examples
- network policy
- pod disruption budgets
- observability
- cloud cost and sizing guidance

## Why this is a real platform step

The milestone matters because it changes Parthenon EE from a project with one
primary server deployment model into a project with a clean deployment
portfolio.

The single-host path remains important. We have invested heavily in native
preflight, validation, package capabilities, Solr execution, Laravel bootstrap,
nginx exposure, systemd persistence, backup, restore, and Terraform orchestration
for VPS and bare metal. That work is still the right path for non-Docker hosts.

Kubernetes is a different operating model. It needs Helm charts, cloud
Terraform, external state, secret integration, ingress, registry policy,
cluster probes, autoscaling, and provider-specific infrastructure. It now has a
place to grow without distorting the native installer.

That is the achievement: not just "we added Helm," but "we created a deployment
architecture that can support both bare-metal/VPS installs and cloud-native
Kubernetes installs without confusing the responsibilities of either one."

## The principle going forward

The rule is now clear:

```text
Terraform provisions infrastructure.
Helm deploys Kubernetes workloads.
Native installer contracts configure Linux hosts.
Laravel remains the application authority.
Managed services own production state.
Secret systems own secrets.
Validation evidence decides readiness.
```

That is the kind of boundary that makes future work faster. It lets one team
continue hardening the native installer while another builds EKS, AKS, and GKE
modules. It gives reviewers a concrete contract. It gives operators a clear
mental model. It gives the release process a place to attach provenance,
validation, and rollback evidence.

Parthenon EE now has the foundation for Kubernetes. The next milestone is to
prove it in a disposable cluster, then lift the same shared module into AWS,
Azure, and GCP.
