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

const enAbbyLegacy: MessageTree = {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "Intelligent Cohort Builder",
      newQuery: "New query",
      examplesTitle: "Try an example",
      examples: {
        diabetesMetformin: "Patients with Type 2 diabetes on metformin",
        aceInhibitors:
          "New users of ACE inhibitors without prior heart failure",
        hipFracture: "Patients aged 65+ with first hip fracture",
        breastCancerChemo:
          "Women with breast cancer who received chemotherapy",
      },
      analyzing: "Abby is analyzing your research question",
      errorTitle: "Something went wrong",
      errorFallback: "Failed to process your request. Please try again.",
      analysisTitle: "Analysis",
      conceptSetsTitle: "Concept Sets ({{count}})",
      conceptsCount_one: "{{count}} concept",
      conceptsCount_other: "{{count}} concepts",
      applyToBuilder: "Apply to Builder",
      refine: "Refine",
      refinePlaceholder: "How would you like to modify this cohort?",
      refineCohort: "Refine Cohort",
      promptPlaceholder: "Describe your target population...",
      buildCohort: "Build Cohort",
    },
    plan: {
      title: "Action Plan",
      status: {
        executing: "Executing...",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      },
      actions: {
        approveAndExecute: "Approve & Execute",
        cancel: "Cancel",
      },
      runningSteps: "Running plan steps...",
      success: "All steps completed successfully.",
      failure: "One or more steps failed. Remaining steps were skipped.",
    },
    profile: {
      loading: "Loading profile...",
      failed: "Failed to load profile",
      title: "My Research Profile",
      reset: "Reset",
      researchInterests: "Research Interests",
      expertise: "Expertise",
      responseStyle: "Response Style",
      verbosity: {
        terse: "Concise",
        normal: "Standard",
        verbose: "Detailed",
      },
      learningMessage:
        "Abby is learning about your research interests. Keep chatting and she will build your profile automatically.",
    },
  },
};

export const abbyLegacyResources: Record<string, MessageTree> = {
  "en-US": enAbbyLegacy,
  "es-ES": mergeMessageTrees(enAbbyLegacy, {}),
  "fr-FR": mergeMessageTrees(enAbbyLegacy, {}),
  "de-DE": mergeMessageTrees(enAbbyLegacy, {}),
  "pt-BR": mergeMessageTrees(enAbbyLegacy, {}),
  "fi-FI": mergeMessageTrees(enAbbyLegacy, {}),
  "ja-JP": mergeMessageTrees(enAbbyLegacy, {}),
  "zh-Hans": mergeMessageTrees(enAbbyLegacy, {}),
  "ko-KR": mergeMessageTrees(enAbbyLegacy, {}),
  "hi-IN": mergeMessageTrees(enAbbyLegacy, {}),
  ar: mergeMessageTrees(enAbbyLegacy, {}),
  "en-XA": mergeMessageTrees(enAbbyLegacy, {}),
};
