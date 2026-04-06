# Abby Optimization Handoff

Date: 2026-04-05

## Executive Summary

This handoff captures the Abby stabilization and retrieval rebuild work completed in this session cluster, the current live production behavior, the code that is staged locally but not yet redeployed, and the highest-value next steps for the next agent.

The broad result is that Abby is no longer in the earlier broken state where she was blind to her vector corpus, mixed textbooks with OHDSI literature in one collection, exposed hidden reasoning output, and surfaced the wrong model branding in Commons. The knowledge base has been rebuilt into cleaner collections, the frontend vector viewer now visually distinguishes the collections, and the live Abby service is materially better on core OMOP/OHDSI and ClinVar questions.

However, the UX is not “finished.” There are still definition-selection issues, incomplete provenance in responses, grounded-definition answers that can be too terse or choose the wrong chunk, and a few infrastructural issues that affect latency and confidence.

The next agent should think in terms of **tightening answer quality**, not just “making it work.”

## User Intent and Product Direction

The user’s implicit product goals across this sequence were:

- Abby should run off her own dedicated Ollama host.
- Commons Ask Abby should not advertise a model name in the UI.
- Abby should stop dumping internal thought traces or clipped half-answers.
- Abby should actually understand and use her Chroma-backed “brain.”
- OHDSI literature, textbooks, and genomics reference material should be intentionally curated, not mixed indiscriminately.
- The system should be inspectable and debuggable from the admin UI.
- The next agent should be able to continue optimization without having to rediscover what happened.

That product direction should remain the anchor for follow-up work.

## What Was Accomplished

### 1. Abby host and frontend branding cleanup

Abby was moved to a dedicated Ollama host path rather than sharing the previous generic pathing.

Primary changes:

- `docker-compose.yml`
- `ai/app/config.py`
- `installer/config.py`
- `.env.example`
- local `.env`

Result:

- Abby now targets `http://host.docker.internal:11435`
- Model path remains `ii-medical:8b-q8`

Frontend model branding was also removed from the Commons Ask Abby interface.

Primary UI file:

- `frontend/src/features/commons/components/abby/AskAbbyChannel.tsx`

Result:

- model name is no longer displayed in the Commons chat experience

### 2. Python AI restart and dedicated Ollama path verification

`python-ai` was restarted and later recreated after config changes.

Verified live health state after the Ollama path fix:

- provider: `ollama`
- model: `ii-medical:8b-q8`
- base URL: `http://host.docker.internal:11435`
- status: `ok`

This confirmed that Abby’s local path is actually reaching the dedicated Abby Ollama daemon.

### 3. Hidden reasoning suppression and local reply hardening

The original user-reported failure mode was that Abby was outputting initial thoughts or effectively consuming her token budget in hidden reasoning without delivering a usable answer.

Backend hardening work in:

- `ai/app/routers/abby.py`

Changes already implemented and deployed before this handoff:

- stripping Qwen/Gemma-style reasoning tokens
- adding a larger `num_predict` floor for reasoning-heavy local models like `ii-medical:8b-q8`
- retrying when visible output is empty after reasoning suppression
- suppressing hidden reasoning in streaming mode

This significantly improved the “empty answer / chain-of-thought leakage” problem.

### 4. Chroma retrieval debugging and docs collection recovery

One of the core retrieval failures was that Abby seemed unaware of the docs corpus. Investigation showed a Chroma embedding mismatch in docs retrieval.

Observed failure:

- docs query failed with an embedding-dimension mismatch (`768` expected vs `384` produced)

That was addressed by rebuilding from a clean slate rather than trying to salvage the previous mixed and partially broken state.

### 5. OHDSI-scraper restoration

The repo still expected OHDSI corpus directories to exist and be populated, but the harvesting scripts had been deleted from `HEAD` even though runtime and documentation still referenced them.

These were restored from the last good commit lineage:

- `OHDSI-scraper/harvester.py`
- `OHDSI-scraper/scrape_book.py`
- `OHDSI-scraper/scrape_hades.py`
- `OHDSI-scraper/scrape_forums.py`
- `OHDSI-scraper/ingest_textbooks.py`
- `OHDSI-scraper/extract_corpus.py`
- `OHDSI-scraper/setup.sh`
- `OHDSI-scraper/README.md`

They were verified with Python compilation after restoration.

Important repo-state note:

- `OHDSI-scraper/` is currently untracked in git in this working tree because the directory had been removed from `HEAD`

The next agent must be careful not to lose that restored tooling.

### 6. Clean corpus rebuild and small-batch seeding

The user explicitly asked for a clean restart with small-batch validation before larger embedding rebuilds. That was done.

Curated docs seed directory created and ingested:

- `docs/abby-seed`

This was used to rebuild the `docs` collection from a small, intentionally scoped corpus instead of the previous opaque mixed state.

### 7. ClinVar and HGVS seed docs added

New genomics/standards reference seed docs were added under:

- `docs/abby-seed/reference/clinvar.md`
- `docs/abby-seed/reference/hgvs.md`
- `docs/abby-seed/reference/parthenon-genomics-variant-reference.md`

These were designed to give Abby grounded answers on:

- ClinVar
- HGVS nomenclature
- Parthenon genomics context

These docs are strategically important because textbooks are not the correct primary source for ClinVar/HGVS behavior.

### 8. Textbook curation

The medical textbook pool was aggressively curated rather than ingesting everything.

The active keep set was narrowed down to 12 books spanning:

- epidemiology
- biostatistics
- longitudinal methods
- clinical trials
- preventive medicine
- cell biology
- molecular biology
- genetics

The non-active books were moved out of the ingest path into:

- `OHDSI-scraper/Medical Texts Archive`

The active keep set was documented in:

- `OHDSI-scraper/CURATED_MEDICAL_TEXTBOOKS.md`

The textbook extraction manifest was rebuilt at:

- `OHDSI-scraper/medical_textbooks_extracted/manifest.json`

At the time of rebuild, textbook extraction summary was:

- `12` books
- `25,103` chunks
- `28,670,913` characters

### 9. Collection split: OHDSI literature vs textbooks

This is one of the most important architectural improvements in the whole effort.

Originally, textbooks were being ingested into the same Chroma collection as OHDSI papers and knowledge sources.

That was refactored so textbooks have their own dedicated collection.

Backend files updated:

- `ai/app/chroma/collections.py`
- `ai/app/chroma/ingestion.py`
- `ai/app/chroma/retrieval.py`
- `ai/app/routers/chroma.py`

New dedicated collection:

- `medical_textbooks`

Retained OHDSI literature collection:

- `ohdsi_papers`

Retrieval behavior now uses the textbook collection selectively for foundational biology/genetics/genomics style prompts instead of drowning OHDSI retrieval in background textbook material.

This split materially improved retrieval interpretability and admin debugging.

### 10. Chroma collection state after split

Stable collection counts observed after split completion:

- `docs`: `280`
- `clinical_reference`: `985,299`
- `ohdsi_papers`: `19,619`
- `medical_textbooks`: `4,480`

Conversation memory was later explicitly cleaned and is now much smaller.

After the most recent cleanup and QA pass:

- `conversation_memory`: `3`

Those 3 entries are currently:

- ClinVar
- OMOP CDM
- CohortMethod

This is a much better state than leaving stale test and broken-answer artifacts in memory.

### 11. Vector viewer / System Health panel update

The Chroma vector viewer in the System Health panels was updated so the collection split is visible in the UX.

Files updated:

- `frontend/src/features/administration/components/vector-explorer/constants.ts`
- `frontend/src/features/administration/components/vector-explorer/VectorExplorer.tsx`
- `frontend/src/features/administration/components/vector-explorer/ThreeScene.tsx`
- `frontend/src/features/administration/components/vector-explorer/ColorLegend.tsx`
- `frontend/src/features/administration/components/vector-explorer/ModeSelector.tsx`
- `frontend/src/features/administration/components/vector-explorer/SampleSlider.tsx`
- `frontend/src/features/administration/components/vector-explorer/PointInspector.tsx`
- `frontend/src/features/administration/components/ChromaStudioPanel.tsx`

Result:

- `medical_textbooks` has its own distinct blue accent
- `ohdsi_papers` retains a separate gold accent
- collection chip, controls, cluster palette, legend, and panel accents now stay aligned to the selected collection

This was built and deployed successfully.

### 12. Frontend deploy verification

The frontend was built locally and then deployed with:

- `npm --prefix frontend run build`
- `./deploy.sh --frontend`

Results:

- build passed
- deploy completed
- smoke checks passed for:
  - `/`
  - `/login`
  - `/jobs`

### 13. Abby live QA pass

The following live `/abby/chat` questions were exercised during this work:

- `Who is Paul Nagy?`
- `What is the OMOP Common Data Model?`
- `What is CohortMethod?`
- `What is ClinVar?`
- `What is HGVS nomenclature?`
- `What is a missense variant?`

Observed runtime progression:

- earlier state: several answers were clipped mid-sentence
- after retry/token-budget work: OMOP and CohortMethod became stable
- ClinVar initially still clipped in live runtime
- HGVS initially returned a poor grounded-definition answer dominated by source references instead of a definition

Current live state before the latest undeployed patch:

- OMOP CDM: good
- CohortMethod: good
- ClinVar: good after cleanup / grounded-definition path
- HGVS: still bad in live runtime because the grounded-definition selector chose a source-URL chunk

## Tests and Verification Performed

### Backend tests that passed earlier in the work

These had already passed before the latest finishing work:

- focused retrieval/ingestion/prompt tests: `12 passed`
- retrieval/ingestion split tests: `16 passed`
- full AI suite at one point: `337 passed`

### Tests added in this handoff phase

New or updated coverage was added around:

- truncated local reply detection
- retrying clipped local replies
- memory-storage quality guard
- rejecting reference-only grounded-definition candidates

Relevant file:

- `ai/tests/test_abby_integration.py`

Memory tests also remained green:

- `ai/tests/test_chroma_memory.py`

Most recent test results during this handoff:

- `cd ai && pytest tests/test_abby_integration.py -q` -> `63 passed`
- `cd ai && pytest tests/test_chroma_memory.py -q` -> `4 passed`
- targeted new-guard tests -> `6 passed`

Important nuance:

- the **latest HGVS grounded-definition selector patch has been tested in targeted Abby integration tests**
- it has **not yet been redeployed to `python-ai`**
- live production behavior therefore still reflects the prior code path for HGVS unless the next agent deploys the new patch

## Current Live Production State

As of the last runtime check:

- `GET http://127.0.0.1:8002/health` returned `status: ok`
- live backend is using:
  - provider: `ollama`
  - model: `ii-medical:8b-q8`
  - base URL: `http://host.docker.internal:11435`

Conversation memory was explicitly deleted and recreated cleanly. After the most recent QA pass it contains only a few good entries.

Live ClinVar answer after cleanup:

- `ClinVar is the NCBI public archive of submitted interpretations of human genetic variants and their relationships to disease or other phenotypes.`

Live OMOP CDM answer:

- grounded, concise, acceptable

Live CohortMethod answer:

- grounded, concise, acceptable

Live HGVS answer before latest redeploy:

- bad
- it returned source/reference lines instead of a definition

## Code That Is Staged Locally But Not Yet Redeployed

There is an important distinction between:

- what is already live
- what has now been fixed in code but not yet redeployed

### Staged backend improvements in `ai/app/routers/abby.py`

These latest local changes are in the working tree:

- clipped-answer detector for local replies
- retry if a visible reply is clearly truncated rather than only retrying when reply is empty
- memory-storage guard to avoid persisting:
  - clipped answers
  - obvious abstract-fragment answers beginning with section-style text such as `Results`, `Methods`, etc.
- grounded-definition selector filtering so URL/path/reference-only chunks do not win for prompts like HGVS
- small definitional bonus for sentences containing `is`, `are`, `stands for`, `refers to`

Related test updates are in:

- `ai/tests/test_abby_integration.py`

These changes were **validated in tests** but are **not yet live** until `python-ai` is recreated again.

This is the first thing the next agent should do.

## Major UX Improvements Achieved

### What got materially better for end users

1. Abby is now pointed at a dedicated local model host.
2. Commons no longer exposes stale or misleading model branding.
3. Chroma collections are no longer conceptually mixed in one vector bucket.
4. The admin vector viewer now visually reflects the collection split.
5. Abby is far less likely to show hidden reasoning or blank/thought-only output.
6. ClinVar / OMOP / CohortMethod answers are much cleaner than at the start of this effort.
7. Conversation memory is no longer carrying the older polluted state.

These are meaningful product wins, not just engineering cleanup.

## Remaining Problems

### 1. Grounded-definition answers are still too brittle

This is the biggest current answer-quality issue.

Problem pattern:

- short questions like `What is X?` use the grounded-definition shortcut
- if chunk ranking is wrong, Abby can return a chunk fragment, source URL line, or weak excerpt instead of a clean definition

We saw this directly with:

- `What is HGVS nomenclature?`

The latest local patch improves this, but the general issue still deserves more work.

### 2. No visible source attribution in Abby responses

`/abby/chat` is still returning:

- `sources: []`

That means the frontend and downstream consumer cannot show provenance even when the answer was clearly grounded in docs or Chroma results.

For a polished UX, especially in a platform like this, Abby should be able to surface:

- source collection
- source title / file
- maybe even “why this answer” style grounding metadata

### 3. Grounded answers can be too terse

The current grounded-definition path often returns a single sentence, which is better than hallucination but not always the best user experience.

Examples of what is missing:

- a second sentence that clarifies practical meaning
- distinction between naming standard vs clinical interpretation standard
- concise follow-up suggestions that actually help the user continue

The next agent should optimize for:

- grounded first sentence
- one useful clarifying sentence
- minimal but relevant next actions

### 4. Some low-level retrieval chunks are poorly chunked for definitions

The HGVS result shows that semantic top hits can land on:

- source URL bullets
- references section
- metadata-ish fragments

This is a chunking/shaping problem as much as it is a selection problem.

The next agent should evaluate whether the docs ingester should:

- drop or down-rank “Source URLs” sections
- preserve heading hierarchy in metadata
- split reference sections into their own lower-priority chunks
- prioritize opening paragraphs / definition paragraphs

### 5. Embedder/runtime startup quality is still rough

Observed warnings:

- `/app/models` is not writable
- unauthenticated HF Hub requests warning

These are not the central UX issue, but they matter because they increase cold-start roughness and operational uncertainty.

The next agent should evaluate:

- writable model cache volume or path
- setting `HF_TOKEN`
- whether any embedder downloads can be baked into the image

### 6. Sources and suggestions are weak or absent in grounded mode

Many grounded-definition replies currently return:

- no suggestions
- no visible sources

That makes the answers feel sterile and brittle even when factually correct.

The ideal UX is:

- grounded answer
- a compact “from docs / textbooks / OHDSI papers” citation feel
- 1–2 relevant follow-up actions

### 7. Conversation memory policy is still simplistic

The latest patch improves storage quality by skipping bad answers, but the policy is still basic.

Open questions for the next agent:

- Should Abby store every acceptable answer?
- Should she only store answers above a confidence threshold?
- Should definition Q&A even go into memory, or should memory be reserved for user-specific workflow context?
- Should stored memory include source provenance or evaluation grade?

Right now memory is only lightly filtered.

## Recommended Next Steps for the Next Agent

### Immediate next action

1. Redeploy `python-ai` again so the latest `abby.py` selector patch is live.

Then immediately re-run:

- `What is HGVS nomenclature?`
- `What is ClinVar?`
- `What is the OMOP Common Data Model?`
- `What is CohortMethod?`

### Short-horizon quality work

2. Improve grounded-definition ranking further.

Specifically:

- prioritize title/opening-definition chunks
- explicitly down-rank reference sections
- boost sentences with definitional structure
- preserve better title/source metadata during docs ingestion

3. Add visible source attribution to `/abby/chat`.

The `sources` array should stop being empty for grounded answers.

4. Improve grounded-mode UX.

Recommended answer shape:

- sentence 1: direct grounded definition
- sentence 2: practical framing or distinction
- optional follow-up suggestions

### Retrieval and corpus tightening

5. Audit docs chunking and metadata shape.

Look specifically at:

- `docs/abby-seed/reference/*.md`
- docs ingester behavior
- chunk boundaries around headings like `Source URLs`, `Related local references`, `Examples`

6. Consider reference-section suppression during ingestion.

If a section is purely:

- links
- references
- local file pointers

it probably should not rank above actual definitions.

### Evaluation discipline

7. Build a repeatable Abby eval set.

At minimum include:

- `Who is Paul Nagy?`
- `What is OMOP CDM?`
- `What is CohortMethod?`
- `What is ClinVar?`
- `What is HGVS nomenclature?`
- `What is a missense variant?`
- `What is longitudinal data analysis?`
- `What is a clinical trial endpoint?`

For each prompt, score:

- factuality
- completeness
- whether it ends cleanly
- whether it uses the right corpus
- whether it should be stored to memory

8. Add explicit regression tests for bad grounded candidates.

The HGVS URL-chunk case should become a permanent regression test.

### Memory and UX refinement

9. Tighten conversation memory strategy.

Potential direction:

- store only high-quality, user-specific, reusable knowledge
- avoid storing generic dictionary-style definitions
- attach collection/source metadata to stored turns

10. Revisit suggestions and reply ergonomics.

Current suggestions are often absent or generic.

The best UX would make Abby feel:

- grounded
- helpful
- action-oriented
- not verbose
- not robotic

## Key Files to Review First

If a new agent is starting cold, the first files worth opening are:

- `ai/app/routers/abby.py`
- `ai/app/chroma/retrieval.py`
- `ai/app/chroma/ingestion.py`
- `ai/app/chroma/collections.py`
- `ai/app/chroma/memory.py`
- `ai/tests/test_abby_integration.py`
- `ai/tests/test_chroma_retrieval.py`
- `ai/tests/test_chroma_ingestion.py`
- `docs/abby-seed/reference/clinvar.md`
- `docs/abby-seed/reference/hgvs.md`
- `OHDSI-scraper/CURATED_MEDICAL_TEXTBOOKS.md`
- `frontend/src/features/administration/components/ChromaStudioPanel.tsx`
- `frontend/src/features/administration/components/vector-explorer/constants.ts`

## Suggested Command Sequence for the Next Agent

1. Redeploy latest backend changes:

```bash
docker compose up -d --force-recreate python-ai
```

2. Verify health:

```bash
curl -sS http://127.0.0.1:8002/health
```

3. Re-run live Abby prompts:

```bash
curl -sS -X POST http://127.0.0.1:8002/abby/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is HGVS nomenclature?","conversation_id":920005,"user_id":1,"page_context":"genomics"}'
```

4. Re-check memory:

```bash
docker compose exec -T python-ai python - <<'PY'
from app.chroma.client import get_chroma_client
col = get_chroma_client().get_collection('conversation_memory')
print(col.count())
print(col.get(include=['documents','metadatas']))
PY
```

5. Run focused tests:

```bash
cd ai && pytest tests/test_abby_integration.py -q
cd ai && pytest tests/test_chroma_memory.py -q
```

## Final Assessment

Abby is in a much healthier place than she was at the start of this effort.

The architecture is cleaner:

- dedicated Ollama host
- cleaner corpora
- separate textbook vector space
- curated genomics references
- better vector admin tooling

The main remaining work is no longer “make Abby function at all.”

The main remaining work is:

- sharpen grounded answer selection
- expose provenance
- improve answer ergonomics
- formalize evaluation
- keep low-quality retrieval artifacts out of both user responses and memory

That is the path to the best UX and end-user experience.
