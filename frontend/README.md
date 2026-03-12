# Parthenon Frontend

React 19 SPA for the Parthenon outcomes research platform.

## Tech Stack

- **React 19** + TypeScript strict mode
- **Vite 7** build tooling
- **Tailwind CSS 4** with dark clinical theme
- **Zustand** for state management
- **TanStack Query** for server state / caching
- **TanStack Table** for data grids

## Feature Modules (33)

- `abby-ai`
- `administration`
- `analyses`
- `auth`
- `care-gaps`
- `cohort-definitions`
- `concept-sets`
- `dashboard`
- `data-explorer`
- `data-sources`
- `estimation`
- `etl`
- `evidence-synthesis`
- `genomics`
- `gis`
- `help`
- `heor`
- `imaging`
- `ingestion`
- `jobs`
- `pathways`
- `phenotype-library`
- `prediction`
- `profiles`
- `publish`
- `radiogenomics`
- `sccs`
- `settings`
- `strategus`
- `studies`
- `study-agent`
- `text-to-sql`
- `vocabulary`

## Stats

- **65** page components
- **38** test files

## Development

```bash
npm install --legacy-peer-deps   # Required for react-joyride peer dep
npm run dev                      # Vite dev server (port 5175)
npx vitest run                   # Run tests
npx tsc --noEmit                 # Type check
npx eslint .                     # Lint
```

## Design System

Dark clinical theme colors:
- `#0E0E11` — base background
- `#9B1B30` — crimson accent
- `#C9A227` — gold highlight
- `#2DD4BF` — teal positive
- `#F0EDE8` — primary text

## Directory Structure

```
src/
  features/        # Feature modules (cohort-definitions/, analyses/, etc.)
    {feature}/
      pages/       # Route-level page components
      components/  # Feature-specific components
      hooks/       # Custom React hooks
      api.ts       # TanStack Query hooks
  components/      # Shared UI components
  stores/          # Zustand stores
  types/           # TypeScript types
  lib/             # Utilities, API client
```
