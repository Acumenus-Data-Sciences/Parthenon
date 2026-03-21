# ADR-003: Laravel Sanctum Authentication with Temp Passwords and Forced Change

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon handles protected health information (PHI) under HIPAA and serves clinical researchers at healthcare organizations. The authentication system must balance security rigor with usability for non-technical clinical staff.

Traditional registration flows allow users to choose their own passwords at sign-up, which frequently results in weak, reused, or compromised credentials. The MediCosts paradigm -- proven in a prior production healthcare application -- removes self-chosen passwords entirely from the registration flow, instead generating server-side temporary passwords and delivering them via email.

The platform also requires role-based access control (RBAC) with fine-grained permissions across 16+ domains (cohorts, analyses, vocabulary, ingestion, GIS, studies, etc.) to enforce the principle of least privilege.

## Decision

Implement token-based authentication using Laravel Sanctum with the following flow:

1. **Registration:** User submits name, email, and optional phone number. No password field. The backend generates a 12-character temporary password (excluding ambiguous characters I, l, O, 0) and emails it via the Resend transactional email service through `TempPasswordMail`.

2. **Login:** User authenticates with email + temporary password. The API returns a Sanctum bearer token and a `must_change_password` flag. Tokens expire after 480 minutes (8 hours).

3. **Forced password change:** If `must_change_password` is true, the frontend renders a non-dismissable `ChangePasswordModal` that blocks all application access until the user sets a new password (minimum 8 characters, bcrypt 12 rounds).

4. **Super-admin onboarding:** The first super-admin user (`admin@acumenus.net`) sees a `SetupWizard` instead, which includes the password change step plus system configuration.

5. **Forgot password:** Public endpoint that generates a new temporary password, revokes all existing tokens, and emails the new temp password. Sets `must_change_password` to true.

6. **RBAC:** Spatie Laravel Permission provides role and permission management. Six roles (super-admin, admin, researcher, data-steward, mapping-reviewer, viewer) with 50+ granular permissions across 16 domains. New users receive the `viewer` role only.

7. **Email enumeration prevention:** Registration always returns the same success response regardless of whether the email already exists, preventing account enumeration attacks.

## Consequences

### Positive
- Users never choose weak passwords at registration -- the system-generated temp password forces a secure initial credential exchange
- The forced password change creates a verified, user-chosen password before any PHI access
- Non-dismissable modal prevents users from bypassing the password change requirement
- 8-hour token expiration limits the window of exposure if a token is compromised
- Spatie RBAC provides a mature, well-tested permission system with middleware integration
- Email delivery via Resend provides delivery tracking and bounce handling

### Negative
- Users must check email before first login, adding friction to the onboarding flow
- If email delivery fails (Resend outage, spam filtering), users are locked out with no self-service recovery other than the forgot-password flow
- The temp password is transmitted in plaintext via email, which is a known limitation of email-based credential delivery
- The 8-hour token expiration requires researchers to re-authenticate during long analysis sessions

### Risks
- Resend API key exposure would allow an attacker to send emails from `noreply@acumenus.net`. Mitigated by storing the key in `RESEND_KEY` environment variable with `chmod 600` on the `.env` file.
- The `must_change_password` flag is stored in the database -- if it were bypassed at the API level, the frontend modal could be circumvented. Mitigated by server-side middleware that checks the flag on protected routes.
- Spatie permission caching can cause stale permission checks after role changes. Mitigated by cache-clearing on role assignment.

## Alternatives Considered

1. **Self-chosen passwords at registration** -- The standard approach. Rejected because it consistently produces weak passwords in healthcare settings where users are not security-focused, and password strength meters are routinely ignored.

2. **OAuth2/OIDC with external identity provider** -- Delegate auth to Okta, Auth0, or institutional SSO. Considered for enterprise deployments but rejected as the default because many smaller research institutions lack an identity provider, and the platform must work standalone.

3. **Magic link (passwordless)** -- Email a login link instead of a password. Rejected because magic links have a short expiration window that conflicts with clinical workflows where email may not be checked immediately, and they do not establish a persistent password for API token generation.

4. **Laravel Passport (OAuth2)** -- Full OAuth2 server. Rejected because the platform does not need grant types (authorization code, client credentials) beyond simple token auth, and Sanctum's lightweight token approach is sufficient for an SPA + API architecture.

5. **JWT tokens (tymon/jwt-auth)** -- Stateless JWT authentication. Rejected because Sanctum's database-backed tokens allow immediate revocation (critical for the forgot-password flow that revokes all tokens), while JWTs require a blacklist mechanism that adds complexity.
