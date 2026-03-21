# Acropolis Editions

## Community Edition (Free, Open Source)

The Community Edition provides essential infrastructure tools for running Parthenon in a single-node deployment.

### Included Services

| Service | Version | Purpose |
|---------|---------|---------|
| Traefik | v3.3 | Reverse proxy with auto SSL |
| Portainer CE | 2.25.1 | Docker container management |
| pgAdmin 4 | 9 | PostgreSQL database administration |
| Grafana OSS | 11.4.0 | Monitoring dashboards |
| Prometheus | v3.1.0 | Metrics collection |
| Loki | 3.0.0 | Log aggregation |
| Alloy | v1.8.0 | Log & metric collection agent |
| cAdvisor | v0.51.0 | Container resource metrics |
| Node Exporter | v1.8.2 | Host system metrics |

### Best For
- Development and testing environments
- Small research teams (< 10 users)
- Single-server deployments
- Evaluation before enterprise commitment

---

## Enterprise Edition (Commercial License)

The Enterprise Edition adds advanced data platform capabilities for production deployments at scale.

### Additional Services

| Service | Version | Purpose |
|---------|---------|---------|
| n8n | Latest | Workflow automation (ETL, alerts, integrations) |
| Apache Superset | 4.1.2 | Business intelligence & data visualization |
| DataHub | v0.15.0 | Data catalog, lineage, governance |
| Authentik | 2025.2 | SSO, SAML, OIDC identity provider |

### Enterprise-Only Features

- **Kubernetes Deployment**: Helm charts and Kustomize overlays for multi-node HA
- **Unified SSO**: Authentik provides SAML/OIDC for all services including Parthenon
- **Data Lineage**: DataHub tracks data flow from OMOP CDM through analyses to reports
- **Automated Workflows**: n8n orchestrates data pipelines, quality checks, and alerts
- **Advanced Analytics**: Superset dashboards connected to OMOP CDM and Achilles results
- **Priority Support**: Direct access to Acumenus engineering team

### Best For
- Production deployments serving clinical researchers
- Multi-site OHDSI network nodes
- Organizations requiring SSO/SAML compliance
- Teams needing automated data quality monitoring
- Healthcare organizations with regulatory requirements

---

## Licensing

| | Community | Enterprise |
|--|-----------|------------|
| License | Apache 2.0 | Commercial |
| Source Code | Open | Open (services are OSS) |
| Support | Community/GitHub | Priority (SLA) |
| Pricing | Free | Contact sales@acumenus.net |
| Updates | Self-managed | Managed update path |
