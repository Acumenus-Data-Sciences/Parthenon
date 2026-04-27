## 2024-04-27 - MainLayout Context Re-renders
**Learning:** Found an anti-pattern in the top-level MainLayout.tsx component where multiple Context Providers (SetupWizardContext, AtlasMigrationContext) were using inline object values. This forces re-renders on all context consumers whenever MainLayout updates.
**Action:** Always wrap context values in useMemo, especially near the root of the component tree, as these inline objects cascade re-renders to all children. State setter functions (like from useState) are stable and don't need to be in the dependency array.
