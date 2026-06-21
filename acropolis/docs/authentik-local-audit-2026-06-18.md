# Local Authentik Audit - 2026-06-18

## Runtime

- Compose project: `acropolis`
- Authentik image: `ghcr.io/goauthentik/server:2026.2.1`
- Containers: `acropolis-authentik-server`, `acropolis-authentik-worker`, `acropolis-authentik-db`, `acropolis-authentik-redis`
- Public issuer base used by local apps: `https://auth.acumenus.net`
- Local health endpoint verified: `http://localhost:9000/-/health/live/`

## Common Admin Model

The local Authentik install now uses one shared admin model for dockerized Acumenus apps:

- Superadmin group: `authentik Admins`
- App-admin compatibility groups: `Parthenon Admins`, `Aurora Admins`
- Common admin users: `admin`, `dmuraco`, `ebruno`, `gbock`, `jdawe`, `kpatel`, `sudoshi`
- Bootstrap-only Authentik superadmin user: `akadmin`

Live membership after bootstrap:

- `authentik Admins` is a superuser group and contains `admin`, `akadmin`, `dmuraco`, `ebruno`, `gbock`, `jdawe`, `kpatel`, `sudoshi`.
- `Parthenon Admins` contains `admin`, `dmuraco`, `ebruno`, `gbock`, `jdawe`, `kpatel`, `sudoshi`.
- `Aurora Admins` contains `admin`, `dmuraco`, `ebruno`, `gbock`, `jdawe`, `kpatel`, `sudoshi`.

The Acropolis installer persists these defaults in generated `.env` files as:

- `AUTHENTIK_SUPERADMIN_GROUP=authentik Admins`
- `AUTHENTIK_ADMIN_ALIAS_GROUPS=Parthenon Admins,Aurora Admins`
- `AUTHENTIK_COMMON_ADMIN_USERS=admin,dmuraco,ebruno,gbock,jdawe,kpatel,sudoshi`
- `AUTHENTIK_BOOTSTRAP_SUPERADMIN_USERS=akadmin`

## Apps To Keep

The embedded Authentik outpost is intentionally limited to forward-auth proxy providers:

- `alfresco` - Alfresco, `https://docs.acumenus.net`
- `grafana` - Grafana, `https://grafana.acumenus.net`
- `superset` - Apache Superset, `https://superset.acumenus.net`
- `datahub` - DataHub, `https://datahub.acumenus.net`
- `pgadmin` - pgAdmin, `https://pgadmin.acumenus.net`
- `portainer` - Portainer, `https://portainer.acumenus.net`
- `n8n` - n8n, `https://n8n.acumenus.net`
- `wazuh` - Wazuh SIEM, `https://wazuh.acumenus.net`

Native Acropolis SSO apps should also be kept:

- `grafana-oidc`
- `superset-oidc`
- `pgadmin-oidc`
- `portainer-oidc`
- `datahub-oidc`
- `wazuh-saml`
- `parthenon-oidc`

External/local companion apps seen in active repo/runtime configuration should be kept unless the app itself is being retired:

- `aurora-oidc`
- `acumenus-dataroom`
- `acumenus-dataroom-investors`
- `d2e-logto`
- `d2e`
- `salesops-billing`
- `salesops-books`
- `dev-portal`

## Delete Candidates

Do not delete these until the owning app is confirmed retired. They are candidates because no matching running local compose service was found or the current app path appears superseded.

- `openproject-oidc`
  - Launch URL: `https://projects.acumenus.net`
  - Evidence: no running OpenProject compose project or container was found during the local runtime inventory.

- `papermark-dataroom`
  - Launch URL: `https://dataroom.acumenus.net/login`
  - Evidence: no running Papermark compose project or container was found; only old Apache backup references were seen.

- `suitecrm-oidc`
  - Launch URL: `https://crm.acumenus.net`
  - Evidence: SuiteCRM files exist, but no running SuiteCRM container was found. Its provider also had broad property mappings attached, so inspect before preserving.

- `alfresco-keycloak-saml`
  - Evidence: current Alfresco overlay uses Authentik forward-auth headers directly. The old Keycloak/SAML bridge is no longer on the live Alfresco path.

- `alfresco-ldap`
  - Evidence: current Alfresco overlay uses `X-authentik-username` external auth and auto-created users. LDAP federation appears to be legacy unless the Keycloak prerequisites stack is still needed.

- `d2e`
  - Evidence: review only. D2E is active, but the local Logto bridge app `d2e-logto` is the cleaner current Authentik integration. Keep this if any Apache/front-door OIDC path still depends on it.

## Applied Consolidation

Acropolis:

- Added Alfresco to the idempotent Authentik forward-auth bootstrap so rerunning the installer no longer drops Alfresco from the embedded outpost.
- Added a shared OAuth2 `groups` scope mapping path and patched existing Acropolis OIDC providers to include `openid`, `profile`, `email`, and `groups`.
- Updated Grafana to map `authentik Admins`, `Parthenon Admins`, and `Aurora Admins` to `Admin`.
- Updated Superset to request `groups` and map those groups to the Superset `Admin` role.
- Updated DataHub and pgAdmin OIDC scopes to request `groups`.

Alfresco:

- Expanded `external.authentication.defaultAdministratorUserNames` to the common local admin usernames.

SalesOps:

- Expanded Lago and ERPNext Authentik admin email defaults to the common Authentik user emails:
  `admin@acumenus.net`, `dmuraco@acumenus.io`, `ebruno@acumenus.net`, `gbock@acumenus.net`, `jdawe@acumenus.io`, `kpatel@acumenus.net`, `sudoshi@acumenus.io`.
- Updated the SalesOps Authentik providers, Lago native callback, ERPNext social login, and Apache OIDC installer defaults to request `groups`.
- Live Lago bootstrap provisions those seven emails as active Lago admins.
- Live ERPNext Authentik configuration provisions those seven emails with `System Manager`, `Accounts Manager`, `Accounts User`, and `Sales Manager`.

Data Room:

- Default OIDC scopes now include `groups`.
- Operator login maps `authentik Admins` to `OWNER`.
- Operator login maps `Parthenon Admins` and `Aurora Admins` to `ADMIN`.
- Existing memberships are promoted when the group grants a higher role; the login flow does not demote users.

D2E:

- The Authentik Logto bootstrap now defaults to the common Authentik user set.
- It still supports the old single-user overrides `D2E_AUTHENTIK_LOGTO_USERNAME` and `D2E_AUTHENTIK_LOGTO_EMAIL`.
- It also supports `D2E_AUTHENTIK_LOGTO_USERS=username:email,username:email`.
- The live D2E run updated the Authentik app and Logto connector. D2E currently had local users for `admin` and `sudoshi`; both have the cloned local admin group set. The remaining common users will be mapped once their Logto/D2E user records exist.

## Validation

- `python3 -m compileall /home/smudoshi/Github/Parthenon/acropolis/installer`
- `docker compose -f /home/smudoshi/Github/Parthenon/acropolis/docker-compose.yml config --quiet`
- `docker exec acropolis-superset python -c "compile(open('/app/superset_config.py', 'rb').read(), '/app/superset_config.py', 'exec')"`
- Acropolis Authentik bootstrap completed successfully: 8 forward-auth providers and 7 native SSO providers.
- REST verification confirmed `groups` is present on `Grafana OIDC`, `Apache Superset OIDC`, `pgAdmin OIDC`, `DataHub OIDC`, `Portainer OIDC`, and `Parthenon OIDC`.
- REST verification confirmed `groups` is present on `SalesOps Billing OIDC`, `SalesOps Books OIDC`, and `Data2Evidence Logto OIDC`.
- Restarted/recreated affected containers: `grafana`, `datahub-frontend`, `pgadmin`, `superset`, `superset-worker`, `superset-beat`.
- Rebuilt/recreated `acumenus-dataroom-app`; the running container has `OIDC_SCOPES=openid profile email groups`.
- Recreated `alfresco`; the running container has `external.authentication.defaultAdministratorUserNames=admin,sudoshi,dmuraco,jdawe,ebruno,gbock,kpatel`.
- Rebootstrapped Lago and reinstalled the Lago Authentik native-login patch.
- Reconfigured ERPNext Authentik social login.
- Re-ran D2E Authentik Logto bootstrap.
- Post-restart health:
  - `acropolis-grafana`: healthy
  - `acropolis-datahub-frontend`: healthy
  - `acropolis-pgadmin`: healthy
  - `acropolis-superset`: healthy
  - `acropolis-superset-worker`: healthy
  - `acropolis-superset-beat`: healthy
  - `acumenus-dataroom-app`: healthy
  - `alfresco`: healthy
- Local endpoint checks:
  - `http://localhost:9002/` returned `200 OK`
  - `http://localhost:5050/` returned `302 FOUND` to login
  - `http://localhost:8089/health` returned `200 OK`
  - `http://127.0.0.1:18107/api/health` returned `{"status":"ok","service":"acumenus-dataroom"}`
  - `http://127.0.0.1:18081/alfresco/` returned `200 OK`
