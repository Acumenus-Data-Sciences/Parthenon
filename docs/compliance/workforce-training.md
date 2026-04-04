# Parthenon Workforce Security Awareness Training

**Document ID:** PARTH-WT-001
**Effective Date:** 2026-04-04
**Owner:** Sanjay Mudoshi
**Review Cycle:** Annual (next review: 2027-04-04)
**Status:** Active
**Framework References:** HIPAA §164.308(a)(5)(i), NIST SP 800-53 AT-1 through AT-4

---

## 1. Purpose

This document establishes the security awareness training program for all personnel who access the Parthenon outcomes research platform or any systems containing ePHI. It defines required training topics, training delivery methods, and maintains a record of training completion. HIPAA requires that covered entities implement a security awareness and training program for all members of the workforce.

---

## 2. Scope

This program applies to all individuals with access to Parthenon, including:
- System administrators and developers
- Researchers with `researcher` role access
- Data stewards with `data-steward` role access
- Any future workforce members, contractors, or collaborators granted system access

---

## 3. Training Requirements

### 3.1 Initial Training

All new users must complete security awareness training before being granted access beyond the `viewer` role. Training must cover the topics in §4 and be documented in the completion log (§6).

### 3.2 Annual Refresher

All personnel with active Parthenon accounts must complete refresher training annually. Refresher training covers any updates to policies, new threats, and lessons learned from incidents.

### 3.3 Event-Triggered Training

Additional training is required within 30 days when:
- A security incident occurs (lessons learned from the incident)
- Significant policy changes are implemented
- New data sources containing ePHI are onboarded
- New system capabilities are deployed that affect ePHI handling

---

## 4. Training Topics

### 4.1 Core Topics (Required for All Personnel)

**Topic 1: What Is ePHI and Why It Matters**
- Definition of electronic Protected Health Information under HIPAA
- Examples of ePHI in Parthenon: OMOP CDM person, visit, drug, condition, procedure, measurement, observation, note, and death tables; DICOM medical images; any data linkable to a patient
- Data classification levels: ePHI (Critical), Sensitive, Internal, Public
- Legal obligations: HIPAA Privacy Rule, Security Rule, Breach Notification Rule
- Penalties for HIPAA violations: civil penalties up to $2.1M per violation category per year; criminal penalties up to $250K and 10 years imprisonment for knowing misuse

**Topic 2: Access Control and Authentication**
- How Parthenon authentication works: Sanctum bearer tokens, 8-hour expiry
- The registration and password flow: temp password → forced change → access
- Password requirements: minimum 8 characters, bcrypt hashed
- Role hierarchy: super-admin, admin, researcher, data-steward, mapping-reviewer, viewer
- Why new users get `viewer` role only and how to request elevated access
- Never share credentials, tokens, or API keys
- Lock your workstation when stepping away
- Report lost or potentially compromised credentials immediately

**Topic 3: Acceptable Use**
- Parthenon is for authorized outcomes research only
- Do not attempt to re-identify de-identified data
- Do not export, copy, or transmit ePHI outside the platform without authorization
- Do not install unauthorized software on the production server
- Do not access data or systems beyond your role authorization

**Topic 4: Recognizing and Reporting Security Incidents**
- What constitutes a security incident (unauthorized access, data breach, malware, suspicious activity)
- How to report: email Sanjay Mudoshi (smudoshi@gmail.com) immediately
- What to include in a report: what you observed, when, what system, what you were doing
- Do not attempt to investigate or remediate on your own unless you are the designated responder
- There is no penalty for reporting a suspected incident that turns out to be a false alarm

**Topic 5: Phishing and Social Engineering**
- Common phishing techniques: fake login pages, urgent password reset requests, impersonation
- How to verify suspicious communications: check sender address, look for URL mismatches, when in doubt ask
- Parthenon will never ask for your password via email (temp passwords are sent only during registration/reset)
- SSH key-based auth means there are no SSH passwords to phish

**Topic 6: Data Handling and Disposal**
- Retention periods: clinical data retained for duration of research + 6 years
- How data is disposed: `shred` for files, `DROP SCHEMA CASCADE` for databases, NIST 800-88 for decommissioned media
- Backups are ePHI and must be treated with the same protections as live data
- Never store ePHI on personal devices, USB drives, or cloud storage outside the platform

### 4.2 Role-Specific Topics

**For Administrators (admin, super-admin):**
- User account lifecycle management (creation, role assignment, deactivation)
- Incident response procedures (reference: docs/compliance/incident-response-plan.md)
- Backup and recovery procedures (reference: docs/compliance/disaster-recovery-plan.md)
- Audit log review procedures (reference: docs/compliance/audit-controls.md)
- Change management and deployment procedures

**For Researchers (researcher role):**
- Responsible use of cohort building tools — cohorts may expose small-cell-size populations
- Minimum necessary principle: request only the data needed for the specific research question
- Shared cohort links contain definitions only (no patient data) but should still be shared responsibly
- Analysis execution may generate results that contain ePHI — treat outputs with appropriate protections

**For Data Stewards (data-steward role):**
- ETL pipeline security: ingested data may contain raw ePHI before transformation
- Concept mapping review: AI-suggested mappings should be validated for clinical accuracy
- Data quality results may reveal patterns about specific patients — handle as ePHI

---

## 5. Training Delivery Methods

| Method | When Used | Documentation |
|---|---|---|
| **Self-study** | Reading this document and all referenced policy documents | Self-attestation form (§6) |
| **One-on-one walkthrough** | New team members onboarding | Trainer + trainee sign-off |
| **Incident debrief** | After a security incident | Post-incident review notes |
| **Written update** | Policy changes, new features | Email or document with acknowledgment |

For the current single-person operations model, self-study with written attestation is the primary training method. As the team grows, structured training sessions should be implemented.

---

## 6. Training Completion Log

| Name | Email | Role(s) | Training Type | Topics Covered | Date Completed | Method | Trainer | Next Due |
|---|---|---|---|---|---|---|---|---|
| Sanjay Mudoshi | smudoshi@gmail.com | super-admin | Initial + All role-specific | All (§4.1 + §4.2 admin) | 2026-04-04 | Self-study + attestation | Self | 2027-04-04 |

---

## 7. Self-Attestation Form

### Security Awareness Training Attestation

I, the undersigned, attest that I have:

1. Read and understood the following Parthenon compliance documents:
   - [ ] Security Policies (docs/compliance/security-policies.md)
   - [ ] Incident Response Plan (docs/compliance/incident-response-plan.md)
   - [ ] Disaster Recovery Plan (docs/compliance/disaster-recovery-plan.md)
   - [ ] Audit Controls Documentation (docs/compliance/audit-controls.md)
   - [ ] Risk Assessment (docs/compliance/risk-assessment.md)

2. Understood my responsibilities regarding:
   - [ ] Protection of ePHI
   - [ ] Proper use of access credentials
   - [ ] Reporting security incidents
   - [ ] Acceptable use of the Parthenon platform
   - [ ] Data retention and disposal requirements

3. Acknowledged that:
   - [ ] I will not share my credentials or access tokens
   - [ ] I will report suspected security incidents immediately
   - [ ] I will only access data and systems within my authorized role
   - [ ] I understand the consequences of HIPAA violations
   - [ ] I will complete annual refresher training

**Name:** ________________________________________

**Email:** ________________________________________

**Role(s):** ________________________________________

**Signature:** ________________________________________

**Date:** ________________________________________

---

## 8. Training Program Evaluation

### 8.1 Effectiveness Metrics

| Metric | Target | Measurement |
|---|---|---|
| Training completion rate | 100% of active users | Completion log (§6) |
| Time to complete initial training | Within 7 days of account creation | Account creation date vs. training date |
| Security incident reports | Increase over time (indicates awareness) | Incident log |
| Repeat policy violations | Zero | Incident analysis |

### 8.2 Program Improvement

After each annual training cycle, review:
- Were there incidents that better training could have prevented?
- Are there new threats or attack vectors to include?
- Did any policy changes require training updates?
- Is the training delivery method effective for the current team size?

---

## 9. Plan Maintenance

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-04 | Sanjay Mudoshi | Initial release |

---

## 10. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Training Program Owner | Sanjay Mudoshi | _________________________ | __________ |
| Reviewer | | _________________________ | __________ |
