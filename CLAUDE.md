# Parthenon — Project Context for Claude Code

## What This Project Is

Parthenon is a unified OHDSI outcomes research platform that replaces Atlas, WebAPI, Achilles, DQD, and 15+ other disconnected tools with a single application built on OMOP CDM v5.4. It serves clinical researchers, data engineers, and healthcare organizations running population-level studies.

## Tech Stack

- **Backend:** Laravel 11, PHP 8.4, Sanctum auth, Spatie RBAC, Horizon queues
- **Frontend:** React 19, TypeScript strict, Vite 7, Tailwind 4, Zustand state, TanStack Query/Table
- **AI Service:** Python 3.12, FastAPI, Ollama (MedGemma), pgvector for embeddings
- **R Runtime:** R 4.4, Plumber API, HADES packages (CohortMethod, PatientLevelPrediction)
- **Database:** PostgreSQL 16 (Docker) + PostgreSQL 17 (host), pgvector, Redis 7
- **Infrastructure:** Docker Compose (8 services), Nginx proxy, deploy.sh

## Database Schemas

Queries MUST specify schema context. The database uses multiple schemas:

- `app` — Application tables (users, roles, cohort_definitions, studies, etc.)
- `vocab` — OMOP Vocabulary tables (concept, concept_relationship, vocabulary, etc.)
- `cdm` — OMOP CDM clinical tables (person, visit_occurrence, condition_occurrence, etc.)
- `achilles_results` — Achilles characterization output tables
- `public` — Default PostgreSQL schema (migrations, jobs, etc.)

Example: `DB::table('cdm.person')` not `DB::table('person')`

## Project Structure

```
backend/
  app/
    Models/          — Eloquent models, organized by domain (App/, Cdm/, Vocabulary/, Results/)
    Http/
      Controllers/Api/V1/  — All API controllers
      Requests/             — Form Request validation classes
    Services/        — Business logic (AI/, Achilles/, Cohort/, Dqd/, Fhir/, etc.)
    Jobs/            — Queue jobs (Horizon)
  routes/api.php     — All API routes
  database/migrations/

frontend/
  src/
    features/        — Feature modules (cohort-definitions/, analyses/, genomics/, etc.)
      {feature}/
        pages/       — Route-level page components
        components/  — Feature-specific components
        hooks/       — Feature-specific React hooks
        api.ts       — TanStack Query hooks for API calls
    components/      — Shared UI components
    lib/             — Utilities, API client (Axios)
    stores/          — Zustand stores
    types/           — TypeScript types (api.generated.ts from OpenAPI)

ai/
  app/               — FastAPI application
  requirements.txt

r-runtime/
  plumber_api.R      — R Plumber endpoints
```

## Key Patterns

### Backend (Laravel)
- Use **Form Requests** for validation (not inline `$request->validate()`)
- Use **Eloquent scopes** for reusable query filters
- Use **eager loading** (`with()`) to avoid N+1 queries — critical for large OMOP datasets
- Return types on all public controller methods
- PHPStan level 8 — all public methods need full type hints

### Frontend (React)
- API calls go through **TanStack Query** hooks (not raw fetch/useEffect)
- State management via **Zustand** stores
- Validate API responses with **Zod** schemas
- No `any` types — use `unknown` and narrow
- Components follow **dark clinical theme**: #0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal
- Install npm packages with `--legacy-peer-deps` (react-joyride peer dep issue)

### Python (AI Service)
- FastAPI with Pydantic v2 models
- pgvector for concept embeddings
- Ollama integration for LLM features

## Testing & Linting Commands

```bash
# Run everything
make test          # Pest + Vitest + pytest
make lint          # Pint + PHPStan + ESLint + mypy

# Individual stacks
cd backend && vendor/bin/pest                    # PHP tests
cd backend && vendor/bin/pint --test             # PHP formatting check
cd backend && vendor/bin/phpstan analyse          # PHP static analysis (level 8)
cd frontend && npx vitest run                     # JS/TS tests
cd frontend && npx tsc --noEmit                   # TypeScript check
cd frontend && npx eslint .                       # ESLint
cd ai && pytest                                   # Python tests
cd ai && mypy app/                                # Python type check
```

## Branch & Commit Conventions

- Feature branches: `feature/phase-N-slug` or `feature/description`
- Bug fixes: `fix/description`
- Maintenance: `chore/description`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`)

## Common Gotchas

1. Multi-schema DB — always qualify table names with schema prefix
2. React 19 strict mode — components render twice in dev, effects must be idempotent
3. `--legacy-peer-deps` required for `npm install` (react-joyride compatibility)
4. PHPStan baseline exists at `backend/phpstan-baseline.neon` — check it before adding new ignores
5. OpenAPI types are auto-generated — don't edit `frontend/src/types/api.generated.ts` manually
6. Docker services have health checks — use `docker compose ps` to verify before testing
7. The R runtime container takes ~60s to start (HADES package loading)

## Docker Services

```bash
docker compose up -d                  # Start all services
docker compose ps                     # Check health
docker compose exec php bash          # Shell into PHP container
docker compose exec postgres psql -U parthenon  # Database shell
docker compose logs -f php            # Follow PHP logs
```

## Key URLs (Development)

- App: http://localhost:8082
- Vite dev server: http://localhost:5175
- API health: http://localhost:8082/api/v1/health
- AI service: http://localhost:8002
- Horizon dashboard: http://localhost:8082/horizon
- Production: https://parthenon.acumenus.net
