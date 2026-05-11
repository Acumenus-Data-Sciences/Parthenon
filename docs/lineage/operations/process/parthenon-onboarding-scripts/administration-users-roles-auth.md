# V9 — Administration: Users, Roles, Auth

| Field | Value |
|---|---|
| **Video ID** | V9 |
| **Title** | Administration: Users, Roles, Auth |
| **Duration** | 8 minutes |
| **Audience** | System administrators, IT security teams, Parthenon admins |
| **Prerequisites** | Parthenon admin-level access |

---

## Learning Objectives

By the end of this tutorial you will be able to:

1. Create, edit, and deactivate user accounts.
2. Understand Parthenon's role-based access control model and the default permission matrix.
3. Assign roles to users and customize role permissions.
4. Configure external authentication via LDAP and OIDC (OpenID Connect).
5. Review audit logs for user activity and access changes.

---

## Section Timestamps

| Timestamp | Section |
|---|---|
| 0:00 – 0:35 | Introduction |
| 0:35 – 2:00 | User management: CRUD operations |
| 2:00 – 3:30 | Roles & the permission matrix |
| 3:30 – 5:30 | LDAP configuration |
| 5:30 – 7:00 | OIDC configuration |
| 7:00 – 7:30 | Audit logs |
| 7:30 – 8:00 | Recap & next steps |

---

## Script

### 0:00 – 0:35 · Introduction

**Narration:**

> As a Parthenon administrator, you control who can access the platform and what they can do. This tutorial covers the full administration workflow — managing users, configuring roles and permissions, setting up external authentication, and reviewing audit trails. Let's start in the Administration module.

**Screen action:** Title card → Parthenon Administration module.

---

### 0:35 – 2:00 · User Management: CRUD Operations

**Narration:**

> Navigate to **Administration** → **Users**. The user list shows all accounts — active and inactive — with their name, email, role, last-login timestamp, and status. To create a new user, click **+ Add User**. Fill in the required fields: name, email, and initial role. If you're using local authentication, set a temporary password — the user will be prompted to change it at first login. Click **Create**. The user now appears in the list. To edit a user, click their row — you can update their name, email, role, or status. To deactivate an account — say, when someone leaves the organization — toggle the status to Inactive. Deactivated users cannot log in but their audit history is preserved. You should never delete a user account; always deactivate.

**Screen action:**

1. Administration → Users → user list table.
2. Click **+ Add User** → form appears.
3. Fill in: Name = "Jane Doe," Email = "jane.doe@example.com," Role = "Analyst."
4. Set temporary password.
5. Click **Create** → user appears in list.
6. Click the user row → edit panel opens.
7. Toggle status to **Inactive** → confirm dialog → status badge changes.

**Callout:** _Deactivation preserves audit integrity. All cohort definitions, analyses, and actions attributed to that user remain traceable._

---

### 2:00 – 3:30 · Roles & the Permission Matrix

**Narration:**

> Parthenon ships with four default roles: **Viewer**, **Analyst**, **Developer**, and **Admin**. Each role has a set of permissions mapped in a matrix. Viewers can browse cohorts, concept sets, and analysis results but cannot create or modify anything. Analysts can create and edit cohort definitions and run analyses. Developers have Analyst permissions plus the ability to configure data sources and run Achilles and DQD. Admins have full access including user management, role configuration, and system settings. Open the **Roles** tab to see the permission matrix. Each row is a permission — "Create Cohort," "Run Analysis," "Manage Users," etc. — and each column is a role. You can customize these by toggling individual permission cells. For example, if you want Analysts to run DQD, enable that permission for the Analyst role.

**Screen action:**

1. Click **Roles** tab → permission matrix loads.
2. Columns: Viewer, Analyst, Developer, Admin. Rows: individual permissions.
3. Scroll through the matrix — show the pattern of checkmarks.
4. Click the "Run DQD" row × "Analyst" column → toggle on → save.
5. Show a confirmation toast: "Role permissions updated."

**Callout:** _Follow the principle of least privilege. Start users with the Viewer or Analyst role and elevate only when needed. You can always create custom roles for specialized access patterns._

---

### 3:30 – 5:30 · LDAP Configuration

**Narration:**

> Most organizations don't want to manage Parthenon passwords separately — they want single sign-on via their existing directory. Let's configure LDAP first. Navigate to Administration → **Authentication** → **LDAP**. Enter your LDAP server URL, the bind DN and password for the service account Parthenon will use to query the directory, and the base DN where user accounts live. Map the LDAP attributes: "uid" or "sAMAccountName" for the username, "mail" for email, "cn" for display name. Parthenon also supports group-based role mapping — you can map an LDAP group like "Parthenon-Analysts" to the Analyst role. This way, when a user authenticates via LDAP, their Parthenon role is automatically assigned based on their directory group membership. Click **Test Connection** to verify, then **Save**.

**Screen action:**

1. Authentication → **LDAP** tab.
2. Fill in: Server URL = `ldaps://ldap.example.com:636`.
3. Bind DN = `cn=parthenon-svc,ou=services,dc=example,dc=com`.
4. Base DN = `ou=users,dc=example,dc=com`.
5. Attribute mappings: username = `sAMAccountName`, email = `mail`, name = `cn`.
6. Group mapping: `Parthenon-Analysts` → Analyst role.
7. Click **Test Connection** → ✅ "Connection successful, 342 users found."
8. Click **Save**.

**Callout:** _Always use LDAPS (port 636) — never unencrypted LDAP — for production environments. Parthenon's LDAP connector supports TLS certificate verification._

---

### 5:30 – 7:00 · OIDC Configuration

**Narration:**

> If your organization uses an identity provider like Okta, Azure AD, or Keycloak, you can configure OpenID Connect instead of or alongside LDAP. Navigate to **Authentication** → **OIDC**. Enter the issuer URL — this is the base URL of your identity provider's OIDC discovery endpoint. Parthenon will auto-discover the authorization, token, and userinfo endpoints from the well-known configuration. Enter the client ID and client secret you registered with your identity provider. Set the redirect URI to your Parthenon instance's callback URL — it's displayed on this page for convenience. Map claims to Parthenon fields: "sub" or "preferred_username" for username, "email" for email, and optionally "groups" for role mapping. Click **Test** to initiate a test login flow — your browser will redirect to the identity provider, authenticate, and return. If the test succeeds, click **Save** and OIDC is live. Users will now see a "Sign in with SSO" button on the login page.

**Screen action:**

1. Authentication → **OIDC** tab.
2. Issuer URL = `https://login.example.com/realms/corporate`.
3. Client ID and Client Secret filled in (masked).
4. Redirect URI displayed: `https://parthenon.example.com/auth/callback`.
5. Claim mappings: username = `preferred_username`, email = `email`, groups = `groups`.
6. Click **Test** → browser redirects to IdP login → authenticate → redirects back → ✅ "OIDC test successful."
7. Click **Save**.

**Callout:** _You can enable both LDAP and OIDC simultaneously. This is useful during a migration from LDAP to OIDC — users can authenticate with either method during the transition._

---

### 7:00 – 7:30 · Audit Logs

**Narration:**

> Every action in Parthenon is logged. Navigate to Administration → **Audit Logs** to see a time-ordered feed of events: user logins, cohort creations, analysis executions, role changes, and more. Each entry shows the timestamp, the user, the action, and the affected object. You can filter by user, action type, or date range. Export the logs as CSV for compliance reporting. For regulated environments, this audit trail is essential for demonstrating data governance and access control.

**Screen action:**

1. Administration → **Audit Logs** → feed loads.
2. Show entries: "jane.doe logged in via OIDC," "jane.doe created cohort 'T2DM – First Diagnosis'," "admin changed role for jane.doe to Developer."
3. Apply filter: user = "jane.doe" → filtered view.
4. Click **Export CSV**.

**Callout:** _Audit logs are immutable — they cannot be edited or deleted by any user, including admins. This ensures a tamper-proof record._

---

### 7:30 – 8:00 · Recap & Next Steps

**Narration:**

> You now know how to manage users, configure roles and permissions, set up LDAP and OIDC authentication, and review audit logs. A well-configured administration layer is the foundation for a secure, governed analytics platform. In our final tutorial, V10, we'll cover a Parthenon-specific feature — the AI-powered concept mapping review queue, where machine learning assists with vocabulary curation at scale.

**Screen action:** Recap bullets animate. End card links to V10.

---

## Production Notes

- **Credential masking:** Ensure all passwords, secrets, and real directory details are masked or use example domains (example.com).
- **LDAP/OIDC testing:** If live IdP is not available, mock the test-connection response and note it's simulated.
- **Audit log entries:** Pre-populate with realistic entries before recording.
- **Screen resolution:** 1920 × 1080 at 100% zoom.
- **Callout style:** Lower-third blue banner, 4-second hold, fade-out.
