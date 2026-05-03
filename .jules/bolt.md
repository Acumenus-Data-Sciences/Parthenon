## 2026-05-03 - [Memoize wiki tree list]
**Learning:** Filtering and map/array creation logic inside of a render cycle without `useMemo` creates severe unnecessary recalculations leading to UI lag on interactions unrelated to data mutation.
**Action:** Use `useMemo` and move static/trim computations like `searchQuery.trim().toLowerCase()` outside of `.filter` loop logic to enhance efficiency and prevent performance bottlenecks.
