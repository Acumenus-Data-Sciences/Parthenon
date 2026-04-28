# Bolt Performance Journal

## 2026-04-28 - Array Mapping and Searching Bottlenecks
**Learning:** Found an O(N*M) nested loop pattern inside a render mapping: `.map(id => list.find(c => c.id === id))` without memoization in `CohortBuilder.tsx`. This causes significant recomputation on each re-render, especially with larger lists.
**Action:** Extract list mappings that require inner lookups out to a `useMemo` block and preprocess the inner list into a `Map` structure for O(1) lookups instead of `.find()` O(M) inside the `.map()` loop.
