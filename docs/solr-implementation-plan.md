# Apache Solr Integration Plan for Parthenon

## Overview

Integrate Apache Solr as a read-optimized search and filtering layer alongside PostgreSQL to dramatically improve loading speeds for data-heavy pages across the Parthenon platform. Solr handles discovery, filtering, and faceted navigation; PostgreSQL remains the authoritative data store and handles writes, complex joins, and transactional logic.

## Architecture

```
User Query → React (TanStack Query) → Laravel API Controller
                                            │
                              ┌──────────────┴──────────────┐
                              ▼                              ▼
                     Solr (search/filter/facets)     PostgreSQL (writes/joins)
                              │
                              ▼
                     Return IDs + facet counts
                              │
                              ▼
                     Hydrate from PostgreSQL if needed
```

### Key Principles

- Solr is **read-only** from the application's perspective — all writes go to PostgreSQL first
- Solr is **eventually consistent** — updates propagate via Laravel events and Horizon queue jobs
- RBAC is enforced via Solr `fq` (filter query) parameters, not post-query filtering
- Each logical domain gets its own Solr core for independent scaling and schema management

---

## Phase 1: Infrastructure Setup

### 1.1 Install and Configure Solr

Add Solr to the existing Docker Compose setup.

**File:** `docker-compose.yml`

Add a new service:

```yaml
solr:
  image: solr:9.7
  container_name: parthenon-solr
  ports:
    - "8983:8983"
  volumes:
    - solr_data:/var/solr
    - ./solr/configsets:/opt/solr/server/solr/configsets
  environment:
    - SOLR_JAVA_MEM=-Xms512m -Xmx2g
  command: solr-precreate vocabulary /opt/solr/server/solr/configsets/vocabulary
  networks:
    - parthenon
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8983/solr/admin/ping"]
    interval: 30s
    timeout: 10s
    retries: 5
```

Add `solr_data` to the volumes section.

### 1.2 Install Solarium PHP Client

```bash
composer require solarium/solarium
```

### 1.3 Create Laravel Configuration

**File:** `config/solr.php`

```php
<?php

return [
    'endpoint' => [
        'default' => [
            'host' => env('SOLR_HOST', 'solr'),
            'port' => env('SOLR_PORT', 8983),
            'path' => '/',
            'timeout' => env('SOLR_TIMEOUT', 5),
        ],
    ],
    'cores' => [
        'vocabulary' => env('SOLR_CORE_VOCABULARY', 'vocabulary'),
        'cohorts' => env('SOLR_CORE_COHORTS', 'cohorts'),
        'analyses' => env('SOLR_CORE_ANALYSES', 'analyses'),
        'mappings' => env('SOLR_CORE_MAPPINGS', 'mappings'),
        'clinical' => env('SOLR_CORE_CLINICAL', 'clinical'),
    ],
];
```

**File:** `.env` additions

```env
SOLR_HOST=solr
SOLR_PORT=8983
SOLR_TIMEOUT=5
SOLR_CORE_VOCABULARY=vocabulary
SOLR_CORE_COHORTS=cohorts
SOLR_CORE_ANALYSES=analyses
SOLR_CORE_MAPPINGS=mappings
SOLR_CORE_CLINICAL=clinical
```

### 1.4 Create Solr Service Provider

**File:** `app/Providers/SolrServiceProvider.php`

Register a Solarium client singleton in the Laravel container. Bind each core as a named instance so controllers and services can inject the specific core they need.

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Solarium\Client;
use Solarium\Core\Client\Adapter\Curl;
use Symfony\Component\EventDispatcher\EventDispatcher;

class SolrServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Client::class, function ($app) {
            $config = [
                'endpoint' => config('solr.endpoint'),
            ];
            $adapter = new Curl();
            $eventDispatcher = new EventDispatcher();
            return new Client($adapter, $eventDispatcher, $config);
        });
    }
}
```

Register in `bootstrap/providers.php`.

---

## Phase 2: Vocabulary Search Core (Highest Priority)

This is the single biggest performance win. The vocabulary browser searches 7M+ concepts with ILIKE — Solr will reduce this to sub-100ms responses.

### 2.1 Solr Schema — `vocabulary` Core

**File:** `solr/configsets/vocabulary/managed-schema`

Define the following fields:

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `concept_id` | pint | yes | yes | Primary key |
| `concept_name` | text_general | yes | yes | Main search field |
| `concept_name_sort` | string | yes | yes | Lowercase copy for sorting |
| `concept_name_suggest` | text_suggest | no | yes | Autocomplete copyField |
| `concept_code` | string | yes | yes | Exact code lookup |
| `concept_synonyms` | text_general | yes | yes | Multi-valued, from concept_synonym table |
| `domain_id` | string | yes | yes | Facet field |
| `vocabulary_id` | string | yes | yes | Facet field |
| `concept_class_id` | string | yes | yes | Facet field |
| `standard_concept` | string | yes | yes | S/C/null — facet field |
| `invalid_reason` | string | yes | yes | D/U/null |
| `valid_start_date` | pdate | yes | yes | |
| `valid_end_date` | pdate | yes | yes | |

Add a `text_suggest` field type for autocomplete:

```xml
<fieldType name="text_suggest" class="solr.TextField" positionIncrementGap="100">
  <analyzer type="index">
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.LowerCaseFilterFactory"/>
    <filter class="solr.EdgeNGramFilterFactory" minGramSize="2" maxGramSize="25"/>
  </analyzer>
  <analyzer type="query">
    <tokenizer class="solr.StandardTokenizerFactory"/>
    <filter class="solr.LowerCaseFilterFactory"/>
  </analyzer>
</fieldType>
```

Add a `copyField` directive:

```xml
<copyField source="concept_name" dest="concept_name_suggest"/>
```

Configure the suggest component in `solrconfig.xml`:

```xml
<searchComponent name="suggest" class="solr.SuggestComponent">
  <lst name="suggester">
    <str name="name">conceptSuggester</str>
    <str name="lookupImpl">AnalyzingInfixLookupFactory</str>
    <str name="dictionaryImpl">DocumentDictionaryFactory</str>
    <str name="field">concept_name</str>
    <str name="suggestAnalyzerFieldType">text_suggest</str>
    <str name="buildOnStartup">true</str>
    <str name="buildOnCommit">true</str>
  </lst>
</searchComponent>

<requestHandler name="/suggest" class="solr.SearchHandler" startup="lazy">
  <lst name="defaults">
    <str name="suggest">true</str>
    <str name="suggest.count">10</str>
    <str name="suggest.dictionary">conceptSuggester</str>
  </lst>
  <arr name="components">
    <str>suggest</str>
  </arr>
</requestHandler>
```

### 2.2 Vocabulary Indexing Command

**File:** `app/Console/Commands/SolrIndexVocabulary.php`

Create an Artisan command: `php artisan solr:index-vocabulary`

Logic:
1. Connect to the `vocabulary` Solr core via Solarium
2. Query the PostgreSQL `concept` table in chunks of 5,000 rows using `Concept::query()->with('synonyms')->chunk(5000, ...)`
3. For each chunk, build Solr update documents:
   - Map all concept fields to the schema above
   - Collect synonyms into a multi-valued `concept_synonyms` field
4. Send buffered updates to Solr (use Solarium's `BufferedAdd` plugin with buffer size 1000)
5. Commit after all chunks are processed
6. Optimize the core
7. Log progress: total indexed, elapsed time, rate

Add `--domain` and `--vocabulary` flags to allow partial reindexing.

Expected runtime: ~15-30 minutes for 7M concepts (one-time, run during deployment or OMOP vocabulary updates).

### 2.3 Vocabulary Search Service

**File:** `app/Services/Solr/VocabularySearchService.php`

Replace the existing `VocabularyLookupService` search methods with Solr queries. This service should:

1. **`search(string $query, array $filters, int $limit, int $offset): SearchResult`**
   - Build a Solr `edismax` query on fields: `concept_name^3 concept_code^2 concept_synonyms^1`
   - Apply filter queries (`fq`) for:
     - `domain_id` (if provided)
     - `vocabulary_id` (if provided)
     - `concept_class_id` (if provided)
     - `standard_concept` (if provided)
     - `invalid_reason:null` (default: exclude invalid concepts)
   - Request facet counts for `domain_id`, `vocabulary_id`, `concept_class_id`, `standard_concept`
   - Return a `SearchResult` DTO containing: matched concept IDs, total count, facet counts, highlighting snippets
   - Use Solr highlighting on `concept_name` and `concept_synonyms`

2. **`suggest(string $prefix, int $limit = 10): array`**
   - Hit the `/suggest` handler for typeahead
   - Return array of `['concept_id' => int, 'concept_name' => string]`

3. **`getById(int $conceptId): ?array`**
   - Direct lookup by `concept_id` for cache warming

### 2.4 Update VocabularyController

**File:** `app/Http/Controllers/Api/V1/VocabularyController.php`

Modify the existing `search` endpoint:
- Inject `VocabularySearchService`
- Replace the ILIKE-based query with `$solrService->search(...)`
- Return facet counts in the response alongside results
- Fall back to PostgreSQL if Solr is unavailable (circuit breaker pattern)

Add a new endpoint:

```
GET /api/v1/vocabulary/suggest?q={prefix}
```

Returns typeahead suggestions from Solr's suggest component.

### 2.5 Update React Frontend — Vocabulary Browser

**File:** `resources/js/Pages/Vocabulary/VocabularyPage.tsx`

Changes:
- Add faceted filter sidebar using the facet counts returned from the API
  - Domain (checkboxes with counts)
  - Vocabulary (checkboxes with counts)
  - Concept Class (checkboxes with counts)
  - Standard Concept (toggle: Standard / Classification / Non-standard)
- Implement typeahead/autocomplete using the `/suggest` endpoint with debounced input (300ms)
- Update TanStack Query hooks to include facet filters as query parameters
- Show highlighted matches in search results (use `dangerouslySetInnerHTML` with sanitized Solr highlights)

---

## Phase 3: Cohort and Study Discovery

### 3.1 Solr Schema — `cohorts` Core

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `id` | string | yes | yes | `cohort_{id}` or `study_{id}` |
| `type` | string | yes | yes | "cohort" or "study" |
| `name` | text_general | yes | yes | Boosted search field |
| `description` | text_general | yes | yes | |
| `tags` | string | yes | yes | Multi-valued, facet |
| `author_name` | string | yes | yes | Facet field |
| `author_id` | pint | yes | yes | For RBAC filtering |
| `status` | string | yes | yes | Facet field |
| `created_at` | pdate | yes | yes | Sort/filter |
| `updated_at` | pdate | yes | yes | Sort/filter |
| `person_count` | pint | yes | yes | For cohort size display |
| `source_ids` | pint | yes | yes | Multi-valued, for RBAC source filtering |

Study-specific fields:

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `phase` | string | yes | yes | Facet |
| `scientific_rationale` | text_general | yes | no | Search only |
| `hypothesis` | text_general | yes | no | Search only |
| `pi_name` | string | yes | yes | Facet |

### 3.2 Indexing Strategy

Create Artisan command: `php artisan solr:index-cohorts`

Additionally, set up **real-time delta indexing** via Laravel model events:

**File:** `app/Observers/CohortDefinitionObserver.php`

On `created`, `updated`, `deleted` events:
- Dispatch a `SolrUpdateJob` to the `solr` queue (processed by Horizon)
- The job pushes the updated document to Solr or deletes it
- Use a 5-second delay to debounce rapid successive updates

Register the observer in `AppServiceProvider`.

Create equivalent observers for `Study`, `StudyTeamMember`, and `CohortGeneration` (to update person counts).

### 3.3 Cohort/Study Search Service

**File:** `app/Services/Solr/CohortSearchService.php`

Methods:
- `search(string $query, array $filters, User $user): SearchResult` — enforces RBAC by adding `fq=source_ids:(1 OR 3 OR 7)` based on user's authorized sources
- `recentlyUpdated(User $user, int $limit = 10): array` — sorted by `updated_at` desc for dashboard widgets

### 3.4 Update Controllers and Frontend

- Update `CohortDefinitionController@index` and `StudyController@index` to use Solr for listing/searching
- Add faceted filters to cohort and study listing pages (by status, author, tags, phase)
- Add a unified "global search" component that searches across cohorts, studies, and vocabulary simultaneously

---

## Phase 4: Analysis Results and Data Explorer

### 4.1 Solr Schema — `analyses` Core

This core indexes **analysis metadata**, not individual result rows. The goal is fast navigation and filtering of the ~200+ Achilles analyses and their stratified results.

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `analysis_id` | pint | yes | yes | Achilles analysis ID |
| `analysis_name` | text_general | yes | yes | Search field |
| `analysis_description` | text_general | yes | yes | Search field |
| `category` | string | yes | yes | Facet (e.g., "Person", "Condition", "Drug") |
| `source_id` | pint | yes | yes | Facet / RBAC filter |
| `source_name` | string | yes | yes | Display |
| `strata_values` | text_general | yes | yes | Multi-valued, searchable strata labels |
| `record_count` | plong | yes | yes | Total result rows for this analysis |
| `last_run_at` | pdate | yes | yes | |

### 4.2 Indexing

Create Artisan command: `php artisan solr:index-analyses`

Run after each Achilles execution completes. Hook into the existing `AchillesJob` completion event to trigger reindexing of affected analyses.

### 4.3 Data Explorer Integration

Update the Data Explorer page to:
- Use Solr for the analysis picker (search by name, filter by category and source)
- Show faceted counts per category
- Pre-fetch analysis metadata from Solr to populate the sidebar navigation instantly
- Continue loading actual result data from PostgreSQL once an analysis is selected (Solr just accelerates the navigation layer)

---

## Phase 5: Concept Mapping and Ingestion

### 5.1 Solr Schema — `mappings` Core

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `mapping_id` | pint | yes | yes | Primary key |
| `source_value` | text_general | yes | yes | Source code/term |
| `source_field` | string | yes | yes | Facet |
| `target_concept_id` | pint | yes | yes | |
| `target_concept_name` | text_general | yes | yes | |
| `mapping_status` | string | yes | yes | Facet (pending/approved/rejected) |
| `confidence_score` | pfloat | yes | yes | Range filter |
| `ingestion_job_id` | pint | yes | yes | Facet |
| `reviewed_by` | string | yes | yes | |
| `created_at` | pdate | yes | yes | |

### 5.2 Integration

- Index mappings on creation during ingestion pipeline
- Use Solr for the mapping review queue — filter by status, confidence range, source field
- Enable full-text search across source values and target concept names
- Show faceted counts by mapping status for the ingestion dashboard summary cards

---

## Phase 6: Clinical Data Search (Optional / Future)

### 6.1 Solr Schema — `clinical` Core

This is optional and depends on data volume. For sources with millions of events, Solr can power the patient timeline search.

| Field | Type | Stored | Indexed | Notes |
|-------|------|--------|---------|-------|
| `event_id` | string | yes | yes | `{table}_{id}` |
| `event_type` | string | yes | yes | condition/drug/procedure/measurement |
| `person_id` | plong | yes | yes | |
| `concept_name` | text_general | yes | yes | |
| `concept_id` | pint | yes | yes | |
| `event_date` | pdate | yes | yes | |
| `source_id` | pint | yes | yes | RBAC |
| `value_as_number` | pfloat | yes | yes | For measurements |
| `value_as_string` | text_general | yes | yes | |

### 6.2 Use Cases

- Patient timeline search: find all events matching a concept name within a date range
- Cross-patient event search: find all patients with a specific condition + drug combination
- Measurement value range filtering

---

## Phase 7: Frontend Global Search

### 7.1 Unified Search Component

**File:** `resources/js/Components/GlobalSearch.tsx`

Create a command-palette style search (Cmd+K / Ctrl+K) that queries multiple Solr cores simultaneously:

```typescript
interface GlobalSearchResult {
  type: 'concept' | 'cohort' | 'study' | 'analysis' | 'mapping';
  id: number;
  title: string;
  subtitle: string;
  highlight?: string;
  url: string;
}
```

Backend endpoint: `GET /api/v1/search?q={query}&types[]=concept&types[]=cohort`

The Laravel controller fans out to multiple Solr cores in parallel (using Laravel's `Http::pool()` or async Solarium queries) and merges results by relevance.

### 7.2 Search Result Caching

Use Redis (already in the stack) to cache frequent Solr queries:

- Vocabulary searches: cache for 1 hour (vocabulary data rarely changes)
- Cohort/study searches: cache for 5 minutes (changes more often)
- Analysis metadata: cache for 30 minutes
- Bust cache on relevant model events

Configure in `VocabularySearchService` and others using Laravel's `Cache::remember()`.

---

## Cross-Cutting Concerns

### RBAC Enforcement in Solr

Every search request must include source-level access restrictions as Solr filter queries:

```php
// In a base SolrSearchService class
protected function applyRbacFilters(Query $query, User $user): void
{
    if (!$user->hasRole('super-admin')) {
        $sourceIds = $user->authorizedSourceIds();
        $query->createFilterQuery('rbac')
              ->setQuery('source_ids:(' . implode(' OR ', $sourceIds) . ')');
    }
}
```

Filter queries are cached independently in Solr, so the RBAC filter is computed once and reused across different search queries for the same user.

### Circuit Breaker / Fallback

Wrap all Solr calls in a circuit breaker so the application degrades gracefully:

**File:** `app/Services/Solr/SolrClientWrapper.php`

```php
public function query(string $core, callable $queryBuilder): mixed
{
    if ($this->circuitBreaker->isOpen()) {
        Log::warning("Solr circuit breaker open, falling back to PostgreSQL");
        return null; // Caller handles fallback
    }

    try {
        $result = $queryBuilder($this->client);
        $this->circuitBreaker->recordSuccess();
        return $result;
    } catch (SolrException $e) {
        $this->circuitBreaker->recordFailure();
        Log::error("Solr query failed", ['error' => $e->getMessage()]);
        return null;
    }
}
```

Controllers check for `null` and fall back to the existing PostgreSQL queries.

### Health Monitoring

Add a Solr health check to the existing health endpoint:

**File:** `app/Http/Controllers/Api/V1/HealthController.php`

Ping each Solr core and report status. Include document counts and last commit time.

### Testing

- **Unit tests:** Mock the Solarium client in service tests
- **Integration tests:** Use a `solr-test` core with a small dataset (1,000 concepts) for search accuracy tests
- **Performance tests:** Benchmark Solr vs PostgreSQL query times for vocabulary search at various dataset sizes

---

## Deployment Checklist

### Initial Setup
- [ ] Add Solr service to `docker-compose.yml`
- [ ] Create Solr configsets for each core (`solr/configsets/{core}/`)
- [ ] Install Solarium: `composer require solarium/solarium`
- [ ] Create `config/solr.php` and add `.env` variables
- [ ] Register `SolrServiceProvider`
- [ ] Create `SolrClientWrapper` with circuit breaker

### Per-Core Rollout (repeat for each core)
- [ ] Define managed-schema with field types and fields
- [ ] Configure solrconfig.xml (request handlers, suggest component if needed)
- [ ] Create indexing Artisan command
- [ ] Create search service class
- [ ] Create model observer(s) for delta indexing
- [ ] Create Horizon queue job for async Solr updates
- [ ] Update controller to use Solr service with PostgreSQL fallback
- [ ] Update frontend to consume new response format (facets, highlights)
- [ ] Write tests (unit + integration)
- [ ] Run full index and verify document counts

### Recommended Rollout Order
1. **Vocabulary** — highest impact, static data, lowest risk
2. **Cohorts/Studies** — moderate impact, simple schema
3. **Analyses** — improves Data Explorer navigation
4. **Mappings** — improves ingestion workflow
5. **Clinical** — highest complexity, evaluate need based on data volume
6. **Global Search** — ties everything together, deploy last

---

## Performance Expectations

| Page | Current (PostgreSQL ILIKE) | Expected (Solr) | Improvement |
|------|---------------------------|-----------------|-------------|
| Vocabulary search | 500-2000ms | 20-80ms | 10-25x |
| Vocabulary autocomplete | 300-800ms | 10-30ms | 15-30x |
| Cohort listing with search | 200-500ms | 30-60ms | 5-10x |
| Data Explorer navigation | 300-1000ms | 20-50ms | 10-20x |
| Mapping review queue | 200-600ms | 30-70ms | 5-10x |
| Faceted counts | N/A (not available) | 5-15ms overhead | New capability |

---

## Notes for Implementation

- **Do not remove existing PostgreSQL search logic** — keep it as the fallback path behind the circuit breaker
- **Semantic search stays on pgvector** — Solr handles keyword/faceted search; the existing SapBERT embedding search via pgvector is complementary, not replaced
- **Solr version:** Use 9.x for the latest features (JSON facet API, streaming expressions)
- **Memory:** Allocate 2GB heap minimum for Solr in production; increase to 4GB if indexing the clinical core
- **Disk:** Vocabulary core will be ~2-4GB on disk; plan for 10-20GB total across all cores
