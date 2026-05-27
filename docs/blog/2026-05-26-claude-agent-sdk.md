---
slug: claude-agent-sdk-agentic-copilots
title: "From One-Shot Prompts to Autonomous Copilots: The Claude Agent SDK Comes to Parthenon"
authors: [mudoshi, claude]
tags: [development, ai, agents, claude, studies, publish, architecture, security]
date: 2026-05-26
---

For a year, every AI feature in Parthenon spoke to a model the same way: build a prompt, send it, get one answer back. Abby answers a question. The publication writer drafts a paragraph. Useful — but fundamentally a vending machine. You put a prompt in, a completion comes out, and the model never gets to *look around*, *use a tool*, or *change its mind*.

This milestone changes that. Parthenon now runs genuine **agentic copilots** — built on Anthropic's **Claude Agent SDK**, the same autonomous loop that powers Claude Code — inside two workflows: the **Study Designer** and the **Publication assistant**. The agent decides which tools to call, iterates (search → draft → validate → refine), keeps a session across turns, streams its work to the browser, and — critically — *asks for permission* before it writes anything. It ships on a reusable, profile-agnostic core, behind a super-admin runtime switch, with PHP still holding the pen on every database write.

This post is the full story: the architecture, the four pull requests that built it, the human-in-the-loop approval gate, and the engineering discipline (and bugs) along the way.

<!-- truncate -->

## Why an agent, and not another chatbot

The distinction that matters is **tools plus iteration**. A one-shot call (`$this->llm->chat(...)`) is a single request/response with a hand-built prompt — no tools, no loop, no memory. It is perfect when a single structured answer suffices, and we keep it exactly where it belongs.

An *agent* is different. Given a goal, it reasons about which tool to call next, calls it, reads the result, and decides what to do with it — looping until the job is done. In the Study Designer, that looks like: *search the OMOP vocabulary → confirm the concept ids → draft a concept set → read the Compiler's readiness guidance → refine.* No human stitches those steps together; the model orchestrates them.

The Claude Agent SDK gives us that loop as a programmable Python library. Because the SDK shells out to the Claude Code CLI, it runs only in our Python service (`python-ai`), never in PHP or the browser.

## The architecture: the agent orchestrates, PHP still owns the writes

The single most important design decision: **the agent is an orchestration brain, and its tools are thin authenticated HTTP clients to existing Laravel endpoints.** The agent never touches the database, the filesystem, or a shell. Every write still flows through Laravel — same validation, same RBAC, same audit trail.

```
Browser (React copilot panel)
   │  ① POST start / message / approve         ④ Reverb events (WebSocket)
   ▼                                            ▲
Laravel (Sanctum + RBAC)                        │
   • mints a short-lived, RBAC-scoped token     │
   • /broadcasting/auth (channel ownership)     │
   • existing feature routes  ◄─────────────────┼── ③ tool callbacks (Bearer = scoped token)
   │  ② start/turn (internal HTTP)              │
   ▼                                            │
python-ai (Claude Agent SDK)                    │
   • runs one turn, streams events              │
   • profile = system prompt + tool pack        │
   • in-process MCP tools → call Laravel ───────┘
   • publishes events → Reverb (Pusher HTTP) ───► ④
```

A few invariants hold this together:

- **PHP is the write authority.** Agent tools are thin clients; all writes, validation, audit, and RBAC happen in Laravel.
- **`python-ai` is internal-only.** The browser talks to Laravel; Laravel talks to `python-ai`; `python-ai` calls back to Laravel as the user. The browser never reaches the agent service directly.
- **The agent acts *as* the user.** Laravel mints a short-lived, RBAC-scoped Sanctum token per session; the agent's tool callbacks carry it. The agent can never exceed the user's permissions.
- **Streaming is best-effort; Laravel is authoritative.** Live tokens stream over Reverb (fail-open), but durable state — cost, tokens, session id, status — is persisted to a Laravel table, so a reconnecting client always reads the truth.

### A clinical-grade lockdown

Healthcare data demands paranoia. The agent runs with **every built-in tool removed** (`tools=[]` strips Bash, Read, Edit, Write, Glob, Grep, WebSearch, WebFetch), no developer config bleed-in (`setting_sources=[]`), no stray MCP servers (`strict_mcp_config=True`), and a headless permission posture. The *only* capabilities it can reach are our own in-process tools, namespaced `mcp__parthenon__*`. It cannot read the filesystem, run a shell, or browse the web. It can search vocabulary, read guidance, and — with approval — stage a draft.

## The journey, in four pull requests

### #343 — Foundation: the Study Designer copilot

The first PR built the reusable core *and* the first profile: a read-only Study Designer assistant. The core pieces — a Reverb publisher, a turn-running service, an in-memory session registry with a per-session lock, and an "agent profile" (system prompt + model + effort) — were designed once to be shared.

It also surfaced eight real bugs that never show up in a happy-path demo: an Echo subscription that re-subscribed on every streamed event (and dropped tokens mid-turn), a React double-start that minted duplicate sessions, a leaked Sanctum token when the downstream call failed, a global semaphore where a per-session lock belonged, and a Zod schema that threw on a null token count. We caught and fixed every one. They are now a written "gotchas catalogue" so the next feature avoids them.

### #346 — Generalizing the core: one profile becomes many

The Study Designer core was, understandably, *named* for Study Designer. Before adding a second profile we generalized it — non-destructively:

- `StudyDesignToolContext` became a generic `AgentToolContext` (a scoped token plus a feature-specific bag of ids).
- A **tool-pack registry** maps a profile name to its tool builder.
- The feature-named router became a generic `/agent` router; Laravel now hands the agent its channel name and callback path, so the Python service carries *no* domain knowledge.
- A single generic `agent_sessions` table — keyed by `(profile, subject_type, subject_id)` — replaced the per-feature table. The migration **creates and copies; it never drops** the old table. (Non-destructive by default is a house rule here.)

### #347 — The Publication assistant: grounding, then writing

The Publish page already generated narrative text with a one-shot call. The agentic version turns it into a true assistant: it pulls a study's real analyses, drafts each IMRAD manuscript section grounded **only** in those results (never inventing a statistic), and iterates on feedback.

Phase 1 shipped the read-only slice — research and draft, nothing saved. Phase 2 added the part that makes agents genuinely useful *and* genuinely dangerous: **the ability to write**, gated behind explicit human approval.

### #348 — A runtime switch: dark launch done right

Finally, a single super-admin toggle on the AI Providers page — backed by a runtime feature flag, `ai.agents` — that enables or disables every copilot at once, instantly, with no redeploy. More on why that matters below.

## The approval gate: a human stays in the loop

An agent that can call `update_draft` or `create_snapshot` unsupervised is a liability. So write tools are not auto-approved. They are deliberately *excluded* from the agent's allow-list, which routes them through the SDK's `can_use_tool` callback — our permission checkpoint.

When the agent wants a write, the flow is:

1. The `can_use_tool` callback fires. Read tools (already allow-listed) sail through; unknown tools fail **closed**; a write tool is intercepted.
2. The service publishes an `agent.approval.request` event over Reverb and **blocks on an `asyncio.Future`**, keyed by the tool-use id (with a timeout).
3. The copilot panel renders an **Approve / Reject** card describing exactly what the agent wants to do.
4. The author's decision posts to a Laravel endpoint that forwards it to `python-ai`, which resolves the future — `Allow` runs the write, `Reject` (or timeout) denies it.

The result: the agent proposes, the human disposes, and the actual write still travels the proven Laravel draft/snapshot machinery.

We also closed a subtle authorization gap. The agent's scoped token is now *enforced* on the write routes via Sanctum `abilities:` middleware — so even though the agent runs as the user, it is constrained to exactly the write scope it was granted. (Regular users, whose tokens carry the wildcard ability, are unaffected.)

## Shipping safely: decoupling deploy from release

Here is a thing we believe in: **deploying code and releasing a feature are two different events.** A clinical platform should be able to merge, build, and ship an unfinished or externally-dependent feature to production without exposing it to a single user — and turn it on (or off) with one switch.

That is what the `ai.agents` flag buys us. It is resolved at runtime from a system setting, surfaced on the AI Providers admin page, and read by both copilots. With it off (the default), the copilots simply do not render — no sessions, no tokens, no surprises. A super-admin flips it on when the prerequisites are met, and can flip it off the instant anything looks wrong, with no redeploy and no revert. The toggle even reports whether an Anthropic provider is configured, so an admin knows *why* agents may be inactive.

The agentic copilots are live in production today — **dark**, behind that flag — while we complete final validation.

## Engineering rigor (and a few scars)

Every layer was built test-first and gated by CI: Pest and PHPStan level 8 on the backend, `tsc` and a stricter `vite build` and Vitest on the frontend, `pytest` and `mypy` on the Python service. Each pull request was reviewed by an adversarial second pass whose only job was to find what the builder missed.

A few hard-won lessons we wrote down so we never relearn them:

- **The SDK is the source of truth, not the docs.** We pinned against the *actually published* `claude-agent-sdk` and verified its permission types and option kwargs inside the container before relying on them.
- **`Sanctum::actingAs($user)` defaults to *empty* abilities, not the wildcard.** A test that "proves" a real login token passes must request the wildcard explicitly — otherwise it proves the opposite of production behavior.
- **Channel-authorization tests must not depend on the broadcast driver.** The null test broadcaster doesn't enforce channel callbacks, so we assert the authorization predicate directly.
- **Verify your branch before every commit.** A concurrent process can move your working tree out from under you; when work looks "lost," the reflog and the commit object almost always have it.

The whole pattern is now captured in an internal playbook so the *third* agentic feature is faster and safer than the second was.

## What's next

The runtime is built, tested, merged, and deployed. The remaining path to a lit-up feature is short and operational: fund the model account, flip the toggle, and run a live end-to-end approval round-trip to validate the one interaction that only the real model can exercise. Beyond that, we have a tracked hardening list — session idle-eviction and token revocation on close, true admission control at the boundary, and PHI and load/cost reviews — none of it blocking, all of it on the board.

From a vending machine to a colleague that reasons, asks permission, and shows its work — grounded in your real OMOP data, and never allowed to write without a human nod. That is the kind of AI a clinical research platform can actually trust.
