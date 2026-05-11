# v2.x Plan 05-01-Followup — KMS-Backed Signing Keys (Tracking Stub)

> **For agentic workers:** This is a **tracking stub**, not a fully-detailed implementation plan. It exists so the keyless-OIDC → KMS-backed signing migration doesn't fall off the roadmap radar. When the prerequisites below are met, invoke `superpowers:writing-plans` to expand this stub into a full plan.

**Goal:** Migrate Parthenon's container image signing from Cosign **keyless OIDC** (the v2.0 launch posture from plan 05-01) to **KMS-backed long-lived signing keys** held in Acumenus KMS, without breaking customers verifying images from the keyless era.

**Status:** Tracking stub. **Not authorable today** — prerequisites unmet.

**Parent umbrella:** [2026-05-10-v2-5-roadmap-umbrella.md](2026-05-10-v2-5-roadmap-umbrella.md), workstream **05-01 follow-up** (added 2026-05-10).

**Predecessor:** [2026-05-10-v2-0-signed-images-supply-chain.md](2026-05-10-v2-0-signed-images-supply-chain.md) (plan 05-01) — must be in production with signed images flowing.

**Spec alignment:** Restores the original spec intent ("signing keys live in Acumenus KMS"). The pivot to keyless was a v2.0 launch pragmatic; KMS is the long-term posture.

---

## Why this exists

The spec for v2.5 roadmap convergence originally said *"Signing keys live in Acumenus KMS."* Plan 05-01 pivoted to **Cosign keyless OIDC** for the v2.0 launch because:

- Keyless requires zero key-management infrastructure to start.
- Keyless's trust anchor (GitHub OIDC issuer + immutable workflow ref) is cryptographically robust against forgery.
- Provisioning Acumenus KMS adds ~1 month of project work on a critical path.

The pivot was approved 2026-05-10 with the explicit understanding that **KMS-backed keys remain the long-term posture** for these reasons:

1. **Air-gap verification.** Enterprise customers in air-gapped or restricted-network environments cannot reach the GitHub OIDC issuer to verify signatures. A KMS-backed public key file at `parthenon.acumenus.net/.well-known/cosign.pub` works offline.
2. **Brand independence.** Trust anchored in `Acumenus-Data-Sciences/...github.com/...` ties Parthenon's image integrity to GitHub's continued operation as Parthenon's host. KMS keys are owned by Acumenus directly.
3. **Customer audit posture.** Some enterprise customers' security review checklists explicitly require "signing keys held by the vendor in a HSM/KMS." Keyless doesn't satisfy that checkbox.
4. **Key rotation lifecycle.** Long-lived keys make annual key rotation a documented, auditable event. Keyless doesn't have rotation as a concept — every signature is unique and the trust anchor is implicit.

---

## Prerequisites (must all be true before this plan is authored)

- [ ] **Acumenus KMS is operational.** Either AWS KMS, GCP Cloud KMS, or Azure Key Vault (whichever Acumenus standardizes on), provisioned with HSM-backed key material, with documented access controls and rotation policy.
- [ ] **Plan 05-01 is in production.** Multiple v2.x tag releases are signing successfully with keyless OIDC; customers have verified them.
- [ ] **Customer demand confirmed.** At least one EE customer or pilot has raised the air-gap or audit concerns above, OR an internal Acumenus security review has flagged the migration as required.
- [ ] **Cosign KMS support stable.** Cosign's KMS signer for the chosen KMS provider is in a release branch, not experimental.

---

## Out-of-band setup (manual, not in this plan)

These happen before the plan starts; document each in a devlog.

1. **Generate KMS key pair** in the chosen KMS. Key type: ECDSA P-256 or Ed25519. Key usage: SIGN/VERIFY only. Rotation policy: 365 days.
2. **Publish public key** at `https://parthenon.acumenus.net/.well-known/cosign.pub`. PEM-encoded. Versioned (URL includes year, e.g., `/2027/cosign.pub`, with `/cosign.pub` as a symlink to the current year).
3. **Document the KMS key ARN/resource path** in `docs/security/image-signing.md` so customers can verify chain-of-custody.

---

## Plan-when-authored — task outline

When this plan is expanded into a full implementation plan, it will cover roughly the following 8 tasks. Each task uses the standard 5-step TDD shape established in plan 05-01.

```
Task 1: Update verify-image-signature.sh to accept --kms-key-url override
        Test:  Bats — verify against a sample keyless image (current behavior) AND
                a sample KMS-signed image (new behavior)
        Impl:  Detect signing mode via signature metadata, route to appropriate
                cosign verify invocation

Task 2: Add KMS signing step to release-images.yml as a parallel signature
        Test:  Workflow YAML lint + grep for `cosign sign --key`
        Impl:  After the existing keyless `cosign sign --yes`, add a second
                `cosign sign --key <kms-key-uri>` step that signs the same
                digest. Both signatures coexist on the manifest.

Task 3: Publish the KMS public key at .well-known/cosign.pub
        Test:  HTTP GET returns valid PEM with the expected fingerprint
        Impl:  Static-site deploy step in the marketing/landing-page repo

Task 4: Update docs/security/image-signing.md to document BOTH paths
        Test:  Bats — grep for both "keyless" and "KMS public key"
        Impl:  Section A: keyless verification (existing). Section B: KMS
                verification (new). Section C: which to use when.

Task 5: Add air-gap verification documentation
        Test:  Bats — grep for "air-gap" or "air gap" in the doc
        Impl:  Walkthrough for customers without internet access; download the
                public key once, verify offline forever.

Task 6: Update scripts/verify-image-signature.sh to default to KMS when
         available, fall back to keyless
        Test:  Bats — env-var to force keyless vs KMS works
        Impl:  Detection logic

Task 7: Tag a transition release (e.g., v2.X.0) with both signatures
        Test:  Manual verification — sample customer can verify with either
                keyless OR KMS path
        Impl:  Cut the tag, run release-images.yml, smoke-test

Task 8: After 6 months of dual signing, deprecate keyless in the docs
        Test:  Bats — docs mark keyless as "legacy"; release workflow still
                emits both signatures for backwards-compat
        Impl:  Doc edit + workflow comment update
```

---

## Migration design — coexistence

The signing migration is **non-breaking**. Two signatures coexist on each manifest:

- Signature 1: keyless OIDC (unchanged from plan 05-01)
- Signature 2: KMS-backed (new in this plan)

`cosign verify` returns success if **either** signature validates. Customers verifying with the old `verify-image-signature.sh` (which uses keyless) keep working. Customers using the new KMS-aware verification (which checks both) get the KMS audit trail.

Six months after the first dual-signed release, this plan's Task 8 deprecates keyless in the documentation but does NOT remove keyless from the release workflow — both signatures continue to ship indefinitely, so historic verification scripts keep working. The only thing that "ages out" is the user-facing recommendation.

---

## Risks (re-evaluate at authoring time)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| KMS provider lock-in | Medium | Hard to switch later | Use a vendor-neutral key URI format; abstract signing behind a wrapper |
| KMS access key rotated without coordination → workflow breaks | Medium | Release pipeline halt | Documented rotation runbook; secrets stored in GitHub OIDC-to-KMS chain, not long-lived AWS keys |
| Public key file URL changes | Low | Customer verifications break | Versioned URL pattern (`/YYYY/cosign.pub`) + always-current symlink at `/cosign.pub`; both documented |
| Cosign KMS provider API drifts between versions | Low | Verify scripts break | Pin Cosign version in CI + verify scripts |

---

## When to author this plan in full

Track these signals. Author when any two are true:

- [ ] An EE customer has raised the air-gap verification gap.
- [ ] An EE customer has raised the "vendor-held signing keys" audit gap.
- [ ] Acumenus KMS is operational and idle (no other workloads competing for keys).
- [ ] Plan 05-01 has shipped ≥3 successful release tags.
- [ ] Internal security review (per HIGHSEC) has flagged the migration as a 12-month obligation.

---

## Status

| State | Date | Notes |
|---|---|---|
| Stub authored | 2026-05-10 | This file |
| Prerequisites met | — | Pending: Acumenus KMS provisioning |
| Plan expanded into full TDD plan | — | Triggered when "When to author" criteria fire |
| Plan executed | — | — |
| Deprecation of keyless documentation | — | Six months after first dual-signed release |
| Keyless removed from release workflow | — | **Never** — coexistence is permanent for historic verification |
