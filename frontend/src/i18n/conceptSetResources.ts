type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(base: MessageTree, overrides: MessageTree): MessageTree {
  return Object.fromEntries(
    Object.entries(base).map(([key, baseValue]) => {
      const overrideValue = overrides[key];
      if (
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue)
      ) {
        return [
          key,
          mergeMessageTrees(
            baseValue,
            overrideValue &&
              typeof overrideValue === "object" &&
              !Array.isArray(overrideValue)
              ? overrideValue
              : {},
          ),
        ];
      }

      return [key, overrideValue ?? baseValue];
    }),
  );
}

const enConceptSet: MessageTree = {
  conceptSets: {
    page: {
      title: "Concept Sets",
      subtitle:
        "Define and manage reusable concept sets for cohort definitions and analyses",
      searchPlaceholder: "Search concept sets...",
      untitledName: "Untitled Concept Set",
      newConceptSet: "New Concept Set",
      fromBundle: "From Bundle",
      import: "Import",
    },
    list: {
      failedToLoad: "Failed to load concept sets",
      emptyTitle: "No concept sets",
      emptyMessage:
        "Create your first concept set to start building definitions.",
      noMatchingTitle: "No matching concept sets",
      noMatchingMessage: "Try adjusting your search or tag filters.",
      myConceptSets: "My Concept Sets",
      allConceptSets: "All Concept Sets",
      showingRange: "Showing {{start}} - {{end}} of {{total}}",
      columns: {
        name: "Name",
        author: "Author",
        visibility: "Visibility",
        items: "Items",
        tags: "Tags",
        updated: "Updated",
      },
      visibility: {
        public: "Public",
        private: "Private",
      },
    },
    builder: {
      tabs: {
        keyword: "Keyword Search",
        semantic: "Semantic Search",
      },
      setContents: "Set Contents",
      concept_one: "{{count}} concept",
      concept_other: "{{count}} concepts",
    },
    editor: {
      itemCount_one: "{{count}} item",
      itemCount_other: "{{count}} items",
      resolve: "Resolve",
      selected_one: "{{count}} selected",
      selected_other: "{{count}} selected",
      descendantsOn: "Descendants On",
      descendantsOff: "Descendants Off",
      mappedOn: "Mapped On",
      mappedOff: "Mapped Off",
      exclude: "Exclude",
      include: "Include",
      resolvedTo_one: "Resolved to {{count}} concept",
      resolvedTo_other: "Resolved to {{count}} concepts",
      columns: {
        conceptId: "Concept ID",
        name: "Name",
        domain: "Domain",
        vocabulary: "Vocabulary",
        standard: "Standard",
        excluded: "Excluded",
        descendants: "Descendants",
        mapped: "Mapped",
        actions: "Actions",
      },
      emptyTitle: "No concepts added yet",
      emptyMessage: "Use the search panel to find and add concepts to this set",
      toggleLabels: {
        excludeConcept: "Exclude concept",
        includeDescendants: "Include descendants",
        includeMapped: "Include mapped",
        removeItem: "Remove item",
      },
    },
    detail: {
      failedToLoad: "Failed to load concept set",
      backToList: "Back to list",
      clickToEdit: "Click to edit",
      addDescription: "Add a description...",
      duplicate: "Duplicate",
      duplicateSuccess: "Duplicated as \"{{name}}\"",
      duplicateFailed: "Failed to duplicate concept set",
      export: "Export",
      exportFallbackName: "concept-set",
      delete: "Delete",
      deleteConfirm: "Are you sure you want to delete this concept set?",
      recommendedConcepts: "Recommended Concepts",
      visibility: {
        public: "Public",
        private: "Private",
      },
    },
    detailTabs: {
      info: "Info",
      hierarchy: "Hierarchy",
      relationships: "Relationships",
      mapsFrom: "Maps From",
      failedToLoadConcept: "Failed to load concept",
      labels: {
        fullName: "Full Name",
        vocabulary: "Vocabulary",
        standard: "Standard",
        conceptClass: "Concept Class",
        domain: "Domain",
        synonyms: "Synonyms",
      },
      noAncestorsFound: "No ancestors found",
      noRelationshipsFound: "No relationships found",
      relationshipsPage: "Page {{page}} of {{totalPages}} - {{total}} total",
      noSourceCodes: "No source codes map to this concept",
      showingSourceCodes: "Showing {{shown}} of {{total}} source codes",
    },
    stats: {
      total: "Total",
      withItems: "With Items",
      public: "Public",
    },
    phoebe: {
      recommendations: "Phoebe Recommendations",
      poweredBy: "Powered by Phoebe",
      addAll_one: "Add All ({{count}})",
      addAll_other: "Add All ({{count}})",
      unavailable: "Recommendations unavailable",
      noneFound: "No recommendations found",
      added: "Added",
      addToConceptSet: "Add to concept set",
      add: "Add",
    },
    bundle: {
      title: "Create from Care Bundle",
      description:
        "Select a disease bundle to auto-generate concept sets grouped by domain (conditions, drugs, measurements).",
      filterPlaceholder: "Filter bundles...",
      noMatching: "No matching bundles",
      noneFound: "No care bundles found",
      namePrefix: "Name Prefix",
      namingHelp:
        "Sets will be named \"{{name}} - Conditions\", \"- Drugs\", etc.",
      create: "Create Concept Sets",
      created_one: "{{count}} concept set created from {{bundle}}",
      created_other: "{{count}} concept sets created from {{bundle}}",
      createFailed: "Failed to create concept sets from bundle",
      measures_one: "{{count}} measure",
      measures_other: "{{count}} measures",
      concepts_one: "{{count}} concept",
      concepts_other: "{{count}} concepts",
    },
    import: {
      title: "Import Concept Set",
      uploadJsonFile: "Upload JSON file",
      chooseFile: "Choose file",
      pasteAtlasJson: "Or paste JSON (Atlas format)",
      placeholder:
        "{\n  \"name\": \"My Concept Set\",\n  \"expression\": { \"items\": [...] }\n}",
      invalidJson: "Invalid JSON - please check your input.",
      importFailed: "Import failed",
      imported: "imported",
      skipped: "skipped",
      failed: "failed",
      close: "Close",
      cancel: "Cancel",
      import: "Import",
    },
  },
  shared: {
    significanceVerdict: {
      protective: "Significant protective effect",
      harmful: "Significant harmful effect",
      notSignificant: "Not statistically significant",
    },
    workbench: {
      statusLabel: "Status:",
      ariaRunStatus: "Run status",
      pollingEvery2s: "polling every 2s",
    },
    conceptSearch: {
      observationsShort: "obs",
    },
  },
};

export const conceptSetResources: Record<string, MessageTree> = {
  "en-US": enConceptSet,
  "es-ES": mergeMessageTrees(enConceptSet, {}),
  "fr-FR": mergeMessageTrees(enConceptSet, {}),
  "de-DE": mergeMessageTrees(enConceptSet, {}),
  "pt-BR": mergeMessageTrees(enConceptSet, {}),
  "fi-FI": mergeMessageTrees(enConceptSet, {}),
  "ja-JP": mergeMessageTrees(enConceptSet, {}),
  "zh-Hans": mergeMessageTrees(enConceptSet, {}),
  "ko-KR": mergeMessageTrees(enConceptSet, {}),
  "hi-IN": mergeMessageTrees(enConceptSet, {}),
  ar: mergeMessageTrees(enConceptSet, {}),
  "en-XA": mergeMessageTrees(enConceptSet, {}),
};
