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

const enHeor: MessageTree = {
  heor: {
    common: {
      tabs: {
        analyses: "Economic Analyses",
        contracts: "Value Contracts",
        claims: "Claims Explorer",
      },
      actions: {
        newAnalysis: "New Analysis",
        newContract: "New Contract",
        create: "Create",
        cancel: "Cancel",
        open: "Open",
        add: "Add",
        search: "Search",
        clear: "Clear",
        runAnalysis: "Run Analysis",
        backToHeor: "Back to HEOR",
        deleteAnalysis: "Delete analysis",
        deleteContract: "Delete contract",
      },
      status: {
        draft: "Draft",
        running: "Running",
        completed: "Completed",
        failed: "Failed",
        active: "Active",
        expired: "Expired",
      },
      analysisTypes: {
        cea: "Cost-Effectiveness",
        cba: "Cost-Benefit",
        cua: "Cost-Utility",
        budgetImpact: "Budget Impact",
        roi: "ROI Analysis",
      },
      parameterTypes: {
        drugCost: "Drug Cost",
        adminCost: "Admin Cost",
        hospitalization: "Hospitalization",
        erVisit: "ER Visit",
        qalyWeight: "QALY Weight",
        utilityValue: "Utility Value",
        resourceUse: "Resource Use",
        avoidedCost: "Avoided Cost",
        programCost: "Program Cost",
      },
      perspectives: {
        payer: "Payer",
        societal: "Societal",
        provider: "Provider",
        patient: "Patient",
      },
      timeHorizons: {
        oneYear: "1 year",
        fiveYear: "5 years",
        tenYear: "10 years",
        lifetime: "Lifetime",
      },
      scenarioTypes: {
        intervention: "Intervention",
        comparator: "Comparator",
        sensitivity: "Sensitivity",
      },
      labels: {
        totalAnalyses: "Total Analyses",
        completed: "Completed",
        valueContracts: "Value Contracts",
        analysisTypes: "Analysis Types",
        totalCost: "Total Cost",
        totalQalys: "Total QALYs",
        incrementalCost: "Incremental Cost",
        incrementalQalys: "Incremental QALYs",
        icerPerQaly: "ICER ($/QALY)",
        netMonetaryBenefit: "Net Monetary Benefit",
        roi: "ROI",
        paybackMonths: "Payback (months)",
        budgetImpact: "Budget Impact",
        results: "Results",
        scenarios: "Scenarios",
        costParameters: "Cost Parameters",
        patient: "Patient",
        date: "Date",
        type: "Type",
        status: "Status",
        diagnosis: "Diagnosis",
        charge: "Charge",
        payment: "Payment",
        outstanding: "Outstanding",
        transactions: "Txns",
        filters: "Filters",
        page: "Page",
        id: "ID",
        outcome: "Outcome",
        listPrice: "List price",
        baseline: "Baseline",
      },
      values: {
        baseCase: "Base Case",
        year1: "Year 1",
        year2: "Year 2",
        year3: "Year 3",
        year4: "Year 4",
        year5: "Year 5",
        average: "Avg: {{value}}",
        range: "{{min}} - {{max}}",
        moreCount: "+{{count}} more",
      },
      count: {
        scenario_one: "{{count}} scenario",
        scenario_other: "{{count}} scenarios",
        claim_one: "{{count}} claim",
        claim_other: "{{count}} claims",
      },
      placeholders: {
        analysisName: "Analysis name *",
        descriptionOptional: "Description (optional)",
        contractName: "Contract name *",
        drugInterventionName: "Drug / intervention name",
        outcomeMetric: "Outcome metric (e.g. hba1c_reduction)",
        listPriceUsd: "List price (USD)",
        scenarioName: "Scenario name",
        parameterName: "Parameter name *",
        value: "Value *",
        unit: "Unit",
        lowerBound: "Lower bound",
        claimsSearch: "Search claims by patient, diagnosis, procedure, notes...",
      },
      messages: {
        loading: "Loading...",
        noAnalysesYet: 'No analyses yet. Click "New Analysis" to get started.',
        noContractsYet: 'No value contracts defined. Click "New Contract" to start.',
        analysisNotFound: "Analysis not found.",
        running: "Running...",
        computedScenarios: "Computed {{count}} scenarios.",
        noScenariosYet: "No scenarios yet. Add at least one to run the analysis.",
        noParametersYet: "No parameters yet.",
        analysisCompletedNoResults:
          "Analysis completed but no results found. Try re-running.",
        noClaimsMatch: "No claims match your search criteria.",
        solrUnavailable: "Solr Claims Core Not Available",
        runCommandPrefix: "Run",
        runCommandSuffix: "to index claims data for search.",
        claimsSearchDescription:
          "Search and analyze healthcare claims with faceted navigation and financial aggregations.",
        solrAccelerated: "Solr-accelerated",
        searching: "Searching...",
      },
    },
    hub: {
      title: "Health Economics & Outcomes Research",
      subtitle:
        "Cost-effectiveness analyses, budget impact modeling, ROI calculators, and value-based contract simulation",
      analysesDescription:
        "Build cost-effectiveness, budget impact, and ROI analyses with scenario modeling and sensitivity analysis.",
      contractsDescription:
        "Define outcomes-based value contracts with rebate tiers linked to observed outcome rates.",
      newEconomicAnalysis: "New Economic Analysis",
      newValueContract: "New Value Contract",
    },
    analyses: {
      summary: "{{scenarioCount}} · {{timeHorizon}} · {{currency}}",
    },
    contracts: {
      tierSummary: ">= {{threshold}}% improvement -> {{rebate}}% rebate",
    },
    analysis: {
      headerMeta:
        "{{analysisType}} · {{perspective}} · {{timeHorizon}} · {{discount}}% discount",
      scenarioFallback: "Scenario {{id}}",
      resultsTitle: "Results",
    },
    charts: {
      budgetImpact: {
        title: "Budget Impact Trajectory",
        emptySubtitle: "Projected budget impact over time",
        subtitle: "{{scenarioCount}} - projected 5-year budget impact",
        noData: "No budget impact data available.",
      },
      costEffectivenessPlane: {
        title: "Cost-Effectiveness Plane",
        emptySubtitle: "No incremental results available",
        subtitle: "WTP threshold: ${{wtp}}/QALY",
        noData:
          "Run the analysis with intervention scenarios to see the CE plane.",
        ariaLabel: "Cost-effectiveness plane scatter plot",
        wtpLabel: "WTP = ${{value}}/QALY",
        incrementalQalys: "Incremental QALYs (\u0394E)",
        incrementalCost: "Incremental Cost (\u0394C)",
        origin: "Origin",
        icer: "ICER: ${{value}}/QALY",
        nmb: "NMB: ${{value}}",
        quadrants: {
          moreCostlyMoreEffective: "More Costly, More Effective",
          moreCostlyLessEffective: "More Costly, Less Effective",
          lessCostlyMoreEffective: "Less Costly, More Effective",
          lessCostlyLessEffective: "Less Costly, Less Effective",
          tradeOffIcerDecides: "Trade-off (ICER decides)",
          dominated: "Dominated",
          dominant: "Dominant",
          tradeOff: "Trade-off",
        },
      },
      scenarioComparison: {
        title: "Scenario Comparison",
        emptySubtitle: "Total cost and QALYs by scenario",
        subtitle: "{{scenarioCount}} - total cost vs QALYs by scenario",
        noData: "No results to compare.",
        totalCostByScenario: "Total Cost by Scenario",
        totalQalysByScenario: "Total QALYs by Scenario",
        baseCase: "(Base Case)",
        totalCost: "Total Cost:",
        totalQalys: "Total QALYs:",
        base: "Base",
        qalysShort: "QALYs",
      },
      tornado: {
        title: "Sensitivity Analysis",
        emptySubtitle: "Tornado diagram - ICER impact by parameter",
        subtitle: "Tornado diagram - ICER impact by parameter variation",
        noData: "No sensitivity data available.",
        noImpact: "No parameters with measurable ICER impact.",
        topFive: "Sensitivity (Tornado - top 5)",
        baseIcer: "Base ICER: ${{value}}",
        base: "Base:",
        range: "Range:",
        lowIcer: "Low ICER:",
        highIcer: "High ICER:",
        icerRange: "ICER Range:",
      },
    },
    claims: {
      facets: {
        status: "Status",
        claimType: "Claim Type",
        placeOfService: "Place of Service",
        diagnosisTop20: "Diagnosis (Top 20)",
      },
      stats: {
        totalCharges: "Total Charges",
        avgCharge: "Avg Charge",
        totalPayments: "Total Payments",
        outstanding: "Outstanding",
      },
    },
  },
};

export const heorResources: Record<string, MessageTree> = {
  "en-US": enHeor,
  "es-ES": mergeMessageTrees(enHeor, {}),
  "fr-FR": mergeMessageTrees(enHeor, {}),
  "de-DE": mergeMessageTrees(enHeor, {}),
  "pt-BR": mergeMessageTrees(enHeor, {}),
  "fi-FI": mergeMessageTrees(enHeor, {}),
  "ja-JP": mergeMessageTrees(enHeor, {}),
  "zh-Hans": mergeMessageTrees(enHeor, {}),
  "ko-KR": mergeMessageTrees(enHeor, {}),
  "hi-IN": mergeMessageTrees(enHeor, {}),
  ar: mergeMessageTrees(enHeor, {}),
  "en-XA": mergeMessageTrees(enHeor, {}),
};
