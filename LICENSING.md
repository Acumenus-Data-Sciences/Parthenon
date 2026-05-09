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
