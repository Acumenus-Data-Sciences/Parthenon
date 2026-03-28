---
slug: magical-ladies-of-parthenon
title: "The Magical Ladies of Parthenon"
authors: [mudoshi, claude]
tags: [architecture, hecate, phoebe, ariadne, arachne, vocabulary, ai, federated, concept-sets]
date: 2026-03-27
---

In Greek mythology, the great temple atop the Acropolis housed not just Athena, but an entire pantheon of divine figures — each wielding a unique gift. Parthenon, our unified OHDSI outcomes research platform, follows the same philosophy. Behind the scenes, four mythological women power the intelligence layer that transforms raw clinical data into actionable research: **Hecate**, **Phoebe**, **Ariadne**, and **Arachne**.

<!-- truncate -->

<div style={{textAlign: 'center', margin: '2rem 0'}}>
  <img
    src="/docs/img/magical-ladies.png"
    alt="Hecate, Phoebe, Ariadne, and Arachne — the four mythological engines of Parthenon"
    style={{borderRadius: '16px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'}}
  />
  <p style={{fontSize: '0.85rem', color: '#8A857D', marginTop: '0.75rem', fontStyle: 'italic'}}>
    From left to right: Hecate (torch-bearer of hidden knowledge), Phoebe (oracle of concept relationships),
    Ariadne (thread-spinner of vocabulary mappings), and Arachne (weaver of the federated network).
  </p>
</div>

Each of these engines appears throughout the Parthenon interface as a distinctive "Powered by" pill — teal for Hecate, gold for Phoebe, crimson for Ariadne, and violet for Arachne. They aren't cosmetic labels. They represent four fundamentally different approaches to the same grand challenge: helping researchers find the right concepts, build complete concept sets, map between vocabularies, and execute studies across a distributed network of clinical databases.

This post tells the story of who they are, what they do, and how they came to life.

---

## Hecate: The Torch-Bearer of Hidden Knowledge

**Color:** Teal (#2DD4BF) | **Domain:** Semantic concept search | **Technology:** Vector embeddings + Qdrant

In mythology, Hecate stood at crossroads with a torch in each hand, illuminating paths hidden from mortal sight. In Parthenon, she does the same for clinical concepts.

### The Problem She Solves

Traditional vocabulary search is keyword-based. Search for "heart attack" and you'll find concepts named "heart attack" — but you might miss *myocardial infarction*, *STEMI*, *acute coronary syndrome*, or *troponin elevation*. Clinical researchers think in medical concepts, not in exact vocabulary strings. The gap between how a researcher thinks about a condition and how OMOP CDM encodes it can mean the difference between a complete cohort and a dangerously incomplete one.

### How She Works

Hecate operates through a three-layer architecture:

1. **Embedding Layer (Ollama + EmbeddingGemma-300M):** Every standard concept in the OMOP vocabulary (1,968,694 of them) is passed through a medical-domain embedding model running locally via Ollama. Each concept name becomes a 768-dimensional vector that captures its *semantic meaning*, not just its characters.

2. **Vector Index (Qdrant):** These ~2 million vectors are stored in a Qdrant collection called `meddra`, with cosine similarity indexing. When a researcher types a query, Hecate embeds the query text through the same model and performs approximate nearest-neighbor search against the full vocabulary.

3. **Concept Resolution (PostgreSQL):** The nearest vectors map back to OMOP concept IDs through a pairs file (1.94 million unique concept names), and the full concept metadata (domain, vocabulary, class, standard status) is resolved from PostgreSQL.

### What Makes Her Special

Search for "sugar disease" and Hecate returns *Diabetes mellitus* (SNOMED 201820) at 0.93 similarity. Search for "broken hip" and she returns *Fracture of neck of femur* alongside *Hip fracture* and *Intertrochanteric fracture*. She understands medical synonymy, abbreviations, and even casual descriptions — because the embedding model learned those relationships from medical literature.

She also powers the autocomplete in Parthenon's vocabulary browser, the concept search within the ETL mapping tool (Aqueduct), and the concept picker in cohort definitions.

### The Numbers

| Metric | Value |
|--------|-------|
| Total concepts embedded | 1,968,694 |
| Phase 1 (Clinical) | 705,294 concepts |
| Phase 2 (Drug/RxNorm) | 1,263,400 concepts |
| Embedding dimension | 768 |
| Model | EmbeddingGemma-300M (local) |
| Index | Qdrant v1.17, cosine similarity |
| Query latency | ~50ms typical |

---

## Phoebe: The Oracle of Concept Relationships

**Color:** Gold (#C9A227) | **Domain:** Concept set recommendations | **Technology:** Pre-computed co-occurrence network from 22 global data sources

Phoebe was the Titan of prophecy and radiant intellect — grandmother of Apollo and Artemis, keeper of the Oracle at Delphi before Apollo claimed it. In Parthenon, she whispers to researchers: *"You're building a concept set for diabetes — have you considered these 733 related concepts?"*

### The Problem She Solves

Building a comprehensive concept set is one of the hardest tasks in observational research. A researcher creating a cohort for "Type 2 Diabetes" needs to decide: should I include *Diabetes mellitus type 2 without complication*? What about *Diabetic neuropathy*? *Insulin resistance*? *HbA1c measurement*? The OMOP vocabulary contains millions of concepts with complex hierarchical and lateral relationships. Missing a critical concept can bias an entire study.

### How She Works

Phoebe is powered by the OHDSI **concept_recommended** dataset — a pre-computed network of 3,768,447 concept-to-concept recommendation pairs, derived from analyzing concept usage patterns across **22 real-world healthcare databases** spanning **6 countries** and **272 billion clinical records**.

The recommendations come in five relationship types:

| Relationship | Count | What It Captures |
|-------------|-------|-----------------|
| **Lexical via standard** | 1,383,892 | Concepts with similar names in standard vocabularies |
| **Ontology-descendant** | 1,111,848 | Child concepts in the vocabulary hierarchy |
| **Ontology-parent** | 1,095,982 | Parent concepts in the vocabulary hierarchy |
| **Patient context** | 135,033 | Concepts that co-occur in the same patients across databases |
| **Lexical via source** | 41,692 | Concepts with similar names in source vocabularies |

The **Patient context** relationships are the most valuable — they represent real-world clinical co-occurrence patterns. If patients with *Diabetes mellitus* frequently also have records for *Diabetic retinopathy screening*, that relationship is captured even though the two concepts are in different domains and different vocabulary hierarchies.

### What Makes Her Special

When a researcher selects concept 201820 (Diabetes mellitus), Phoebe returns 733 recommended concepts spanning complications (neuropathy, retinopathy, nephropathy), related measurements (HbA1c, fasting glucose), medications (metformin, insulin), and associated conditions (metabolic syndrome, obesity). She surfaces concepts that a researcher *should consider* based on how the global OHDSI network actually uses them together.

She's integrated into Parthenon's Concept Set Editor — as you add concepts to your set, Phoebe aggregates recommendations across all included concepts, deduplicates them, and ranks by relevance. The panel is collapsible and non-intrusive, but when expanded, it's a revelation.

### The Data Pipeline

The concept_recommended dataset is published by OHDSI through the [Broadsea](https://github.com/OHDSI/Broadsea) project and is based on the [ConceptPrevalence study](https://github.com/ohdsi-studies/ConceptPrevalence) led by Anna Ostropolets. We load it into a `vocab.phoebe` table and query it directly — no external service dependency, sub-millisecond response times.

---

## Ariadne: The Thread-Spinner of Vocabulary Mappings

**Color:** Crimson (#9B1B30 / #E85A6B) | **Domain:** AI-assisted source-to-standard concept mapping | **Technology:** RAG pipeline + LLM reasoning

Ariadne gave Theseus a ball of thread to navigate the Labyrinth and slay the Minotaur. In Parthenon, she gives data engineers a thread through the labyrinth of source-to-standard vocabulary mapping — arguably the most labor-intensive step in any OMOP ETL pipeline.

### The Problem She Solves

When a hospital's EHR uses the code "DM2" for Type 2 Diabetes, someone needs to map that to OMOP concept 201826 (*Type 2 diabetes mellitus*). When a lab system reports "GLU-F" for fasting glucose, someone needs to find LOINC concept 2345-7 (*Glucose [Mass/volume] in Serum or Plasma*). A typical ETL project involves mapping thousands of source codes, and each mapping requires domain expertise, vocabulary knowledge, and careful judgment.

### How She Works

Ariadne operates as an AI mapping assistant in Parthenon's Mapping Assistant page. She combines:

1. **Hecate's semantic search** to find candidate standard concepts for each source code
2. **Vocabulary context** from concept hierarchies, relationships, and domain constraints
3. **LLM reasoning** to evaluate candidates and suggest the best mapping with a confidence score and rationale

The researcher sees a side-by-side interface: source codes on the left, Ariadne's suggestions on the right. Each suggestion includes the recommended standard concept, a confidence percentage, the mapping type (direct, lookup, transform), and a natural-language explanation of *why* this mapping makes sense.

### What Makes Her Special

Ariadne doesn't just pattern-match strings. She understands that "BP systolic" should map to a *Measurement* domain concept, not a *Condition*. She knows that drug mappings should target RxNorm Clinical Drug concepts, not ingredient-level concepts. She respects the OMOP conventions for concept class, domain, and standard status — because she's been trained on the vocabulary structure itself.

She also learns from the mappings you accept. As you work through a mapping project, the patterns you confirm help her make better suggestions for subsequent codes. She's a tireless assistant who gets smarter as you work.

---

## Arachne: The Weaver of the Federated Network

**Color:** Violet (#8B5CF6 / #A78BFA) | **Domain:** Federated study execution | **Technology:** OHDSI Arachne Central integration

Arachne was the mortal weaver who challenged Athena herself — her tapestries so perfect that the goddess transformed her into a spider, forever weaving intricate webs that connect distant points. In Parthenon, Arachne weaves a web of federated data nodes, enabling studies to execute across multiple institutions without centralizing patient data.

### The Problem She Solves

The fundamental tension in multi-site clinical research: you need data from many hospitals to achieve statistical power, but you can't (and shouldn't) move patient data to a central location. HIPAA, GDPR, and institutional policies all forbid it. The traditional solution — months of IRB negotiations, data use agreements, and manual result aggregation — makes large-scale studies impractical.

### How She Works

Arachne integrates with [OHDSI Arachne Central](https://github.com/OHDSI/Arachne), a federated execution platform. The workflow:

1. **Study Design (Parthenon):** A researcher designs their study — cohort definitions, analysis packages, outcome measures — entirely within Parthenon's study workspace.

2. **Node Discovery (Arachne):** Parthenon queries Arachne Central for available data nodes — institutions that have registered their OMOP CDM databases and agreed to participate in federated analyses.

3. **Distribution (Arachne):** With one click, the researcher distributes their analysis package to selected nodes. Arachne Central handles authentication, package delivery, and execution coordination.

4. **Execution (Remote):** Each data node runs the analysis locally against its own OMOP CDM database. Patient-level data never leaves the institution. Only aggregate results (counts, statistics, effect estimates) are returned.

5. **Aggregation (Parthenon):** Results flow back through Arachne Central into Parthenon, where they're displayed in a unified results viewer with per-node breakdowns.

### What Makes Her Special

Arachne makes the federated model *invisible* to the researcher. You don't need to know which hospitals are participating, what their IRB requirements are, or how to package an R script for remote execution. You design your study, click "Distribute," and watch results arrive from across the network.

The Federated Execution tab in Parthenon's study workspace shows real-time status for each node — queued, running, completed, or failed — with the ability to drill into per-node results. It transforms what used to be a months-long coordination effort into a same-day operation.

---

## The Pantheon Together

These four engines are independent but complementary. A typical research workflow touches all of them:

1. **Hecate** helps you *find* the concepts you're looking for, even when you don't know the exact vocabulary terms
2. **Phoebe** helps you *complete* your concept set by recommending related concepts you might have missed
3. **Ariadne** helps you *map* your source data to the OMOP standard, so your local data is compatible with the global network
4. **Arachne** helps you *execute* your study across that global network, bringing federated evidence to bear on your research question

They're named after figures from Greek mythology not as a whimsical branding exercise, but because each one's mythological role maps precisely to their function in the platform. Hecate illuminates hidden paths. Phoebe prophesies connections. Ariadne provides the thread through the labyrinth. Arachne weaves the web that connects distant nodes.

Together, they make Parthenon more than a tool — they make it an intelligent research companion that understands clinical vocabularies, anticipates researcher needs, and bridges the gap between local data and global evidence.

---

*The Magical Ladies of Parthenon are all open-source, built on OHDSI standards, and running in production at Acumenus Data Sciences. If you'd like to learn more about any of them, explore the [Parthenon documentation](https://parthenon.acumenus.net/docs) or reach out to the team.*
