# ADR-005: Frontend API Layer with TanStack Query

**Status:** Accepted
**Date:** 2026-03-21
**Decision Makers:** Dr. Sanjay Udoshi

## Context

Parthenon's frontend is a React 19 single-page application (SPA) that communicates with a Laravel API backend. The application has extensive data-fetching requirements across 16+ feature modules: vocabulary browsing (2M+ concepts), cohort definitions, Achilles characterization results, data quality dashboards, GIS spatial data, DICOM imaging metadata, genomics, studies, and more.

Naive data-fetching patterns using `useEffect` + `fetch` or raw Axios calls lead to well-documented problems in complex SPAs: duplicated requests when multiple components need the same data, no automatic cache invalidation, manual loading/error state management, race conditions from stale closures, waterfall request patterns, and no background refetching when data goes stale.

The platform also needs to handle mutation workflows (creating cohort definitions, saving concept sets, running analyses) with optimistic updates and automatic cache invalidation.

## Decision

All API communication in the frontend goes through TanStack Query (React Query v5) hooks. The pattern is enforced per feature module:

**File structure per feature:**
```
features/{feature}/
  api.ts          -- TanStack Query hooks (useQuery, useMutation)
  pages/          -- Route-level page components
  components/     -- Feature-specific components
  hooks/          -- Other feature-specific hooks
```

**Rules:**
1. No raw `fetch()` or `useEffect`-based data fetching in components
2. Every API call is wrapped in a `useQuery` or `useMutation` hook defined in `api.ts`
3. An Axios instance (`apiClient`) configured with the base URL and Sanctum token interceptor is the transport layer underneath TanStack Query
4. Query keys follow a hierarchical convention: `['domain', 'entity', ...params]` (e.g., `['morpheus', 'datasets']`, `['achilles', 'demographics', sourceId]`)
5. Components consume hooks, never construct queries directly

**Example pattern from `features/morpheus/api.ts`:**
```typescript
export function useMorpheusDatasets() {
  return useQuery({
    queryKey: ['morpheus', 'datasets'],
    queryFn: async () => {
      const res = await apiClient.get('/morpheus/datasets');
      return res.data.data as MorpheusDataset[];
    },
  });
}
```

**Zustand** stores handle client-side UI state (selected source, sidebar state, theme preferences) but never duplicate server state that TanStack Query manages.

## Consequences

### Positive
- Automatic request deduplication: if three components call `useMorpheusDatasets()`, only one HTTP request is made
- Built-in caching with configurable stale time prevents unnecessary re-fetches during navigation
- Loading, error, and success states are managed by the library, eliminating boilerplate `useState` for `isLoading`/`error` in every component
- Background refetching keeps data fresh when the user returns to a tab or navigates back to a page
- Mutation hooks provide `onSuccess` callbacks for automatic cache invalidation (e.g., invalidate `['cohorts']` after creating a new cohort)
- DevTools integration (TanStack Query Devtools) enables inspecting cache state, active queries, and refetch behavior during development
- Clear separation: TanStack Query owns server state, Zustand owns client state

### Negative
- Learning curve for developers unfamiliar with TanStack Query's caching semantics (stale-while-revalidate, garbage collection, structural sharing)
- Query key management becomes complex in large applications -- inconsistent keys lead to cache misses or stale data
- The `api.ts` file in each feature can grow large as the number of endpoints increases
- Debugging cache invalidation issues requires understanding the query key hierarchy

### Risks
- Over-caching: if `staleTime` is set too high, users may see outdated data after another user modifies a shared resource (e.g., a cohort definition). Mitigated by using short stale times for collaborative features and WebSocket-triggered invalidation via Laravel Reverb for real-time updates.
- Memory pressure: caching large datasets (vocabulary search results, Achilles distributions) in the browser can consume significant memory. Mitigated by TanStack Query's garbage collection (`gcTime`) which removes inactive query data after a configurable period.
- TypeScript `any` leakage: casting API responses with `as Type` bypasses runtime validation. Mitigated by the project rule to validate API responses with Zod schemas and the prohibition on `any` types.

## Alternatives Considered

1. **Raw Axios + useEffect** -- The simplest approach. Rejected because it requires manual cache management, loading state tracking, request deduplication, and race condition handling in every component -- all of which TanStack Query provides out of the box.

2. **SWR (Vercel)** -- A lighter alternative to TanStack Query. Rejected because TanStack Query provides richer mutation support (`useMutation` with optimistic updates), better DevTools, and more granular cache control needed for a complex multi-module application.

3. **Redux Toolkit Query (RTK Query)** -- Data fetching integrated with Redux. Rejected because the project uses Zustand for client state, not Redux, and adopting RTK Query would require bringing in the entire Redux ecosystem.

4. **GraphQL (Apollo Client)** -- Provides automatic caching and type-safe queries. Rejected because the backend is a REST API (Laravel resource controllers), and adding a GraphQL layer would introduce unnecessary complexity without clear benefit for the data access patterns used.

5. **tRPC** -- End-to-end type-safe API layer. Rejected because it requires a Node.js/TypeScript backend, which is incompatible with the Laravel PHP backend.
