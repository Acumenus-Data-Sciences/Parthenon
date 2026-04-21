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

const enStandardPros: MessageTree = {
  standardPros: {
    common: {
      abbreviation: "Abbreviation",
      active: "Active",
      activate: "Activate",
      all: "All",
      anonymous: "Anonymous",
      answerOptions: "Answer Options",
      campaign: "Campaign",
      campaigns: "Campaigns",
      cancel: "Cancel",
      close: "Close",
      closed: "Closed",
      complete: "Complete",
      completion: "Completion",
      createCampaign: "Create Campaign",
      createInstrument: "Create Instrument",
      csvFile: "CSV File",
      delete: "Delete",
      description: "Description",
      domain: "Domain",
      draft: "Draft",
      edit: "Edit",
      import: "Import",
      instrument: "Instrument",
      instruments: "Instruments",
      items: "Items",
      license: "License",
      loadingCampaigns: "Loading campaigns...",
      loadingInstrument: "Loading instrument...",
      loadingInstruments: "Loading instruments...",
      name: "Name",
      newCampaign: "New Campaign",
      omop: "OMOP",
      openLink: "Open Link",
      pending: "Pending",
      proxyEntry: "Proxy Entry",
      public: "Public",
      proprietary: "Proprietary",
      refresh: "Refresh",
      saveCampaign: "Save Campaign",
      saveInstrument: "Save Instrument",
      saveItem: "Save Item",
      searchCohorts: "Search cohorts",
      selectResponse: "Select a response",
      sort: "Sort",
      source: "Source",
      version: "Version",
      yes: "Yes",
    },
    domains: {
      catalog: {
        mentalHealth: "Mental Health",
        substanceUse: "Substance Use",
        qualityOfLife: "Quality of Life",
        pain: "Pain",
        functionalStatus: "Functional Status",
        oncology: "Oncology",
        cognitive: "Cognitive",
        geriatric: "Geriatric",
        cardiovascular: "Cardiovascular",
        respiratory: "Respiratory",
        diabetes: "Diabetes",
        pediatric: "Pediatric",
        neurological: "Neurological",
        sleep: "Sleep",
        sexualHealth: "Sexual Health",
        musculoskeletal: "Musculoskeletal",
        sdoh: "SDOH",
        perioperative: "Perioperative",
        promis: "PROMIS",
        ophthalmology: "Ophthalmology",
        movementDisorders: "Movement Disorders",
        medicationAdherence: "Medication Adherence",
      },
      builder: {
        mental_health: "Mental health",
        quality_of_life: "Quality of life",
        pain: "Pain",
        function: "Function",
        sleep: "Sleep",
        fatigue: "Fatigue",
        cardiovascular: "Cardiovascular",
        other: "Other",
      },
    },
    responseTypes: {
      likert: "Likert",
      yes_no: "Yes / No",
      numeric: "Numeric",
      free_text: "Free Text",
      multi_select: "Multi Select",
      date: "Date",
      nrs: "NRS",
      vas: "VAS",
    },
    omop: {
      full: "Full",
      partial: "Partial",
      none: "None",
      fullCoverage: "Full Coverage",
      noCoverage: "No Coverage",
      badgeFullCoverage: "Full OMOP Coverage",
    },
    chart: {
      hasLoinc: "Has LOINC",
      noLoinc: "No LOINC",
      hasSnomed: "Has SNOMED",
      noSnomed: "No SNOMED",
      instrumentsByClinicalDomain: "Instruments by Clinical Domain",
      omopConceptCoverage: "OMOP Concept Coverage",
      loincCodeAvailability: "LOINC Code Availability",
      snomedCtCoverage: "SNOMED CT Coverage",
      licenseDistribution: "License Distribution",
      instrumentCount: "{{count}} instrument",
      instrumentCount_other: "{{count}} instruments",
    },
    page: {
      title: "Standard PROs+",
      live: "Live",
      subtitle:
        "Pre-mapped survey instrument library, visual builder, and dedicated PRO analytics",
      aboutButton: "About PROs+",
      tabs: {
        library: "Instrument Library",
        coverage: "Coverage Analytics",
        builder: "Survey Builder",
        conduct: "Survey Conduct",
        analytics: "Analytics",
      },
      stats: {
        instruments: "Instruments",
        withItems: "With Items",
        questionItems: "Question Items",
        answerOptions: "Answer Options",
      },
      analytics: {
        requiresData:
          "Analytics require survey conduct data. Administer surveys through the Conduct tab to populate results.",
        achillesTitle: "Achilles 900-Series Analyses",
        dqTitle: "Data Quality Checks",
        requiresSurveyData: "Requires Survey Data",
        analyses: {
          a900Title: "Survey Response Census",
          a900Desc: "Persons with survey responses, by instrument",
          a901Title: "Completion Over Time",
          a901Desc: "Completed surveys by instrument and time period",
          a902Title: "Item Completion Rates",
          a902Desc: "Skip rate detection per item",
          a903Title: "Score Distributions",
          a903Desc: "By instrument and subscale",
          a904Title: "Floor/Ceiling Effects",
          a904Desc: "Min/max score clustering",
          a905Title: "Longitudinal Trajectories",
          a905Desc: "Score change over time",
          a906Title: "Response Time",
          a906Desc: "Completion duration distributions",
          a907Title: "Administration Mode",
          a907Desc: "By respondent type and mode",
          a908Title: "Missing Data Patterns",
          a908Desc: "Most frequently skipped items",
          a909Title: "Temporal Alignment",
          a909Desc: "Survey-to-clinical-event gaps",
        },
        checks: {
          dqS01Title: "Orphaned Responses",
          dqS01Desc: "Survey-typed observations without survey_conduct",
          dqS02Title: "Out-of-Range Values",
          dqS02Desc: "Scores outside valid instrument range",
          dqS03Title: "Fast Completion",
          dqS03Desc: "Implausibly short completion times",
          dqS04Title: "Straight-Line",
          dqS04Desc: "All items answered identically",
          dqS05Title: "Mapping Completeness",
          dqS05Desc: "% items mapped to standard concepts",
        },
      },
    },
    about: {
      title: "About Standard PROs+",
      subtitle:
        "Survey and PRO data in the OMOP CDM - problem, solution, and roadmap",
      overviewLead:
        "Patient-Reported Outcomes (PROs) capture information about a patient's health status directly from the patient, without clinician interpretation. Instruments like the PHQ-9, EQ-5D, and PROMIS measures are central to comparative effectiveness research, value-based care, and FDA label claims.",
      overviewFollowup:
        "Yet in the OHDSI ecosystem, these instruments have no standardized home. Each organization must solve concept mapping, ETL design, metadata capture, and analytical tooling from scratch - a gap that has persisted for over a decade. Parthenon Standard PROs+ is the first platform to address it.",
      sections: {
        problem: "The Problem",
        solution: "The Parthenon Solution",
        architecture: "Technical Architecture",
        roadmap: "Implementation Roadmap",
        insights: "Key Insights",
      },
      painPointLabel: "Pain Point {{id}}",
      painPoints: {
        vocabularyMappingGapsTitle: "Vocabulary Mapping Gaps",
        vocabularyMappingGapsDesc:
          "Incomplete LOINC/SNOMED coverage for survey instruments. Disease-specific tools like EPIC-26 and FACT-G have zero standard concept coverage.",
        noPrebuiltEtlTitle: "No Pre-Built ETL Templates",
        noPrebuiltEtlDesc:
          "Every organization builds survey ETL from scratch. No reference implementations, no shared mapping files, no automated tools.",
        domainClassificationAmbiguityTitle: "Domain Classification Ambiguity",
        domainClassificationAmbiguityDesc:
          "No standardized logic for Observation vs Measurement domain placement. The same assessment can land in different tables across sites.",
        missingSurveyMetadataTitle: "Missing Survey Metadata",
        missingSurveyMetadataDesc:
          "CDM v5.4 has no mechanism for respondent type, administration mode, completion status, or temporal treatment relationships.",
        compositeScoreRepresentationTitle: "Composite Score Representation",
        compositeScoreRepresentationDesc:
          "No standardized convention for storing item-level responses alongside composite and subscale scores. Multi-site comparisons become unreliable.",
        noDedicatedAnalyticsTitle: "No Dedicated Analytics",
        noDedicatedAnalyticsDesc:
          "No survey-specific Achilles analyses: item completion rates, score distributions, floor and ceiling effects, or longitudinal PRO tracking.",
      },
      pillars: {
        libraryTitle: "Survey Instrument Library",
        librarySubtitle: "100 Pre-Mapped Instruments",
        libraryDesc:
          "Curated library with complete OMOP concept mappings for every question and answer choice. LOINC-based where available, PTHN_SURVEY custom concepts where not.",
        builderTitle: "Survey Builder",
        builderSubtitle: "Visual Instrument Designer",
        builderDesc:
          "Drag-and-drop instrument creation with ATHENA concept search, Abby AI mapping suggestions, and REDCap/FHIR/CSV import.",
        conductTitle: "Survey Conduct Layer",
        conductSubtitle: "v5.4 Compatible, v6.0 Ready",
        conductDesc:
          "Administration metadata: respondent type, mode, completion status, visit linkage. Forward-compatible with CDM v6.0's native survey_conduct table.",
        analyticsTitle: "Survey Analytics",
        analyticsSubtitle: "Achilles 900-Series",
        analyticsDesc:
          "Dedicated characterization: completion rates, score distributions, floor and ceiling effects, longitudinal trajectories, and 5 data quality checks.",
      },
      architecture: {
        surveyInstruments:
          "Instrument registry: name, version, domain, scoring, LOINC, OMOP concept, license",
        surveyItems:
          "Individual questions: item text, response type, OMOP concept, subscale, reverse-coding",
        surveyAnswerOptions:
          "Answer choices: option text, numeric score, OMOP concept, LOINC LA code",
        surveyConduct:
          "Administration metadata: respondent type, mode, completion status, visit linkage, scores",
        surveyResponses:
          "Bridge table linking survey_conduct to observation rows with item-level values",
        forwardCompatibleTitle: "CDM v6.0 Forward-Compatible",
        forwardCompatibleDesc:
          "app.survey_conduct mirrors v6.0's native SURVEY_CONDUCT table. A migration script promotes records when v6.0 tooling matures.",
      },
      roadmap: {
        phase1Title: "Foundation",
        phase1Duration: "4 weeks",
        phase1Item1: "Database migrations (5 survey tables)",
        phase1Item2: "Eloquent models with relationships",
        phase1Item3: "API endpoints for instrument CRUD",
        phase1Item4: "PTHN_SURVEY vocabulary registration",
        phase1Item5: "survey:seed-library Artisan command",
        phase2Title: "Instrument Library and Mapping",
        phase2Duration: "6 weeks",
        phase2Item1: "Curate 100-instrument JSON manifest",
        phase2Item2: "Create PTHN_SURVEY custom concepts",
        phase2Item3: "Build concept_relationship hierarchies",
        phase2Item4: "Frontend Library Browser (TanStack Table)",
        phase2Item5: "Instrument Detail page",
        phase3Title: "Survey Builder and AI Mapping",
        phase3Duration: "4 weeks",
        phase3Item1: "Visual Builder wizard (create/edit/version)",
        phase3Item2: "ATHENA concept search integration",
        phase3Item3: "Abby AI concept suggestion engine",
        phase3Item4: "REDCap / FHIR / CSV import",
        phase4Title: "Analytics and Data Quality",
        phase4Duration: "3 weeks",
        phase4Item1: "Achilles analyses 900-909",
        phase4Item2: "DQD checks DQ-S01 through DQ-S05",
        phase4Item3: "Survey Results Explorer",
        phase4Item4: "Solr survey configset",
        phase5Title: "Survey Conduct and ETL",
        phase5Duration: "3 weeks",
        phase5Item1: "Survey conduct API",
        phase5Item2: "Auto-scoring service",
        phase5Item3: "ETL pipeline to observation rows",
        phase5Item4: "FHIR QuestionnaireResponse export",
        phase5Item5: "v6.0 forward-migration script",
      },
      insights: {
        v6Title: "CDM v6.0 Not Production-Ready",
        v6Text:
          "survey_conduct exists in the v6.0 spec, but major OHDSI analytics tools do not support v6.0 yet. Parthenon bridges the gap with an app-schema implementation.",
        loincTitle: "LOINC Coverage Is Sparse",
        loincText:
          "Only {{withLoinc}} of {{total}} instruments have LOINC codes. PTHN_SURVEY vocabulary fills the gap with 2.1B+ range custom concepts.",
        customConceptsTitle: "Custom Concepts Block Network Studies",
        customConceptsText:
          "Each site's custom IDs (>2B range) are incompatible. A shared PTHN_SURVEY vocabulary enables multi-site PRO-inclusive studies.",
        turnkeyTitle: "First OHDSI Platform with Turnkey PROs",
        turnkeyText:
          "No existing OHDSI tool offers pre-mapped instruments, a visual builder, or survey-specific analytics. Parthenon would be the first.",
      },
    },
    builder: {
      abbreviation: "Abbreviation",
      itemNumber: "Item Number",
      responseType: "Response Type",
      question: "Question",
      subscale: "Subscale",
      subscalePlaceholder: "Optional grouping",
      reverseCoded: "Reverse coded",
      reverseCodedHelp: "Apply inverse scoring at runtime",
      loincCode: "LOINC Code",
      omopConceptId: "OMOP Concept ID",
      optional: "Optional",
      minValue: "Min Value",
      maxValue: "Max Value",
      answerOptions: "Answer Options",
      answerOptionsPlaceholder: "One option per line",
      answerOptionsHelp:
        "Each line becomes a discrete answer option. Option values are assigned sequentially from top to bottom.",
      responseTypeNoOptions:
        "This response type does not require discrete answer options or numeric bounds.",
      surveyBuilder: "Survey Builder",
      workspaceHelp:
        "Build and maintain one active custom instrument at a time. Standard PROs and existing custom instruments are available through the clone flow, not as an always-visible list.",
      noCustomInstrumentSelected: "No custom instrument selected",
      newCustomInstrument: "New Custom Instrument",
      cloneInstrument: "Clone Instrument",
      deleteInstrument: "Delete Instrument",
      emptyWorkspace:
        "Create a new custom instrument or clone one to start authoring.",
      noDescriptionYet: "No description entered yet.",
      itemCanvas: "Item Canvas",
      createItem: "Create Item",
      noItemsYet:
        "No items yet. Use Create Item to start authoring this instrument.",
      reorderHelp:
        "Drag items to reorder them. The builder persists the revised order immediately.",
      answerOptionsCount: "{{count}} answer option",
      answerOptionsCount_other: "{{count}} answer options",
      range: "Range {{min}} to {{max}}",
      noDiscreteOptions: "No discrete options",
      editItem: "Edit Item",
      itemEditor: "Item Editor",
      deleteItem: "Delete Item",
      selectItemToEdit:
        "Select an existing item from the canvas to edit it.",
      instrumentMetadata: "Instrument Metadata",
      createItemTitle: "Create Item",
      cloneIntoWorkspace: "Clone into Workspace",
      searchPlaceholder: "Search standard or custom instruments",
      noStandardMatches: "No standard instruments match the current search.",
      noCustomMatches: "No custom instruments match the current search.",
      cloneSettings: "Clone Settings",
      cloneSettingsHelp:
        "Select a source instrument to configure the cloned copy.",
      copySuffix: "Copy",
      clonedName: "Cloned Name",
      clonedAbbreviation: "Cloned Abbreviation",
      emptySelected:
        "No custom instrument selected. Create a new one or clone from the instrument catalogue.",
      createSuccess: "Created {{abbreviation}}",
      createFailed: "Failed to create instrument",
      readOnlySave:
        "Only custom instruments can be saved from this workspace.",
      saveSuccess: "Instrument saved",
      saveFailed: "Failed to save instrument",
      readOnlyDelete: "Library instruments cannot be deleted.",
      deleteConfirm:
        "Delete instrument \"{{name}}\"? This cannot be undone.",
      deleteSuccess: "Instrument deleted",
      deleteFailed: "Failed to delete instrument",
      readOnlyCloneToEdit:
        "Library instruments are read-only. Clone the instrument to edit it.",
      itemSaveSuccess: "Item saved",
      itemSaveFailed: "Failed to save item",
      itemCreateFailed: "Failed to create item",
      itemDeleteSuccess: "Item deleted",
      itemDeleteFailed: "Failed to delete item",
      createOrCloneBeforeItems:
        "Create or clone a custom instrument before adding items.",
      cloneSuccess: "Cloned {{abbreviation}}",
      cloneFailed: "Failed to clone instrument",
      reorderSuccess: "Item order updated",
      reorderFailed: "Failed to reorder items",
      importSuccess:
        "Imported {{count}} items into {{abbreviation}}",
      importFailed: "Import failed",
      customSection: "Custom Instruments",
      standardSection: "Standard PROs",
      importInstrument: "Import Instrument",
      importAction: "Import",
      sourceType: "Source",
      redcapDictionaryCsv: "REDCap Dictionary CSV",
      fhirQuestionnaireJson: "FHIR Questionnaire JSON",
      nameOverride: "Name Override",
      importDomain: "Domain",
      pasteRedcapHelp:
        "Paste a REDCap data dictionary CSV. Supported columns include Field Label, Field Type, and Choices/Calculations.",
      pasteFhirHelp:
        "Paste a FHIR Questionnaire JSON resource. Nested items are flattened into a linear item list.",
      redcapPlaceholder:
        "Variable / Field Name,Form Name,Section Header,Field Type,Field Label,Choices, Calculations, OR Slider Labels",
      fhirPlaceholder:
        '{ "resourceType": "Questionnaire", "title": "Example", "item": [] }',
      importRequiresFhirItem:
        "FHIR Questionnaire import requires at least one item.",
      importRequiresRedcapRows:
        "REDCap import requires a header row and at least one field row.",
    },
    table: {
      searchPlaceholder: "Search instruments by abbreviation, name, or domain",
      clearFilters: "Clear {{count}} filter",
      clearFilters_other: "Clear {{count}} filters",
      showing: "Showing",
      of: "of",
      instrumentName: "Instrument Name",
      noMatches: "No instruments match the current filters.",
    },
    conduct: {
      title: "Survey Conduct",
      subtitle:
        "Campaign-first operations for survey administration. Phase 1 covers draft, activation, closure, denominator tracking, response import, proxy entry, and public collection.",
      emptyTitle: "No survey campaigns yet",
      emptyMessage:
        "Create a campaign to seed cohort-based survey conduct, track completion, and prepare for import, proxy entry, and published self-report links.",
      importComplete: "Import complete: {{campaignName}}",
      importSummary:
        "Processed {{processed}} rows, matched {{matched}}, skipped {{missing}}, created {{createdResponses}} responses.",
      seededDenominator: "Seeded denominator",
      created: "Created {{date}}",
      closedAt: "Closed {{date}}",
      publishLink: "Publish Link",
      linkAvailableAfterActivation: "Link available after activation",
      seededCompletionProgress: "Seeded completion progress",
      campaignsCount: "Campaigns",
      noItemsYet: "No items available for this instrument.",
      unknownInstrument: "Unknown instrument",
      activateSuccess: "Campaign activated",
      activateFailed: "Failed to activate campaign",
      closeSuccess: "Campaign closed",
      closeFailed: "Failed to close campaign",
      deleteConfirm:
        "Delete campaign \"{{name}}\"? This cannot be undone.",
      deleteSuccess: "Campaign deleted",
      deleteFailed: "Failed to delete campaign",
      createSuccess: "Campaign created",
      createFailed: "Failed to create campaign",
      updateSuccess: "Campaign updated",
      updateFailed: "Failed to update campaign",
      importResponsesSuccess: "Responses imported",
      importResponsesFailed: "Failed to import responses",
      saveResponsesSuccess: "Responses saved",
      saveResponsesFailed: "Failed to save responses",
      campaignFallback: "Campaign",
      filters: {
        all: "All",
        draft: "Draft",
        active: "Active",
        closed: "Closed",
      },
      newCampaign: {
        createTitle: "Create Survey Campaign",
        editTitle: "Edit Draft Campaign",
        campaignName: "Campaign Name",
        campaignNamePlaceholder: "Baseline mental health intake",
        descriptionPlaceholder:
          "Enrollment wave, inclusion notes, or operational instructions",
        selectInstrument: "Select an instrument",
        createButton: "Create Campaign",
        honestBrokerTitle: "Require Honest Broker",
        honestBrokerDescription:
          "Public respondents must be pre-registered by an honest broker before their answers can be linked to OMOP person IDs.",
        cohortGeneration: "Cohort Generation",
        cohortGenerationHelp:
          "Optional. Pick a completed generation to seed the denominator automatically.",
        noCohortSeeding: "No cohort seeding",
        noCohortSeedingHelp:
          "Create an unseeded campaign and collect only anonymous and public responses.",
        generationLabel: "Generation #{{id}}",
        persons: "{{count}} person",
        persons_other: "{{count}} persons",
        completedAt: "Completed {{date}}",
        completedUnknown: "Completed unknown",
        selectedDenominatorSource: "Selected denominator source",
        seededMembers: "{{count}} seeded members",
        selectedSeed:
          "Selected seed: {{cohortName}} / generation #{{generationId}}",
        denominatorSeeded:
          "{{count}} persons seeded into the campaign denominator.",
      },
      importResponses: {
        title: "Import Responses",
        importCsv: "Import CSV",
        help:
          "Paste CSV with a required person_id column and item columns matching item_#, raw item ids, or exact item text.",
        exampleHeader: "Example header: {{header}}",
      },
      manualEntry: {
        title: "Manual Proxy Entry",
        saveResponses: "Save Responses",
        pendingConductRecord: "Pending Conduct Record",
        filterPlaceholder: "Filter by person_id",
        selectPerson: "Select a person",
        personLabel: "Person {{personId}}",
      },
    },
    instrumentDetail: {
      backToLibrary: "Back to Library",
      notFound: "Instrument not found.",
      coverage: "Coverage",
      omopCoverage: "{{coverage}} OMOP Coverage",
      loinc: "LOINC",
      snomed: "SNOMED",
      reverseCoded: "Reverse-coded",
      loincPanel: "LOINC Panel",
      snomedCt: "SNOMED CT",
      administrations: "Administrations",
      scoringMethod: "Scoring Method",
      type: "Type",
      range: "Range",
      subscales: "Subscales",
      itemsHeading: "Items ({{count}})",
      noItemsTitle: "No items loaded for this instrument",
      noItemsPublic:
        "Items can be added via the Survey Builder or survey:seed-library command",
      noItemsProprietary:
        "This is a proprietary instrument - item content requires a license",
    },
    publicSurvey: {
      headerEyebrow: "Parthenon Standard PROs",
      defaultDescription:
        "Please complete the survey below. Your responses will be recorded anonymously unless your study team instructed otherwise.",
      instrumentLabel: "Instrument",
      questionsCount: "{{count}} question",
      questionsCount_other: "{{count}} questions",
      unavailableTitle: "Survey unavailable",
      unavailableMessage:
        "This survey link is invalid, expired, or no longer accepting responses.",
      responseSubmitted: "Response submitted",
      thankYou: "Thank you. Your survey response has been recorded.",
      totalScore: "Calculated total score: {{score}}",
      secureBrokerInvitation: "Secure broker invitation",
      secureBrokerDescription:
        "This survey link is already bound to your blinded participant record.",
      reference: "Reference: {{reference}}.",
      identifierRequired: "Participant identifier required",
      identifierOptional: "Optional participant identifier",
      identifierRequiredHelp:
        "Enter the code provided by your study team to submit this protected survey.",
      identifierOptionalHelp:
        "Leave this blank for anonymous submission, or enter the code provided by your study team.",
      identifierPlaceholder: "Study ID or external reference",
      submitResponse: "Submit Response",
    },
  },
};

export const standardProsResources: Record<string, MessageTree> = {
  "en-US": enStandardPros,
  "es-ES": mergeMessageTrees(enStandardPros, {}),
  "fr-FR": mergeMessageTrees(enStandardPros, {}),
  "de-DE": mergeMessageTrees(enStandardPros, {}),
  "pt-BR": mergeMessageTrees(enStandardPros, {}),
  "fi-FI": mergeMessageTrees(enStandardPros, {}),
  "ja-JP": mergeMessageTrees(enStandardPros, {}),
  "zh-Hans": mergeMessageTrees(enStandardPros, {}),
  "ko-KR": mergeMessageTrees(enStandardPros, {}),
  "hi-IN": mergeMessageTrees(enStandardPros, {}),
  ar: mergeMessageTrees(enStandardPros, {}),
  "en-XA": mergeMessageTrees(enStandardPros, {}),
};
