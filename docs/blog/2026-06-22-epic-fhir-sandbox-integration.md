---
slug: vulcan-reaches-epic
title: "Vulcan Reaches Epic: Our First Live FHIR Handshake"
description: "Parthenon's FHIR engine completed a live SMART Backend Services handshake with the Epic on FHIR sandbox — the first time clinical data flowed from a real, externally-operated EHR into OMOP CDM. Here is the keystone that made it possible, and the six new resource types that came with it."
authors: [mudoshi]
tags: [fhir, epic, smart-on-fhir, interoperability, omop, ingestion, architecture]
date: 2026-06-22T13:00:00
---

When we [introduced Vulcan](/docs/blog/poseidon-and-vulcan), our FHIR ingestion engine, it could do something impressive and something frustrating at the same time. It implemented the full SMART Backend Services client flow — sign a JWT, exchange it for a token, kick off a Bulk Data `$export`, poll for completion, download NDJSON, map it into OMOP CDM. Every step worked. Every test passed.

Against a **mock server**.

A mock server is a generous conversation partner. You hand it a signed assertion and it hands back a token without looking too closely. A real electronic health record system — Epic, in particular — is not so generous. Before Epic issues you a token, it wants to *verify the signature on your assertion*. And to do that, it needs something Vulcan had never been built to provide: **a way to find our public key.**

This is the story of building the missing half of that trust relationship, and of the moment Vulcan stopped talking to mocks and completed its first live handshake with the **Epic on FHIR sandbox**.

<!-- truncate -->

## The asymmetry nobody warns you about

SMART Backend Services — the OAuth 2.0 profile that lets a server pull bulk data from an EHR without a human clicking "allow" — is described as a symmetric handshake. In practice the two halves are wildly different in difficulty.

The **client half** is the part everyone implements first, because it's the part you can test alone:

1. Build a JWT whose claims say "I am client *X*, here is a unique token id, this assertion expires in five minutes."
2. Sign it with your private RSA key (RS384).
3. `POST` it to the token endpoint as a `client_credentials` grant.
4. Receive a bearer token.

The **server half** is invisible until you point the client at something real:

> Before Epic returns a token, it must verify your signature. To verify your signature, it needs your **public** key. To find your public key, it fetches a **JWKS** — a JSON Web Key Set — from a URL you registered. And to know *which* key in that set signed *this* assertion, it reads a **`kid`** (key id) from the JWT header.

Vulcan had no JWKS endpoint and put no `kid` in its assertions. Against a mock, that's fine. Against Epic, the token endpoint takes one look at an assertion it cannot verify and replies `invalid_client`. The pipeline never gets past step one. You can have a flawless NDJSON parser and a beautiful OMOP mapper, and none of it ever runs, because the front door never opens.

## The keystone: a public JWKS endpoint and a stable `kid`

The fix is small in code and large in consequence. Two pieces.

**First, a public key-discovery endpoint.** `GET /api/fhir/jwks.json` serves a standard JSON Web Key Set built from the RSA public components — the modulus `n` and exponent `e` — of every active connection's signing key. It sits *outside* authentication, deliberately, right alongside `/health`. It has to: the EHR needs to reach it *before* any token exists. And it is safe to expose precisely because it contains **only public material** — the private exponent is never serialized. (We have a test that asserts the private component never appears in the response. Belt and suspenders.)

**Second, a `kid` the EHR can rely on.** Rather than invent an identifier, we compute the [RFC 7638 JWK thumbprint](https://datatracker.ietf.org/doc/html/rfc7638) — a SHA-256 hash over the canonical key JSON — and use that as the `kid`. The virtue of a thumbprint is that it is **deterministic**: the same key always produces the same `kid`. Key rotation becomes auditable, re-registration becomes idempotent, and a connection that shares a key with another connection collapses to a single published entry. The assertion's header now carries that `kid` — and, importantly, *omits* it entirely when no key is present, because a `null` `kid` is worse than no `kid` to a strict verifier.

With those two pieces in place, the full flow finally closes:

```
Parthenon signs an RS384 assertion, stamps it with the key's kid,
and POSTs it to Epic's token endpoint.
        │
        ▼
Epic fetches https://parthenon.acumenus.net/api/fhir/jwks.json,
finds the key whose kid matches the header, verifies the signature.
        │
        ▼
Epic issues an access token. Vulcan begins the Bulk Data $export.
```

On **2026-06-22**, that is exactly what happened. The `kid`-bearing assertion was accepted, an access token came back, and Parthenon read Epic's `CapabilityStatement` over the authenticated channel. It was the first time Parthenon authenticated to a real, externally-operated EHR FHIR server instead of a stand-in. The front door opened. With the connection live and the Bulk Data pipeline already in place behind it, pulling the sandbox's synthetic patients through into OMOP CDM is the next step — but the part that had been blocking everything, the handshake, is done.

## What came through the door: six new resource types

Opening the connection was only worth doing if there was something worth ingesting, and here we leaned on work proven in our sister application, **Medgnosis**, whose FHIR ingestion had already expanded well past the "core" resources. Porting that coverage to Parthenon — retargeted from Medgnosis's warehouse schema to **OMOP CDM v5.4** — meant teaching Vulcan six new vocabularies of clinical meaning:

- **DocumentReference** → OMOP `note`. Clinical documents, with their base64 payloads decoded inline.
- **Coverage** → `payer_plan_period`. Who's paying, and for what window.
- **ServiceRequest** → `procedure_occurrence`, but only for real orders — drafts and proposals are skipped, not mis-recorded as performed procedures.
- **CarePlan**, **Goal**, **CareTeam** → three new OMOP **extension tables**, because the standard model has no native home for care-coordination. These follow the same bridge pattern we use for imaging and genomics.

CareTeam was the interesting one. A care team is a parent record plus a roster of members that must all point back to it — *before* anything is written. Rather than insert the team, read back its generated id, and then insert members (a round-trip that breaks batched writes), we allocate a **deterministic surrogate key** up front from a crosswalk, exactly as we already do for providers and care sites. The team and every member share that id in a single pass, and a re-sync produces the same id every time.

To make adding all of this sane, we first refactored the mapper into a **pluggable registry**: each resource type is now its own small class implementing a `ResourceMapper` interface, registered at boot. Adding a resource type went from "perform surgery on an 855-line monolith" to "write a class and add one line." That seam is the quiet hero of this release.

## Data gets corrected, too

Real clinical data isn't append-only. A diagnosis entered on the wrong chart gets retracted; a result gets superseded. FHIR expresses this two ways, and Vulcan now honors both: a resource marked **`entered-in-error`** during a sync deletes the CDM row it previously produced, and the Bulk Data **`deleted` manifest** — the list of resources removed since the last export — is parsed and applied. Every deletion is stamped with a timestamp and a reason in the crosswalk, so the audit trail survives even when the clinical row does not. We were honest in the code about the one case we can't yet pinpoint (batch-inserted rows whose individual ids weren't captured) — those are audited and flagged rather than silently dropped, and tightening that is on the list.

## Why this matters

OMOP is the destination, but EHRs are where the data lives, and the most painful, most expensive part of building an OMOP repository has always been the extract. The mature implementations — Mt. Sinai, Johns Hopkins — got there by writing thousands of hours of bespoke ETL against proprietary database schemas. FHIR Bulk Data is the bet that you can do it vendor-agnostically, against a standard API, in a fraction of the time.

That bet only pays off if the connection actually works against the systems clinicians actually use. As of this week, against Epic's sandbox, it does. Vulcan has shaken hands with Epic — and the path from a production EHR to a research-ready OMOP CDM is one large, real step shorter.

Next, we run the first bulk export against the live connection and capture its metrics, resolve the deferred concept mappings so care-coordination data lands as coded concepts rather than source text, and walk the same handshake through Epic's production registration. But the hardest part — getting a real EHR to trust us enough to open the door — is done.

*Vulcan kept the forge. This week, it forged a key that Epic accepted.*
