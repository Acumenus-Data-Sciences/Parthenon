type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(
  base: MessageTree,
  overrides: MessageTree,
): MessageTree {
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

const enStrategus: MessageTree = {
  strategus: {
    common: {
      added: "Added",
      auto: "Auto",
      back: "Back",
      comparator: "Comparator",
      cohorts: "Cohorts",
      description: "Description",
      issues: "Issues",
      modules: "Modules",
      next: "Next",
      noneConfigured: "None configured",
      outcome: "Outcome",
      required: "Required",
      source: "Source",
      status: "Status",
      target: "Target",
      warnings: "Warnings",
    },
    page: {
      header: {
        title: "Study Packages",
        subtitle:
          "Build and execute Strategus multi-analysis OHDSI study packages",
        importJson: "Import JSON",
        exportJson: "Export JSON",
      },
      steps: {
        studyInfo: "Study Info",
        selectModules: "Select Modules",
        sharedCohorts: "Shared Cohorts",
        moduleSettings: "Module Settings",
        jsonPreview: "JSON Preview",
        reviewValidate: "Review & Validate",
        execute: "Execute",
      },
      studyInfo: {
        title: "Study Information",
        intro: "Name your study package and provide an optional description.",
        studyName: "Study Name",
        description: "Description",
        studyNamePlaceholder: "e.g., SGLT2i vs DPP4i Heart Failure Risk Study",
        descriptionPlaceholder:
          "Briefly describe the study objectives, population, and expected outcomes...",
        info: "Strategus executes multi-analysis OHDSI study packages across one or more CDM data sources. Each analysis module runs independently and writes results to the configured output directory.",
      },
      selectModules: {
        loading: "Loading available modules...",
        title: "Select Analysis Modules",
        intro:
          "Choose which OHDSI analysis modules to include. CohortGenerator is required and always included.",
        selectedSummary_one:
          "{{count}} module selected (including CohortGenerator)",
        selectedSummary_other:
          "{{count}} modules selected (including CohortGenerator)",
      },
      sharedCohorts: {
        title: "Shared Cohort Definitions",
        intro:
          "Add target, comparator, and outcome cohorts shared across all analysis modules.",
        addCohort: "Add Cohort",
        searchPlaceholder: "Search cohort definitions...",
        loading: "Loading cohorts...",
        noneFound: "No cohort definitions found.",
        empty:
          "No cohorts added yet. Most analysis modules require at least one target cohort.",
        roles: {
          target: "Target",
          comparator: "Comparator",
          outcome: "Outcome",
        },
      },
      review: {
        title: "Study Package Summary",
        studyName: "Study Name",
        description: "Description",
        modules: "Modules",
        cohorts: "Cohorts",
        validateTitle: "Validate Specification",
        validateIntro:
          "Check the analysis spec for module configuration issues before executing.",
        runValidation: "Run Validation",
        validationPassed: "Validation passed",
        validationFailed: "Validation failed",
        validationFailedWithMessage: "Validation failed: {{message}}",
        validationRequestFailed: "Validation request failed",
        severity: {
          error: "Error",
          warning: "Warning",
        },
      },
      execute: {
        title: "Execute Study Package",
        intro:
          'Select a CDM data source and execute "{{studyName}}" across all configured modules.',
        targetDataSource: "Target Data Source",
        loadingSources: "Loading sources...",
        selectSource: "Select a source",
        executeStudyPackage: "Execute Study Package",
        executing: "Executing...",
        runningTitle: "Study package is running...",
        runningIntro:
          "Strategus is orchestrating module execution. This may take several minutes depending on dataset size and number of modules.",
        executionFailed: "Execution failed: {{message}}",
        executionRequestFailed: "Execution request failed",
        executionComplete: "Execution Complete",
        outputDirectory: "Output Directory",
        modulesExecuted: "Modules Executed",
        resultStats: {
          status: "Status",
          modulesRun: "Modules Run",
          resultFiles: "Result Files",
        },
        statusLabels: {
          completed: "Completed",
          running: "Running",
          failed: "Failed",
        },
      },
    },
    jsonEditor: {
      title: "JSON Spec Preview",
      intro:
        "Review the generated analysis specification. Edit directly or apply changes below.",
      copied: "Copied",
      copyToClipboard: "Copy to Clipboard",
      resetToGenerated: "Reset to Generated",
      lineCount_one: "{{count}} line",
      lineCount_other: "{{count}} lines",
      validJson: "Valid JSON",
      invalidJson: "Invalid JSON",
      applyChanges: "Apply Changes",
    },
    moduleSettings: {
      title: "Module Settings",
      intro:
        "Configure per-module parameters. Click a module to expand its settings.",
      unknownModule: "Unknown module: {{moduleName}}",
      autoBadge: "Auto",
      noConfigurationNeeded:
        "No configuration needed. CohortGenerator automatically builds cohorts from the shared cohort definitions.",
      noCohorts:
        "No cohorts available. Add cohorts in the Shared Cohorts step.",
      noRoleCohorts:
        "No {{role}} cohorts available. Add cohorts in the Shared Cohorts step.",
      sections: {
        cohortAssignment: "Cohort Assignment",
        parameters: "Parameters",
        covariateSettings: "Covariate Settings",
        modelConfiguration: "Model Configuration",
        timeAtRisk: "Time at Risk",
        trainingParameters: "Training Parameters",
        eraCovariateSettings: "Era Covariate Settings",
        diagnosticsOptions: "Diagnostics Options",
        synthesisConfiguration: "Synthesis Configuration",
      },
      fields: {
        targetCohorts: "Target Cohorts",
        comparatorCohorts: "Comparator Cohorts",
        outcomeCohorts: "Outcome Cohorts",
        exposureCohorts: "Exposure Cohorts",
        washoutPeriod: "Washout Period (days)",
        maxCohortSize: "Max Cohort Size (0 = unlimited)",
        demographics: "Demographics",
        conditionOccurrence: "Condition Occurrence",
        drugExposure: "Drug Exposure",
        procedureOccurrence: "Procedure Occurrence",
        measurement: "Measurement",
        modelType: "Model Type",
        windowStart: "Window Start (days)",
        windowEnd: "Window End (days)",
        minCohortSize: "Min Cohort Size",
        splitSeed: "Split Seed",
        testFraction: "Test Fraction",
        includeEraOverlap: "Include Era Overlap",
        firstOccurrenceOnly: "First Occurrence Only",
        inclusionStatistics: "Inclusion Statistics",
        incidenceRate: "Incidence Rate",
        timeSeries: "Time Series",
        breakdownIndexEvents: "Breakdown Index Events",
        orphanConcepts: "Orphan Concepts",
        minCellCount: "Min Cell Count",
        minPriorObservation: "Min Prior Observation (days)",
        dechallengeStopInterval: "Dechallenge Stop Interval",
        dechallengeEvalWindow: "Dechallenge Eval Window",
        start: "Start (days)",
        end: "End (days)",
        cleanWindow: "Clean Window (days)",
        method: "Method",
        evidenceSourceModule: "Evidence Source Module",
      },
      options: {
        modelTypes: {
          lassoLogistic: "Lasso Logistic Regression",
          gradientBoosting: "Gradient Boosting",
          randomForest: "Random Forest",
          deepLearning: "Deep Learning",
        },
        synthesisMethods: {
          fixedEffects: "Fixed Effects",
          randomEffects: "Random Effects",
          bayesian: "Bayesian",
        },
        evidenceSources: {
          cohortMethod: "Cohort Method",
          selfControlledCaseSeries: "Self-Controlled Case Series",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "Cohort Generator",
        description:
          "Generates cohorts from definitions. Required for all study types.",
      },
      cohortMethod: {
        label: "Cohort Method",
        description:
          "Population-level effect estimation using comparative cohort design.",
      },
      patientLevelPrediction: {
        label: "Patient Level Prediction",
        description:
          "Builds prediction models for patient-level outcomes using ML.",
      },
      selfControlledCaseSeries: {
        label: "Self-Controlled Case Series",
        description: "Estimates incidence rate ratios using SCCS design.",
      },
      cohortDiagnostics: {
        label: "Cohort Diagnostics",
        description:
          "Evaluates phenotype algorithms and characterizes cohorts.",
      },
      characterization: {
        label: "Characterization",
        description:
          "Computes baseline characteristics across target and comparator cohorts.",
      },
      cohortIncidence: {
        label: "Cohort Incidence",
        description:
          "Calculates incidence rates of outcomes in target populations.",
      },
      evidenceSynthesis: {
        label: "Evidence Synthesis",
        description:
          "Meta-analysis across data sources using fixed/random effects models.",
      },
    },
  },
};

const frStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "Ajoute",
      back: "Retour",
      comparator: "Comparateur",
      cohorts: "Cohortes",
      description: "Description",
      issues: "Problemes",
      modules: "Modules",
      next: "Suivant",
      noneConfigured: "Aucune configuration",
      outcome: "Resultat",
      required: "Obligatoire",
      source: "Source",
      status: "Statut",
      target: "Cible",
      warnings: "Avertissements",
    },
    page: {
      header: {
        title: "Packages d'etude",
        subtitle:
          "Construire et executer des packages d'etude OHDSI multi-analyses Strategus",
        importJson: "Importer JSON",
        exportJson: "Exporter JSON",
      },
      steps: {
        studyInfo: "Infos d'etude",
        selectModules: "Selection des modules",
        sharedCohorts: "Cohortes partagees",
        moduleSettings: "Parametres des modules",
        jsonPreview: "Apercu JSON",
        reviewValidate: "Verifier et valider",
        execute: "Executer",
      },
      studyInfo: {
        title: "Informations sur l'etude",
        intro:
          "Nommez votre package d'etude et ajoutez une description facultative.",
        studyName: "Nom de l'etude",
        description: "Description",
        studyNamePlaceholder:
          "par ex. Etude du risque d'insuffisance cardiaque SGLT2i vs DPP4i",
        descriptionPlaceholder:
          "Decrivez brievement les objectifs de l'etude, la population et les resultats attendus...",
        info: "Strategus execute des packages d'etude OHDSI multi-analyses sur une ou plusieurs sources CDM. Chaque module d'analyse s'execute independamment et ecrit ses resultats dans le repertoire de sortie configure.",
      },
      selectModules: {
        loading: "Chargement des modules disponibles...",
        title: "Selectionner les modules d'analyse",
        intro:
          "Choisissez les modules d'analyse OHDSI a inclure. CohortGenerator est obligatoire et toujours inclus.",
        selectedSummary_one:
          "{{count}} module selectionne (y compris CohortGenerator)",
        selectedSummary_other:
          "{{count}} modules selectionnes (y compris CohortGenerator)",
      },
      sharedCohorts: {
        title: "Definitions de cohortes partagees",
        intro:
          "Ajoutez les cohortes cible, comparatrice et de resultat partagees entre tous les modules d'analyse.",
        addCohort: "Ajouter une cohorte",
        searchPlaceholder: "Rechercher des definitions de cohortes...",
        loading: "Chargement des cohortes...",
        noneFound: "Aucune definition de cohorte trouvee.",
        empty:
          "Aucune cohorte ajoutee pour l'instant. La plupart des modules d'analyse necessitent au moins une cohorte cible.",
        roles: {
          target: "Cible",
          comparator: "Comparateur",
          outcome: "Resultat",
        },
      },
      review: {
        title: "Resume du package d'etude",
        studyName: "Nom de l'etude",
        description: "Description",
        modules: "Modules",
        cohorts: "Cohortes",
        validateTitle: "Valider la specification",
        validateIntro:
          "Verifiez la specification de l'analyse pour detecter les problemes de configuration des modules avant l'execution.",
        runValidation: "Lancer la validation",
        validationPassed: "Validation reussie",
        validationFailed: "Validation echouee",
        validationFailedWithMessage: "Validation echouee : {{message}}",
        validationRequestFailed: "La requete de validation a echoue",
        severity: {
          error: "Erreur",
          warning: "Avertissement",
        },
      },
      execute: {
        title: "Executer le package d'etude",
        intro:
          'Selectionnez une source de donnees CDM et executez "{{studyName}}" sur tous les modules configures.',
        targetDataSource: "Source de donnees cible",
        loadingSources: "Chargement des sources...",
        selectSource: "Selectionner une source",
        executeStudyPackage: "Executer le package d'etude",
        executing: "Execution...",
        runningTitle: "Le package d'etude est en cours...",
        runningIntro:
          "Strategus orchestre l'execution des modules. Cela peut prendre plusieurs minutes selon la taille du jeu de donnees et le nombre de modules.",
        executionFailed: "Execution echouee : {{message}}",
        executionRequestFailed: "La requete d'execution a echoue",
        executionComplete: "Execution terminee",
        outputDirectory: "Repertoire de sortie",
        modulesExecuted: "Modules executes",
        resultStats: {
          status: "Statut",
          modulesRun: "Modules executes",
          resultFiles: "Fichiers de resultat",
        },
        statusLabels: {
          completed: "Termine",
          running: "En cours",
          failed: "Echec",
        },
      },
    },
    jsonEditor: {
      title: "Apercu de la specification JSON",
      intro:
        "Passez en revue la specification d'analyse generee. Modifiez-la directement ou appliquez les changements ci-dessous.",
      copied: "Copie",
      copyToClipboard: "Copier dans le presse-papiers",
      resetToGenerated: "Reinitialiser a la version generee",
      lineCount_one: "{{count}} ligne",
      lineCount_other: "{{count}} lignes",
      validJson: "JSON valide",
      invalidJson: "JSON invalide",
      applyChanges: "Appliquer les modifications",
    },
    moduleSettings: {
      title: "Parametres des modules",
      intro:
        "Configurez les parametres de chaque module. Cliquez sur un module pour developper ses parametres.",
      unknownModule: "Module inconnu : {{moduleName}}",
      noConfigurationNeeded:
        "Aucune configuration necessaire. CohortGenerator construit automatiquement les cohortes a partir des definitions de cohortes partagees.",
      noCohorts:
        "Aucune cohorte disponible. Ajoutez des cohortes a l'etape Cohortes partagees.",
      noRoleCohorts:
        "Aucune cohorte {{role}} disponible. Ajoutez des cohortes a l'etape Cohortes partagees.",
      sections: {
        cohortAssignment: "Affectation des cohortes",
        parameters: "Parametres",
        covariateSettings: "Parametres des covariables",
        modelConfiguration: "Configuration du modele",
        timeAtRisk: "Temps a risque",
        trainingParameters: "Parametres d'entrainement",
        eraCovariateSettings: "Parametres des covariables d'ere",
        diagnosticsOptions: "Options de diagnostic",
        synthesisConfiguration: "Configuration de la synthese",
      },
      fields: {
        targetCohorts: "Cohortes cibles",
        comparatorCohorts: "Cohortes comparatrices",
        outcomeCohorts: "Cohortes de resultat",
        exposureCohorts: "Cohortes d'exposition",
        washoutPeriod: "Periode de washout (jours)",
        maxCohortSize: "Taille max de cohorte (0 = illimite)",
        demographics: "Demographie",
        conditionOccurrence: "Occurrence de pathologie",
        drugExposure: "Exposition au medicament",
        procedureOccurrence: "Occurrence de procedure",
        measurement: "Mesure",
        modelType: "Type de modele",
        windowStart: "Debut de fenetre (jours)",
        windowEnd: "Fin de fenetre (jours)",
        minCohortSize: "Taille minimale de cohorte",
        splitSeed: "Graine de decoupage",
        testFraction: "Fraction de test",
        includeEraOverlap: "Inclure le chevauchement des eres",
        firstOccurrenceOnly: "Premiere occurrence uniquement",
        inclusionStatistics: "Statistiques d'inclusion",
        incidenceRate: "Taux d'incidence",
        timeSeries: "Serie temporelle",
        breakdownIndexEvents: "Ventiler les evenements index",
        orphanConcepts: "Concepts orphelins",
        minCellCount: "Nombre minimum de cellules",
        minPriorObservation: "Observation anterieure min. (jours)",
        dechallengeStopInterval: "Intervalle d'arret dechallenge",
        dechallengeEvalWindow: "Fenetre d'evaluation dechallenge",
        start: "Debut (jours)",
        end: "Fin (jours)",
        cleanWindow: "Fenetre propre (jours)",
        method: "Methode",
        evidenceSourceModule: "Module source des preuves",
      },
      options: {
        synthesisMethods: {
          fixedEffects: "Effets fixes",
          randomEffects: "Effets aleatoires",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        description:
          "Genere des cohortes a partir de definitions. Requis pour tous les types d'etudes.",
      },
      cohortMethod: {
        description:
          "Estimation des effets au niveau populationnel a l'aide d'un schema comparatif par cohortes.",
      },
      patientLevelPrediction: {
        description:
          "Construit des modeles de prediction pour des resultats au niveau patient a l'aide du ML.",
      },
      selfControlledCaseSeries: {
        description:
          "Estime les rapports de taux d'incidence avec le schema SCCS.",
      },
      cohortDiagnostics: {
        description:
          "Evalue les algorithmes de phenotype et caracterise les cohortes.",
      },
      characterization: {
        description:
          "Calcule les caracteristiques de base des cohortes cible et comparatrice.",
      },
      cohortIncidence: {
        description:
          "Calcule les taux d'incidence des resultats dans les populations cibles.",
      },
      evidenceSynthesis: {
        description:
          "Meta-analyse entre sources de donnees avec des modeles a effets fixes ou aleatoires.",
      },
    },
  },
});

const deStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "Hinzugefugt",
      back: "Zuruck",
      comparator: "Vergleich",
      cohorts: "Kohorten",
      description: "Beschreibung",
      issues: "Probleme",
      modules: "Module",
      next: "Weiter",
      noneConfigured: "Nicht konfiguriert",
      outcome: "Ergebnis",
      required: "Erforderlich",
      source: "Quelle",
      status: "Status",
      target: "Ziel",
      warnings: "Warnungen",
    },
    page: {
      header: {
        title: "Studienpakete",
        subtitle:
          "Strategus-OHDSI-Studienpakete mit mehreren Analysen erstellen und ausfuhren",
        importJson: "JSON importieren",
        exportJson: "JSON exportieren",
      },
      steps: {
        studyInfo: "Studieninfo",
        selectModules: "Module auswahlen",
        sharedCohorts: "Gemeinsame Kohorten",
        moduleSettings: "Moduleinstellungen",
        jsonPreview: "JSON-Vorschau",
        reviewValidate: "Prufen und validieren",
        execute: "Ausfuhren",
      },
      studyInfo: {
        title: "Studieninformationen",
        intro:
          "Benennen Sie Ihr Studienpaket und fugen Sie optional eine Beschreibung hinzu.",
        studyName: "Studienname",
        description: "Beschreibung",
        studyNamePlaceholder:
          "z. B. Herzinsuffizienz-Risikostudie SGLT2i vs DPP4i",
        descriptionPlaceholder:
          "Beschreiben Sie kurz Studienziele, Population und erwartete Outcomes...",
        info: "Strategus fuhrt OHDSI-Studienpakete mit mehreren Analysen uber eine oder mehrere CDM-Datenquellen aus. Jedes Analysemodul lauft unabhangig und schreibt Ergebnisse in das konfigurierte Ausgabeverzeichnis.",
      },
      selectModules: {
        loading: "Verfugbare Module werden geladen...",
        title: "Analysemodule auswahlen",
        intro:
          "Wahlen Sie aus, welche OHDSI-Analysemodule enthalten sein sollen. CohortGenerator ist erforderlich und immer enthalten.",
        selectedSummary_one:
          "{{count}} Modul ausgewahlt (einschlieich CohortGenerator)",
        selectedSummary_other:
          "{{count}} Module ausgewahlt (einschlieich CohortGenerator)",
      },
      sharedCohorts: {
        title: "Gemeinsame Kohortendefinitionen",
        intro:
          "Fugen Sie Ziel-, Vergleichs- und Outcome-Kohorten hinzu, die von allen Analysemodulen gemeinsam genutzt werden.",
        addCohort: "Kohorte hinzufugen",
        searchPlaceholder: "Kohortendefinitionen suchen...",
        loading: "Kohorten werden geladen...",
        noneFound: "Keine Kohortendefinitionen gefunden.",
        empty:
          "Noch keine Kohorten hinzugefugt. Die meisten Analysemodule benotigen mindestens eine Zielkohorte.",
        roles: {
          target: "Ziel",
          comparator: "Vergleich",
          outcome: "Ergebnis",
        },
      },
      review: {
        title: "Zusammenfassung des Studienpakets",
        studyName: "Studienname",
        description: "Beschreibung",
        modules: "Module",
        cohorts: "Kohorten",
        validateTitle: "Spezifikation validieren",
        validateIntro:
          "Prufen Sie die Analysespezifikation vor der Ausfuhrung auf Konfigurationsprobleme der Module.",
        runValidation: "Validierung starten",
        validationPassed: "Validierung erfolgreich",
        validationFailed: "Validierung fehlgeschlagen",
        validationFailedWithMessage: "Validierung fehlgeschlagen: {{message}}",
        validationRequestFailed: "Validierungsanfrage fehlgeschlagen",
        severity: {
          error: "Fehler",
          warning: "Warnung",
        },
      },
      execute: {
        title: "Studienpaket ausfuhren",
        intro:
          'Wahlen Sie eine CDM-Datenquelle und fuhren Sie "{{studyName}}" uber alle konfigurierten Module aus.',
        targetDataSource: "Ziel-Datenquelle",
        loadingSources: "Quellen werden geladen...",
        selectSource: "Quelle auswahlen",
        executeStudyPackage: "Studienpaket ausfuhren",
        executing: "Wird ausgefuhrt...",
        runningTitle: "Studienpaket wird ausgefuhrt...",
        runningIntro:
          "Strategus orchestriert die Modulausfuhrung. Dies kann je nach Datensatzgroe und Anzahl der Module mehrere Minuten dauern.",
        executionFailed: "Ausfuhrung fehlgeschlagen: {{message}}",
        executionRequestFailed: "Ausfuhrungsanfrage fehlgeschlagen",
        executionComplete: "Ausfuhrung abgeschlossen",
        outputDirectory: "Ausgabeverzeichnis",
        modulesExecuted: "Ausgefuhrte Module",
        resultStats: {
          status: "Status",
          modulesRun: "Ausgefuhrte Module",
          resultFiles: "Ergebnisdateien",
        },
        statusLabels: {
          completed: "Abgeschlossen",
          running: "Laufend",
          failed: "Fehlgeschlagen",
        },
      },
    },
    jsonEditor: {
      title: "Vorschau der JSON-Spezifikation",
      intro:
        "Prufen Sie die erzeugte Analysespezifikation. Bearbeiten Sie sie direkt oder ubernehmen Sie die Anderungen unten.",
      copied: "Kopiert",
      copyToClipboard: "In Zwischenablage kopieren",
      resetToGenerated: "Auf erzeugte Version zurucksetzen",
      lineCount_one: "{{count}} Zeile",
      lineCount_other: "{{count}} Zeilen",
      validJson: "Gultiges JSON",
      invalidJson: "Ungultiges JSON",
      applyChanges: "Anderungen ubernehmen",
    },
    moduleSettings: {
      title: "Moduleinstellungen",
      intro:
        "Konfigurieren Sie die Parameter pro Modul. Klicken Sie auf ein Modul, um seine Einstellungen zu erweitern.",
      unknownModule: "Unbekanntes Modul: {{moduleName}}",
      noConfigurationNeeded:
        "Keine Konfiguration erforderlich. CohortGenerator erstellt Kohorten automatisch aus den gemeinsamen Kohortendefinitionen.",
      noCohorts:
        "Keine Kohorten verfugbar. Fugen Sie im Schritt Gemeinsame Kohorten Kohorten hinzu.",
      noRoleCohorts:
        "Keine {{role}}-Kohorten verfugbar. Fugen Sie im Schritt Gemeinsame Kohorten Kohorten hinzu.",
      sections: {
        cohortAssignment: "Kohortenzuordnung",
        parameters: "Parameter",
        covariateSettings: "Kovariateneinstellungen",
        modelConfiguration: "Modellkonfiguration",
        timeAtRisk: "Risikozeit",
        trainingParameters: "Trainingsparameter",
        eraCovariateSettings: "Era-Kovariateneinstellungen",
        diagnosticsOptions: "Diagnostikoptionen",
        synthesisConfiguration: "Synthesekonfiguration",
      },
      fields: {
        targetCohorts: "Zielkohorten",
        comparatorCohorts: "Vergleichskohorten",
        outcomeCohorts: "Outcome-Kohorten",
        exposureCohorts: "Expositionskohorten",
        washoutPeriod: "Washout-Periode (Tage)",
        maxCohortSize: "Max. Kohortengroe (0 = unbegrenzt)",
        demographics: "Demografie",
        conditionOccurrence: "Erkrankungsauftreten",
        drugExposure: "Arzneimittelexposition",
        procedureOccurrence: "Prozedurauftreten",
        measurement: "Messung",
        modelType: "Modelltyp",
        windowStart: "Fensterstart (Tage)",
        windowEnd: "Fensterende (Tage)",
        minCohortSize: "Min. Kohortengroe",
        splitSeed: "Split-Seed",
        testFraction: "Testanteil",
        includeEraOverlap: "Era-Uberlappung einschlieen",
        firstOccurrenceOnly: "Nur erste Auftreten",
        inclusionStatistics: "Einschlussstatistiken",
        incidenceRate: "Inzidenzrate",
        timeSeries: "Zeitreihe",
        breakdownIndexEvents: "Indexereignisse aufschlussen",
        orphanConcepts: "Verwaiste Konzepte",
        minCellCount: "Minimale Zellzahl",
        minPriorObservation: "Min. vorherige Beobachtung (Tage)",
        dechallengeStopInterval: "Dechallenge-Stoppintervall",
        dechallengeEvalWindow: "Dechallenge-Auswertungsfenster",
        start: "Beginn (Tage)",
        end: "Ende (Tage)",
        cleanWindow: "Sauberes Fenster (Tage)",
        method: "Methode",
        evidenceSourceModule: "Evidenzquellmodul",
      },
      options: {
        synthesisMethods: {
          fixedEffects: "Feste Effekte",
          randomEffects: "Zufallseffekte",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        description:
          "Erzeugt Kohorten aus Definitionen. Fur alle Studientypen erforderlich.",
      },
      cohortMethod: {
        description:
          "Effektschatzung auf Populationsebene mit vergleichendem Kohortendesign.",
      },
      patientLevelPrediction: {
        description:
          "Erstellt Vorhersagemodelle fur Outcomes auf Patientenebene mittels ML.",
      },
      selfControlledCaseSeries: {
        description: "Schatzt Inzidenzratenverhaltnisse mit dem SCCS-Design.",
      },
      cohortDiagnostics: {
        description:
          "Bewertet Phanotyp-Algorithmen und charakterisiert Kohorten.",
      },
      characterization: {
        description:
          "Berechnet Basismerkmale fur Ziel- und Vergleichskohorten.",
      },
      cohortIncidence: {
        description:
          "Berechnet Inzidenzraten von Outcomes in Zielpopulationen.",
      },
      evidenceSynthesis: {
        description:
          "Metaanalyse uber Datenquellen mit Modellen fur feste oder zufallige Effekte.",
      },
    },
  },
});

const ptStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "Adicionado",
      back: "Voltar",
      comparator: "Comparador",
      cohorts: "Coortes",
      description: "Descricao",
      issues: "Problemas",
      modules: "Modulos",
      next: "Proximo",
      noneConfigured: "Nada configurado",
      outcome: "Desfecho",
      required: "Obrigatorio",
      source: "Fonte",
      status: "Status",
      target: "Alvo",
      warnings: "Avisos",
    },
    page: {
      header: {
        title: "Pacotes de estudo",
        subtitle:
          "Monte e execute pacotes de estudo OHDSI multi-analise com Strategus",
        importJson: "Importar JSON",
        exportJson: "Exportar JSON",
      },
      steps: {
        studyInfo: "Informacoes do estudo",
        selectModules: "Selecionar modulos",
        sharedCohorts: "Coortes compartilhadas",
        moduleSettings: "Configuracoes dos modulos",
        jsonPreview: "Pre-visualizacao JSON",
        reviewValidate: "Revisar e validar",
        execute: "Executar",
      },
      studyInfo: {
        title: "Informacoes do estudo",
        intro: "Nomeie seu pacote de estudo e forneca uma descricao opcional.",
        studyName: "Nome do estudo",
        description: "Descricao",
        studyNamePlaceholder:
          "ex.: Estudo de risco de insuficiencia cardiaca SGLT2i vs DPP4i",
        descriptionPlaceholder:
          "Descreva brevemente os objetivos do estudo, a populacao e os desfechos esperados...",
        info: "Strategus executa pacotes de estudo OHDSI multi-analise em uma ou mais fontes de dados CDM. Cada modulo de analise roda de forma independente e grava os resultados no diretorio de saida configurado.",
      },
      selectModules: {
        loading: "Carregando modulos disponiveis...",
        title: "Selecionar modulos de analise",
        intro:
          "Escolha quais modulos de analise OHDSI incluir. CohortGenerator e obrigatorio e sempre incluido.",
        selectedSummary_one:
          "{{count}} modulo selecionado (incluindo CohortGenerator)",
        selectedSummary_other:
          "{{count}} modulos selecionados (incluindo CohortGenerator)",
      },
      sharedCohorts: {
        title: "Definicoes de coorte compartilhadas",
        intro:
          "Adicione coortes de alvo, comparador e desfecho compartilhadas por todos os modulos de analise.",
        addCohort: "Adicionar coorte",
        searchPlaceholder: "Pesquisar definicoes de coorte...",
        loading: "Carregando coortes...",
        noneFound: "Nenhuma definicao de coorte encontrada.",
        empty:
          "Ainda nao ha coortes adicionadas. A maioria dos modulos de analise exige pelo menos uma coorte alvo.",
        roles: {
          target: "Alvo",
          comparator: "Comparador",
          outcome: "Desfecho",
        },
      },
      review: {
        title: "Resumo do pacote de estudo",
        studyName: "Nome do estudo",
        description: "Descricao",
        modules: "Modulos",
        cohorts: "Coortes",
        validateTitle: "Validar especificacao",
        validateIntro:
          "Verifique a especificacao da analise em busca de problemas de configuracao dos modulos antes de executar.",
        runValidation: "Executar validacao",
        validationPassed: "Validacao aprovada",
        validationFailed: "Validacao falhou",
        validationFailedWithMessage: "Validacao falhou: {{message}}",
        validationRequestFailed: "Falha na solicitacao de validacao",
        severity: {
          error: "Erro",
          warning: "Aviso",
        },
      },
      execute: {
        title: "Executar pacote de estudo",
        intro:
          'Selecione uma fonte de dados CDM e execute "{{studyName}}" em todos os modulos configurados.',
        targetDataSource: "Fonte de dados alvo",
        loadingSources: "Carregando fontes...",
        selectSource: "Selecionar uma fonte",
        executeStudyPackage: "Executar pacote de estudo",
        executing: "Executando...",
        runningTitle: "O pacote de estudo esta em execucao...",
        runningIntro:
          "Strategus esta orquestrando a execucao dos modulos. Isso pode levar varios minutos dependendo do tamanho do conjunto de dados e da quantidade de modulos.",
        executionFailed: "Execucao falhou: {{message}}",
        executionRequestFailed: "Falha na solicitacao de execucao",
        executionComplete: "Execucao concluida",
        outputDirectory: "Diretorio de saida",
        modulesExecuted: "Modulos executados",
        resultStats: {
          status: "Status",
          modulesRun: "Modulos executados",
          resultFiles: "Arquivos de resultado",
        },
        statusLabels: {
          completed: "Concluido",
          running: "Em execucao",
          failed: "Falhou",
        },
      },
    },
    jsonEditor: {
      title: "Pre-visualizacao da especificacao JSON",
      intro:
        "Revise a especificacao de analise gerada. Edite diretamente ou aplique as alteracoes abaixo.",
      copied: "Copiado",
      copyToClipboard: "Copiar para a area de transferencia",
      resetToGenerated: "Redefinir para a versao gerada",
      lineCount_one: "{{count}} linha",
      lineCount_other: "{{count}} linhas",
      validJson: "JSON valido",
      invalidJson: "JSON invalido",
      applyChanges: "Aplicar alteracoes",
    },
    moduleSettings: {
      title: "Configuracoes dos modulos",
      intro:
        "Configure os parametros de cada modulo. Clique em um modulo para expandir suas configuracoes.",
      unknownModule: "Modulo desconhecido: {{moduleName}}",
      noConfigurationNeeded:
        "Nenhuma configuracao necessaria. CohortGenerator constroi coortes automaticamente a partir das definicoes de coorte compartilhadas.",
      noCohorts:
        "Nenhuma coorte disponivel. Adicione coortes na etapa Coortes compartilhadas.",
      noRoleCohorts:
        "Nenhuma coorte {{role}} disponivel. Adicione coortes na etapa Coortes compartilhadas.",
      sections: {
        cohortAssignment: "Atribuicao de coortes",
        parameters: "Parametros",
        covariateSettings: "Configuracoes de covariaveis",
        modelConfiguration: "Configuracao do modelo",
        timeAtRisk: "Tempo em risco",
        trainingParameters: "Parametros de treinamento",
        eraCovariateSettings: "Configuracoes de covariaveis de era",
        diagnosticsOptions: "Opcoes de diagnostico",
        synthesisConfiguration: "Configuracao da sintese",
      },
      fields: {
        targetCohorts: "Coortes alvo",
        comparatorCohorts: "Coortes comparadoras",
        outcomeCohorts: "Coortes de desfecho",
        exposureCohorts: "Coortes de exposicao",
        washoutPeriod: "Periodo de washout (dias)",
        maxCohortSize: "Tamanho max. da coorte (0 = ilimitado)",
        demographics: "Demografia",
        conditionOccurrence: "Ocorrencia de condicao",
        drugExposure: "Exposicao a medicamento",
        procedureOccurrence: "Ocorrencia de procedimento",
        measurement: "Medicao",
        modelType: "Tipo de modelo",
        windowStart: "Inicio da janela (dias)",
        windowEnd: "Fim da janela (dias)",
        minCohortSize: "Tamanho minimo da coorte",
        splitSeed: "Semente de divisao",
        testFraction: "Fracao de teste",
        includeEraOverlap: "Incluir sobreposicao de era",
        firstOccurrenceOnly: "Apenas primeira ocorrencia",
        inclusionStatistics: "Estatisticas de inclusao",
        incidenceRate: "Taxa de incidencia",
        timeSeries: "Serie temporal",
        breakdownIndexEvents: "Detalhar eventos indice",
        orphanConcepts: "Conceitos orfaos",
        minCellCount: "Contagem minima de celulas",
        minPriorObservation: "Observacao previa minima (dias)",
        dechallengeStopInterval: "Intervalo de parada dechallenge",
        dechallengeEvalWindow: "Janela de avaliacao dechallenge",
        start: "Inicio (dias)",
        end: "Fim (dias)",
        cleanWindow: "Janela limpa (dias)",
        method: "Metodo",
        evidenceSourceModule: "Modulo fonte de evidencia",
      },
      options: {
        synthesisMethods: {
          fixedEffects: "Efeitos fixos",
          randomEffects: "Efeitos aleatorios",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        description:
          "Gera coortes a partir de definicoes. Obrigatorio para todos os tipos de estudo.",
      },
      cohortMethod: {
        description:
          "Estimativa de efeito em nivel populacional usando desenho comparativo por coortes.",
      },
      patientLevelPrediction: {
        description:
          "Constroi modelos de predicao para desfechos em nivel de paciente usando ML.",
      },
      selfControlledCaseSeries: {
        description:
          "Estima razoes de taxa de incidencia usando o desenho SCCS.",
      },
      cohortDiagnostics: {
        description: "Avalia algoritmos de fenotipo e caracteriza coortes.",
      },
      characterization: {
        description:
          "Calcula caracteristicas basais das coortes alvo e comparadora.",
      },
      cohortIncidence: {
        description:
          "Calcula taxas de incidencia de desfechos em populacoes alvo.",
      },
      evidenceSynthesis: {
        description:
          "Meta-analise entre fontes de dados usando modelos de efeitos fixos/aleatorios.",
      },
    },
  },
});

const esStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "Agregado",
      auto: "Automatico",
      back: "Volver",
      comparator: "Comparador",
      cohorts: "Cohortes",
      description: "Descripcion",
      issues: "Problemas",
      modules: "Modulos",
      next: "Siguiente",
      noneConfigured: "Nada configurado",
      outcome: "Resultado",
      required: "Obligatorio",
      source: "Fuente",
      status: "Estado",
      target: "Objetivo",
      warnings: "Advertencias",
    },
    page: {
      header: {
        title: "Paquetes de estudio",
        subtitle:
          "Cree y ejecute paquetes de estudio OHDSI de Strategus con multiples analisis",
        importJson: "Importar JSON",
        exportJson: "Exportar JSON",
      },
      steps: {
        studyInfo: "Informacion del estudio",
        selectModules: "Seleccionar modulos",
        sharedCohorts: "Cohortes compartidas",
        moduleSettings: "Configuracion de modulos",
        jsonPreview: "Vista previa JSON",
        reviewValidate: "Revisar y validar",
        execute: "Ejecutar",
      },
      studyInfo: {
        title: "Informacion del estudio",
        intro:
          "Nombre su paquete de estudio y proporcione una descripcion opcional.",
        studyName: "Nombre del estudio",
        description: "Descripcion",
        studyNamePlaceholder:
          "p. ej., estudio del riesgo de insuficiencia cardiaca SGLT2i vs DPP4i",
        descriptionPlaceholder:
          "Describa brevemente los objetivos del estudio, la poblacion y los resultados esperados...",
        info: "Strategus ejecuta paquetes de estudio OHDSI con multiples analisis sobre una o mas fuentes de datos CDM. Cada modulo de analisis se ejecuta de forma independiente y escribe los resultados en el directorio de salida configurado.",
      },
      selectModules: {
        loading: "Cargando modulos disponibles...",
        title: "Seleccionar modulos de analisis",
        intro:
          "Elija que modulos de analisis OHDSI desea incluir. CohortGenerator es obligatorio y siempre esta incluido.",
      },
      sharedCohorts: {
        title: "Definiciones de cohortes compartidas",
        intro:
          "Agregue cohortes objetivo, comparadoras y de resultado compartidas entre todos los modulos de analisis.",
        addCohort: "Agregar cohorte",
        loading: "Cargando cohortes...",
        noneFound: "No se encontraron definiciones de cohortes.",
        empty:
          "Aun no se agregaron cohortes. La mayoria de los modulos de analisis requiere al menos una cohorte objetivo.",
        roles: {
          target: "Objetivo",
          comparator: "Comparador",
          outcome: "Resultado",
        },
      },
      review: {
        title: "Resumen del paquete de estudio",
        studyName: "Nombre del estudio",
        description: "Descripcion",
        modules: "Modulos",
        cohorts: "Cohortes",
        validateTitle: "Validar especificacion",
        validateIntro:
          "Revise la especificacion del analisis para detectar problemas de configuracion de modulos antes de ejecutar.",
        runValidation: "Ejecutar validacion",
        validationPassed: "Validacion aprobada",
        validationFailed: "Validacion fallida",
        validationRequestFailed: "La solicitud de validacion fallo",
        severity: {
          warning: "Advertencia",
        },
      },
      execute: {
        title: "Ejecutar paquete de estudio",
        targetDataSource: "Fuente de datos objetivo",
        loadingSources: "Cargando fuentes...",
        selectSource: "Seleccione una fuente",
        executeStudyPackage: "Ejecutar paquete de estudio",
        executing: "Ejecutando...",
        runningTitle: "El paquete de estudio se esta ejecutando...",
        runningIntro:
          "Strategus esta orquestando la ejecucion de los modulos. Esto puede tardar varios minutos segun el tamano del conjunto de datos y la cantidad de modulos.",
        executionRequestFailed: "La solicitud de ejecucion fallo",
        executionComplete: "Ejecucion completada",
        outputDirectory: "Directorio de salida",
        modulesExecuted: "Modulos ejecutados",
        resultStats: {
          status: "Estado",
          modulesRun: "Modulos ejecutados",
          resultFiles: "Archivos de resultados",
        },
        statusLabels: {
          completed: "Completado",
          running: "En ejecucion",
          failed: "Fallido",
        },
      },
    },
    jsonEditor: {
      title: "Vista previa de la especificacion JSON",
      intro:
        "Revise la especificacion de analisis generada. Edite directamente o aplique los cambios a continuacion.",
      copied: "Copiado",
      copyToClipboard: "Copiar al portapapeles",
      resetToGenerated: "Restablecer a la version generada",
      validJson: "JSON valido",
      invalidJson: "JSON no valido",
      applyChanges: "Aplicar cambios",
    },
    moduleSettings: {
      title: "Configuracion de modulos",
      intro:
        "Configure los parametros de cada modulo. Haga clic en un modulo para expandir su configuracion.",
      autoBadge: "Automatico",
      noConfigurationNeeded:
        "No se necesita configuracion. CohortGenerator crea cohortes automaticamente a partir de las definiciones de cohortes compartidas.",
      noCohorts:
        "No hay cohortes disponibles. Agregue cohortes en el paso Cohortes compartidas.",
      sections: {
        cohortAssignment: "Asignacion de cohortes",
        parameters: "Parametros",
        covariateSettings: "Configuracion de covariables",
        modelConfiguration: "Configuracion del modelo",
        timeAtRisk: "Tiempo en riesgo",
        trainingParameters: "Parametros de entrenamiento",
        eraCovariateSettings: "Configuracion de covariables por era",
        diagnosticsOptions: "Opciones de diagnostico",
        synthesisConfiguration: "Configuracion de sintesis",
      },
      fields: {
        targetCohorts: "Cohortes objetivo",
        comparatorCohorts: "Cohortes comparadoras",
        outcomeCohorts: "Cohortes de resultado",
        exposureCohorts: "Cohortes de exposicion",
        washoutPeriod: "Periodo de lavado (dias)",
        maxCohortSize: "Tamano maximo de la cohorte (0 = ilimitado)",
        demographics: "Demografia",
        conditionOccurrence: "Aparicion de condicion",
        drugExposure: "Exposicion a medicamentos",
        procedureOccurrence: "Aparicion de procedimientos",
        measurement: "Medicion",
        modelType: "Tipo de modelo",
        windowStart: "Inicio de ventana (dias)",
        windowEnd: "Fin de ventana (dias)",
        minCohortSize: "Tamano minimo de cohorte",
        splitSeed: "Semilla de particion",
        testFraction: "Fraccion de prueba",
        includeEraOverlap: "Incluir superposicion de eras",
        firstOccurrenceOnly: "Solo primera aparicion",
        inclusionStatistics: "Estadisticas de inclusion",
        incidenceRate: "Tasa de incidencia",
        timeSeries: "Serie temporal",
        breakdownIndexEvents: "Desglosar eventos indice",
        orphanConcepts: "Conceptos huerfanos",
        minCellCount: "Conteo minimo de celdas",
        minPriorObservation: "Observacion previa minima (dias)",
        dechallengeStopInterval: "Intervalo de detencion de dechallenge",
        dechallengeEvalWindow: "Ventana de evaluacion de dechallenge",
        start: "Inicio (dias)",
        end: "Fin (dias)",
        cleanWindow: "Ventana limpia (dias)",
        method: "Metodo",
        evidenceSourceModule: "Modulo de origen de evidencia",
      },
      options: {
        modelTypes: {
          gradientBoosting: "Potenciacion de gradiente",
          randomForest: "Bosque aleatorio",
          deepLearning: "Aprendizaje profundo",
        },
        synthesisMethods: {
          fixedEffects: "Efectos fijos",
          randomEffects: "Efectos aleatorios",
          bayesian: "Bayesiano",
        },
        evidenceSources: {
          cohortMethod: "Metodo de cohortes",
          selfControlledCaseSeries: "Serie de casos autocontrolados",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "Generador de cohortes",
        description:
          "Genera cohortes a partir de definiciones. Es obligatorio para todos los tipos de estudio.",
      },
      cohortMethod: {
        label: "Metodo de cohortes",
        description:
          "Estimacion del efecto a nivel poblacional mediante un diseno comparativo por cohortes.",
      },
      patientLevelPrediction: {
        label: "Prediccion a nivel de paciente",
        description:
          "Crea modelos de prediccion para resultados a nivel de paciente usando ML.",
      },
      selfControlledCaseSeries: {
        label: "Serie de casos autocontrolados",
        description:
          "Estima razones de tasas de incidencia mediante el diseno SCCS.",
      },
      cohortDiagnostics: {
        label: "Diagnostico de cohortes",
        description: "Evalua algoritmos de fenotipo y caracteriza cohortes.",
      },
      characterization: {
        label: "Caracterizacion",
        description:
          "Calcula caracteristicas basales en cohortes objetivo y comparadoras.",
      },
      cohortIncidence: {
        label: "Incidencia de cohortes",
        description:
          "Calcula tasas de incidencia de resultados en poblaciones objetivo.",
      },
      evidenceSynthesis: {
        label: "Sintesis de evidencia",
        description:
          "Metaanalisis entre fuentes de datos usando modelos de efectos fijos o aleatorios.",
      },
    },
  },
});

const koStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "추가됨",
      auto: "자동",
      back: "뒤로",
      comparator: "비교군",
      cohorts: "코호트",
      description: "설명",
      issues: "문제",
      modules: "모듈",
      next: "다음",
      noneConfigured: "구성되지 않음",
      outcome: "결과",
      required: "필수",
      source: "소스",
      status: "상태",
      target: "대상",
      warnings: "경고",
    },
    page: {
      header: {
        title: "연구 패키지",
        subtitle: "Strategus 다중 분석 OHDSI 연구 패키지를 구축하고 실행합니다",
        importJson: "JSON 가져오기",
        exportJson: "JSON 내보내기",
      },
      steps: {
        studyInfo: "연구 정보",
        selectModules: "모듈 선택",
        sharedCohorts: "공유 코호트",
        moduleSettings: "모듈 설정",
        jsonPreview: "JSON 미리보기",
        reviewValidate: "검토 및 검증",
        execute: "실행",
      },
      studyInfo: {
        title: "연구 정보",
        intro: "연구 패키지 이름을 지정하고 선택적으로 설명을 추가하세요.",
        studyName: "연구 이름",
        description: "설명",
        studyNamePlaceholder: "예: SGLT2i 대 DPP4i 심부전 위험 연구",
        descriptionPlaceholder:
          "연구 목표, 대상 집단, 예상 결과를 간단히 설명하세요...",
        info: "Strategus는 하나 이상의 CDM 데이터 소스에서 다중 분석 OHDSI 연구 패키지를 실행합니다. 각 분석 모듈은 독립적으로 실행되며 구성된 출력 디렉터리에 결과를 기록합니다.",
      },
      selectModules: {
        loading: "사용 가능한 모듈을 불러오는 중...",
        title: "분석 모듈 선택",
        intro:
          "포함할 OHDSI 분석 모듈을 선택하세요. CohortGenerator는 필수이며 항상 포함됩니다.",
      },
      sharedCohorts: {
        title: "공유 코호트 정의",
        intro:
          "모든 분석 모듈에서 공유하는 대상, 비교군, 결과 코호트를 추가하세요.",
        addCohort: "코호트 추가",
        loading: "코호트 불러오는 중...",
        noneFound: "코호트 정의를 찾을 수 없습니다.",
        empty:
          "아직 추가된 코호트가 없습니다. 대부분의 분석 모듈은 최소 하나의 대상 코호트를 필요로 합니다.",
        roles: {
          target: "대상",
          comparator: "비교군",
          outcome: "결과",
        },
      },
      review: {
        title: "연구 패키지 요약",
        studyName: "연구 이름",
        description: "설명",
        modules: "모듈",
        cohorts: "코호트",
        validateTitle: "명세 검증",
        validateIntro: "실행 전에 분석 명세에서 모듈 구성 문제를 확인하세요.",
        runValidation: "검증 실행",
        validationPassed: "검증 통과",
        validationFailed: "검증 실패",
        validationRequestFailed: "검증 요청 실패",
        severity: {
          error: "오류",
          warning: "경고",
        },
      },
      execute: {
        title: "연구 패키지 실행",
        targetDataSource: "대상 데이터 소스",
        loadingSources: "소스 불러오는 중...",
        selectSource: "소스를 선택하세요",
        executeStudyPackage: "연구 패키지 실행",
        executing: "실행 중...",
        runningTitle: "연구 패키지가 실행 중입니다...",
        runningIntro:
          "Strategus가 모듈 실행을 조율하고 있습니다. 데이터셋 크기와 모듈 수에 따라 몇 분이 걸릴 수 있습니다.",
        executionRequestFailed: "실행 요청에 실패했습니다",
        executionComplete: "실행 완료",
        outputDirectory: "출력 디렉터리",
        modulesExecuted: "실행된 모듈",
        resultStats: {
          status: "상태",
          modulesRun: "실행된 모듈",
          resultFiles: "결과 파일",
        },
        statusLabels: {
          completed: "완료됨",
          running: "실행 중",
          failed: "실패",
        },
      },
    },
    jsonEditor: {
      title: "JSON 명세 미리보기",
      intro:
        "생성된 분석 명세를 검토하세요. 직접 편집하거나 아래 변경 사항을 적용할 수 있습니다.",
      copied: "복사됨",
      copyToClipboard: "클립보드에 복사",
      resetToGenerated: "생성된 버전으로 재설정",
      validJson: "유효한 JSON",
      invalidJson: "유효하지 않은 JSON",
      applyChanges: "변경 사항 적용",
    },
    moduleSettings: {
      title: "모듈 설정",
      intro: "모듈별 매개변수를 구성하세요. 설정을 보려면 모듈을 클릭하세요.",
      autoBadge: "자동",
      noConfigurationNeeded:
        "추가 설정이 필요하지 않습니다. CohortGenerator가 공유 코호트 정의에서 코호트를 자동으로 생성합니다.",
      noCohorts:
        "사용 가능한 코호트가 없습니다. 공유 코호트 단계에서 코호트를 추가하세요.",
      sections: {
        cohortAssignment: "코호트 할당",
        parameters: "매개변수",
        covariateSettings: "공변량 설정",
        modelConfiguration: "모델 구성",
        timeAtRisk: "위험 기간",
        trainingParameters: "학습 매개변수",
        eraCovariateSettings: "Era 공변량 설정",
        diagnosticsOptions: "진단 옵션",
        synthesisConfiguration: "근거 통합 설정",
      },
      fields: {
        targetCohorts: "대상 코호트",
        comparatorCohorts: "비교군 코호트",
        outcomeCohorts: "결과 코호트",
        exposureCohorts: "노출 코호트",
        washoutPeriod: "Washout 기간 (일)",
        maxCohortSize: "최대 코호트 크기 (0 = 제한 없음)",
        demographics: "인구통계",
        conditionOccurrence: "질환 발생",
        drugExposure: "약물 노출",
        procedureOccurrence: "시술 발생",
        measurement: "측정",
        modelType: "모델 유형",
        windowStart: "창 시작 (일)",
        windowEnd: "창 종료 (일)",
        minCohortSize: "최소 코호트 크기",
        splitSeed: "분할 시드",
        testFraction: "테스트 비율",
        includeEraOverlap: "Era 중복 포함",
        firstOccurrenceOnly: "첫 발생만",
        inclusionStatistics: "포함 통계",
        incidenceRate: "발생률",
        timeSeries: "시계열",
        breakdownIndexEvents: "지표 사건 세분화",
        orphanConcepts: "고아 개념",
        minCellCount: "최소 셀 수",
        minPriorObservation: "최소 이전 관찰 기간 (일)",
        dechallengeStopInterval: "Dechallenge 중단 간격",
        dechallengeEvalWindow: "Dechallenge 평가 창",
        start: "시작 (일)",
        end: "종료 (일)",
        cleanWindow: "정리 창 (일)",
        method: "방법",
        evidenceSourceModule: "근거 원본 모듈",
      },
      options: {
        modelTypes: {
          gradientBoosting: "그래디언트 부스팅",
          randomForest: "랜덤 포레스트",
          deepLearning: "딥러닝",
        },
        synthesisMethods: {
          fixedEffects: "고정 효과",
          randomEffects: "무작위 효과",
          bayesian: "베이지안",
        },
        evidenceSources: {
          cohortMethod: "코호트 방법",
          selfControlledCaseSeries: "자가대조 사례군",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "코호트 생성기",
        description:
          "정의에서 코호트를 생성합니다. 모든 연구 유형에 필수입니다.",
      },
      cohortMethod: {
        label: "코호트 방법",
        description: "비교 코호트 설계를 사용해 집단 수준의 효과를 추정합니다.",
      },
      patientLevelPrediction: {
        label: "환자 수준 예측",
        description:
          "ML을 사용해 환자 수준 결과에 대한 예측 모델을 구축합니다.",
      },
      selfControlledCaseSeries: {
        label: "자가대조 사례군",
        description: "SCCS 설계를 사용해 발생률 비를 추정합니다.",
      },
      cohortDiagnostics: {
        label: "코호트 진단",
        description: "표현형 알고리즘을 평가하고 코호트를 특성화합니다.",
      },
      characterization: {
        label: "특성화",
        description: "대상 및 비교군 코호트 전반의 기저 특성을 계산합니다.",
      },
      cohortIncidence: {
        label: "코호트 발생률",
        description: "대상 집단에서 결과의 발생률을 계산합니다.",
      },
      evidenceSynthesis: {
        label: "근거 종합",
        description:
          "고정 효과 또는 무작위 효과 모델을 사용해 데이터 소스 전반의 메타분석을 수행합니다.",
      },
    },
  },
});

const hiStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "जोड़ा गया",
      auto: "स्वचालित",
      back: "वापस",
      comparator: "तुलनाकार",
      cohorts: "समूह",
      description: "विवरण",
      issues: "समस्याएं",
      modules: "मॉड्यूल",
      next: "अगला",
      noneConfigured: "कुछ भी कॉन्फ़िगर नहीं",
      outcome: "परिणाम",
      required: "आवश्यक",
      source: "स्रोत",
      status: "स्थिति",
      target: "लक्ष्य",
      warnings: "चेतावनियां",
    },
    page: {
      header: {
        title: "अध्ययन पैकेज",
        subtitle: "Strategus बहु-विश्लेषण OHDSI अध्ययन पैकेज बनाएं और चलाएं",
        importJson: "JSON आयात करें",
        exportJson: "JSON निर्यात करें",
      },
      steps: {
        studyInfo: "अध्ययन जानकारी",
        selectModules: "मॉड्यूल चुनें",
        sharedCohorts: "साझा समूह",
        moduleSettings: "मॉड्यूल सेटिंग्स",
        jsonPreview: "JSON पूर्वावलोकन",
        reviewValidate: "समीक्षा और सत्यापन",
        execute: "चलाएं",
      },
      studyInfo: {
        title: "अध्ययन जानकारी",
        intro: "अपने अध्ययन पैकेज का नाम दें और वैकल्पिक विवरण प्रदान करें।",
        studyName: "अध्ययन नाम",
        description: "विवरण",
        studyNamePlaceholder:
          "उदा., SGLT2i बनाम DPP4i हृदय विफलता जोखिम अध्ययन",
        descriptionPlaceholder:
          "अध्ययन के उद्देश्यों, आबादी और अपेक्षित परिणामों का संक्षेप में वर्णन करें...",
        info: "Strategus एक या अधिक CDM डेटा स्रोतों पर बहु-विश्लेषण OHDSI अध्ययन पैकेज चलाता है। प्रत्येक विश्लेषण मॉड्यूल स्वतंत्र रूप से चलता है और परिणामों को कॉन्फ़िगर किए गए आउटपुट डायरेक्टरी में लिखता है।",
      },
      selectModules: {
        loading: "उपलब्ध मॉड्यूल लोड हो रहे हैं...",
        title: "विश्लेषण मॉड्यूल चुनें",
        intro:
          "चुनें कि कौन से OHDSI विश्लेषण मॉड्यूल शामिल करने हैं। CohortGenerator आवश्यक है और हमेशा शामिल रहता है।",
      },
      sharedCohorts: {
        title: "साझा समूह परिभाषाएं",
        intro:
          "सभी विश्लेषण मॉड्यूल में साझा लक्ष्य, तुलनाकार और परिणाम समूह जोड़ें।",
        addCohort: "समूह जोड़ें",
        loading: "समूह लोड हो रहे हैं...",
        noneFound: "कोई समूह परिभाषा नहीं मिली।",
        empty:
          "अभी तक कोई समूह नहीं जोड़ा गया है। अधिकांश विश्लेषण मॉड्यूल को कम से कम एक लक्ष्य समूह चाहिए।",
        roles: {
          target: "लक्ष्य",
          comparator: "तुलनाकार",
          outcome: "परिणाम",
        },
      },
      review: {
        title: "अध्ययन पैकेज सारांश",
        studyName: "अध्ययन नाम",
        description: "विवरण",
        modules: "मॉड्यूल",
        cohorts: "समूह",
        validateTitle: "विनिर्देश सत्यापित करें",
        validateIntro:
          "चलाने से पहले मॉड्यूल कॉन्फ़िगरेशन समस्याओं के लिए विश्लेषण विनिर्देश की जांच करें।",
        runValidation: "सत्यापन चलाएं",
        validationPassed: "सत्यापन सफल",
        validationFailed: "सत्यापन विफल",
        validationRequestFailed: "सत्यापन अनुरोध विफल हुआ",
        severity: {
          error: "त्रुटि",
          warning: "चेतावनी",
        },
      },
      execute: {
        title: "अध्ययन पैकेज चलाएं",
        targetDataSource: "लक्ष्य डेटा स्रोत",
        loadingSources: "स्रोत लोड हो रहे हैं...",
        selectSource: "एक स्रोत चुनें",
        executeStudyPackage: "अध्ययन पैकेज चलाएं",
        executing: "चल रहा है...",
        runningTitle: "अध्ययन पैकेज चल रहा है...",
        runningIntro:
          "Strategus मॉड्यूल निष्पादन का समन्वय कर रहा है। डेटासेट के आकार और मॉड्यूल की संख्या के आधार पर इसमें कई मिनट लग सकते हैं।",
        executionRequestFailed: "निष्पादन अनुरोध विफल हुआ",
        executionComplete: "निष्पादन पूरा हुआ",
        outputDirectory: "आउटपुट डायरेक्टरी",
        modulesExecuted: "चलाए गए मॉड्यूल",
        resultStats: {
          status: "स्थिति",
          modulesRun: "चलाए गए मॉड्यूल",
          resultFiles: "परिणाम फाइलें",
        },
        statusLabels: {
          completed: "पूर्ण",
          running: "चल रहा है",
          failed: "विफल",
        },
      },
    },
    jsonEditor: {
      title: "JSON विनिर्देश पूर्वावलोकन",
      intro:
        "उत्पन्न विश्लेषण विनिर्देश की समीक्षा करें। सीधे संपादित करें या नीचे दिए गए बदलाव लागू करें।",
      copied: "कॉपी किया गया",
      copyToClipboard: "क्लिपबोर्ड पर कॉपी करें",
      resetToGenerated: "उत्पन्न संस्करण पर रीसेट करें",
      validJson: "वैध JSON",
      invalidJson: "अवैध JSON",
      applyChanges: "बदलाव लागू करें",
    },
    moduleSettings: {
      title: "मॉड्यूल सेटिंग्स",
      intro:
        "प्रत्येक मॉड्यूल के पैरामीटर कॉन्फ़िगर करें। सेटिंग्स खोलने के लिए मॉड्यूल पर क्लिक करें।",
      autoBadge: "स्वचालित",
      noConfigurationNeeded:
        "किसी कॉन्फ़िगरेशन की आवश्यकता नहीं है। CohortGenerator साझा समूह परिभाषाओं से समूह स्वचालित रूप से बनाता है।",
      noCohorts: "कोई समूह उपलब्ध नहीं है। साझा समूह चरण में समूह जोड़ें।",
      sections: {
        cohortAssignment: "समूह असाइनमेंट",
        parameters: "पैरामीटर",
        covariateSettings: "सह-परिवर्ती सेटिंग्स",
        modelConfiguration: "मॉडल कॉन्फ़िगरेशन",
        timeAtRisk: "जोखिम अवधि",
        trainingParameters: "प्रशिक्षण पैरामीटर",
        eraCovariateSettings: "Era सह-परिवर्ती सेटिंग्स",
        diagnosticsOptions: "डायग्नोस्टिक विकल्प",
        synthesisConfiguration: "साक्ष्य संश्लेषण कॉन्फ़िगरेशन",
      },
      fields: {
        targetCohorts: "लक्ष्य समूह",
        comparatorCohorts: "तुलनाकार समूह",
        outcomeCohorts: "परिणाम समूह",
        exposureCohorts: "एक्सपोज़र समूह",
        washoutPeriod: "Washout अवधि (दिन)",
        maxCohortSize: "अधिकतम समूह आकार (0 = असीमित)",
        demographics: "जनसांख्यिकी",
        conditionOccurrence: "स्थिति घटना",
        drugExposure: "दवा एक्सपोज़र",
        procedureOccurrence: "प्रक्रिया घटना",
        measurement: "मापन",
        modelType: "मॉडल प्रकार",
        windowStart: "विंडो प्रारंभ (दिन)",
        windowEnd: "विंडो समाप्ति (दिन)",
        minCohortSize: "न्यूनतम समूह आकार",
        splitSeed: "विभाजन सीड",
        testFraction: "परीक्षण अंश",
        includeEraOverlap: "Era ओवरलैप शामिल करें",
        firstOccurrenceOnly: "केवल पहली घटना",
        inclusionStatistics: "समावेशन सांख्यिकी",
        incidenceRate: "घटना दर",
        timeSeries: "समय श्रृंखला",
        breakdownIndexEvents: "सूचक घटनाओं का विभाजन",
        orphanConcepts: "अनाथ कॉन्सेप्ट",
        minCellCount: "न्यूनतम सेल संख्या",
        minPriorObservation: "न्यूनतम पूर्व अवलोकन (दिन)",
        dechallengeStopInterval: "Dechallenge रोक अंतराल",
        dechallengeEvalWindow: "Dechallenge मूल्यांकन विंडो",
        start: "प्रारंभ (दिन)",
        end: "समाप्ति (दिन)",
        cleanWindow: "क्लीन विंडो (दिन)",
        method: "विधि",
        evidenceSourceModule: "साक्ष्य स्रोत मॉड्यूल",
      },
      options: {
        modelTypes: {
          gradientBoosting: "ग्रेडिएंट बूस्टिंग",
          randomForest: "रैंडम फॉरेस्ट",
          deepLearning: "डीप लर्निंग",
        },
        synthesisMethods: {
          fixedEffects: "स्थिर प्रभाव",
          randomEffects: "यादृच्छिक प्रभाव",
          bayesian: "बेयज़ियन",
        },
        evidenceSources: {
          cohortMethod: "समूह विधि",
          selfControlledCaseSeries: "स्व-नियंत्रित केस श्रृंखला",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "समूह जनरेटर",
        description:
          "परिभाषाओं से समूह बनाता है। सभी अध्ययन प्रकारों के लिए आवश्यक है।",
      },
      cohortMethod: {
        label: "समूह विधि",
        description:
          "तुलनात्मक समूह डिजाइन का उपयोग करके जनसंख्या-स्तरीय प्रभाव का अनुमान लगाता है।",
      },
      patientLevelPrediction: {
        label: "रोगी-स्तरीय पूर्वानुमान",
        description:
          "ML का उपयोग करके रोगी-स्तर के परिणामों के लिए पूर्वानुमान मॉडल बनाता है।",
      },
      selfControlledCaseSeries: {
        label: "स्व-नियंत्रित केस श्रृंखला",
        description:
          "SCCS डिजाइन का उपयोग करके घटना दर अनुपात का अनुमान लगाता है।",
      },
      cohortDiagnostics: {
        label: "समूह निदान",
        description:
          "फेनोटाइप एल्गोरिद्म का मूल्यांकन करता है और समूहों का चरित्रांकन करता है।",
      },
      characterization: {
        label: "चरित्रांकन",
        description:
          "लक्ष्य और तुलनाकार समूहों में आधारभूत विशेषताओं की गणना करता है।",
      },
      cohortIncidence: {
        label: "समूह घटना",
        description: "लक्ष्य आबादी में परिणामों की घटना दर की गणना करता है।",
      },
      evidenceSynthesis: {
        label: "साक्ष्य संश्लेषण",
        description:
          "स्थिर/यादृच्छिक प्रभाव मॉडल का उपयोग करके डेटा स्रोतों में मेटा-विश्लेषण करता है।",
      },
    },
  },
});

const arStrategus: MessageTree = mergeMessageTrees(enStrategus, {
  strategus: {
    common: {
      added: "تمت الإضافة",
      auto: "تلقائي",
      back: "رجوع",
      comparator: "المقارن",
      cohorts: "المجموعات",
      description: "الوصف",
      issues: "المشكلات",
      modules: "الوحدات",
      next: "التالي",
      noneConfigured: "لا شيء مكوّن",
      outcome: "النتيجة",
      required: "مطلوب",
      source: "المصدر",
      status: "الحالة",
      target: "الهدف",
      warnings: "تحذيرات",
    },
    page: {
      header: {
        title: "حزم الدراسات",
        subtitle: "أنشئ ونفّذ حزم دراسات OHDSI متعددة التحليلات في Strategus",
        importJson: "استيراد JSON",
        exportJson: "تصدير JSON",
      },
      steps: {
        studyInfo: "معلومات الدراسة",
        selectModules: "اختيار الوحدات",
        sharedCohorts: "المجموعات المشتركة",
        moduleSettings: "إعدادات الوحدات",
        jsonPreview: "معاينة JSON",
        reviewValidate: "المراجعة والتحقق",
        execute: "تنفيذ",
      },
      studyInfo: {
        title: "معلومات الدراسة",
        intro: "سمِّ حزمة الدراسة وقدّم وصفا اختياريا.",
        studyName: "اسم الدراسة",
        description: "الوصف",
        studyNamePlaceholder: "مثال: دراسة خطر فشل القلب SGLT2i مقابل DPP4i",
        descriptionPlaceholder:
          "صف بإيجاز أهداف الدراسة والفئة السكانية والنتائج المتوقعة...",
        info: "ينفذ Strategus حزم دراسات OHDSI متعددة التحليلات عبر مصدر بيانات CDM واحد أو أكثر. تعمل كل وحدة تحليل بشكل مستقل وتكتب النتائج إلى دليل الإخراج المكوّن.",
      },
      selectModules: {
        loading: "جار تحميل الوحدات المتاحة...",
        title: "اختيار وحدات التحليل",
        intro:
          "اختر وحدات تحليل OHDSI التي تريد تضمينها. CohortGenerator مطلوب ومضمن دائما.",
        selectedSummary_one:
          "{{count}} وحدة محددة (بما في ذلك CohortGenerator)",
        selectedSummary_other:
          "{{count}} وحدات محددة (بما في ذلك CohortGenerator)",
      },
      sharedCohorts: {
        title: "تعريفات المجموعات المشتركة",
        intro:
          "أضف مجموعات الهدف والمقارن والنتيجة المشتركة عبر جميع وحدات التحليل.",
        addCohort: "إضافة مجموعة",
        searchPlaceholder: "ابحث في تعريفات المجموعات...",
        loading: "جار تحميل المجموعات...",
        noneFound: "لم يتم العثور على تعريفات مجموعات.",
        empty:
          "لم تتم إضافة أي مجموعات بعد. تتطلب معظم وحدات التحليل مجموعة هدف واحدة على الأقل.",
        roles: {
          target: "الهدف",
          comparator: "المقارن",
          outcome: "النتيجة",
        },
      },
      review: {
        title: "ملخص حزمة الدراسة",
        studyName: "اسم الدراسة",
        description: "الوصف",
        modules: "الوحدات",
        cohorts: "المجموعات",
        validateTitle: "التحقق من المواصفة",
        validateIntro:
          "تحقق من مواصفة التحليل بحثا عن مشكلات تكوين الوحدات قبل التنفيذ.",
        runValidation: "تشغيل التحقق",
        validationPassed: "نجح التحقق",
        validationFailed: "فشل التحقق",
        validationFailedWithMessage: "فشل التحقق: {{message}}",
        validationRequestFailed: "فشل طلب التحقق",
        severity: {
          error: "خطأ",
          warning: "تحذير",
        },
      },
      execute: {
        title: "تنفيذ حزمة الدراسة",
        intro:
          'اختر مصدر بيانات CDM ونفّذ "{{studyName}}" عبر جميع الوحدات المكوّنة.',
        targetDataSource: "مصدر البيانات الهدف",
        loadingSources: "جار تحميل المصادر...",
        selectSource: "اختر مصدرا",
        executeStudyPackage: "تنفيذ حزمة الدراسة",
        executing: "جار التنفيذ...",
        runningTitle: "حزمة الدراسة قيد التشغيل...",
        runningIntro:
          "يقوم Strategus بتنسيق تنفيذ الوحدات. قد يستغرق ذلك عدة دقائق بحسب حجم مجموعة البيانات وعدد الوحدات.",
        executionFailed: "فشل التنفيذ: {{message}}",
        executionRequestFailed: "فشل طلب التنفيذ",
        executionComplete: "اكتمل التنفيذ",
        outputDirectory: "دليل الإخراج",
        modulesExecuted: "الوحدات المنفذة",
        resultStats: {
          status: "الحالة",
          modulesRun: "الوحدات المشغلة",
          resultFiles: "ملفات النتائج",
        },
        statusLabels: {
          completed: "مكتمل",
          running: "قيد التشغيل",
          failed: "فشل",
        },
      },
    },
    jsonEditor: {
      title: "معاينة مواصفة JSON",
      intro:
        "راجع مواصفة التحليل المُنشأة. عدّلها مباشرة أو طبّق التغييرات أدناه.",
      copied: "تم النسخ",
      copyToClipboard: "نسخ إلى الحافظة",
      resetToGenerated: "إعادة التعيين إلى النسخة المُنشأة",
      lineCount_one: "{{count}} سطر",
      lineCount_other: "{{count}} أسطر",
      validJson: "JSON صالح",
      invalidJson: "JSON غير صالح",
      applyChanges: "تطبيق التغييرات",
    },
    moduleSettings: {
      title: "إعدادات الوحدات",
      intro: "اضبط المعلمات لكل وحدة. انقر على وحدة لتوسيع إعداداتها.",
      unknownModule: "وحدة غير معروفة: {{moduleName}}",
      autoBadge: "تلقائي",
      noConfigurationNeeded:
        "لا حاجة إلى إعدادات. يقوم CohortGenerator بإنشاء المجموعات تلقائيا من تعريفات المجموعات المشتركة.",
      noCohorts: "لا تتوفر مجموعات. أضف مجموعات في خطوة المجموعات المشتركة.",
      noRoleCohorts:
        "لا تتوفر مجموعات {{role}}. أضف مجموعات في خطوة المجموعات المشتركة.",
      sections: {
        cohortAssignment: "إسناد المجموعات",
        parameters: "المعلمات",
        covariateSettings: "إعدادات المتغيرات المصاحبة",
        modelConfiguration: "إعدادات النموذج",
        timeAtRisk: "فترة التعرض للخطر",
        trainingParameters: "معلمات التدريب",
        eraCovariateSettings: "إعدادات متغيرات الفترات",
        diagnosticsOptions: "خيارات التشخيص",
        synthesisConfiguration: "إعدادات توليف الأدلة",
      },
      fields: {
        targetCohorts: "مجموعات الهدف",
        comparatorCohorts: "مجموعات المقارنة",
        outcomeCohorts: "مجموعات النتيجة",
        exposureCohorts: "مجموعات التعرض",
        washoutPeriod: "فترة الغسل (بالأيام)",
        maxCohortSize: "الحد الأقصى لحجم المجموعة (0 = غير محدود)",
        demographics: "التركيبة السكانية",
        conditionOccurrence: "حدوث الحالة",
        drugExposure: "التعرض للدواء",
        procedureOccurrence: "حدوث الإجراء",
        measurement: "القياس",
        modelType: "نوع النموذج",
        windowStart: "بداية النافذة (بالأيام)",
        windowEnd: "نهاية النافذة (بالأيام)",
        minCohortSize: "الحد الأدنى لحجم المجموعة",
        splitSeed: "بذرة التقسيم",
        testFraction: "نسبة الاختبار",
        includeEraOverlap: "تضمين تداخل الفترات",
        firstOccurrenceOnly: "الحدوث الأول فقط",
        inclusionStatistics: "إحصاءات الإدراج",
        incidenceRate: "معدل الحدوث",
        timeSeries: "سلسلة زمنية",
        breakdownIndexEvents: "تفصيل أحداث المؤشر",
        orphanConcepts: "المفاهيم اليتيمة",
        minCellCount: "الحد الأدنى لعدد الخلايا",
        minPriorObservation: "الحد الأدنى للملاحظة السابقة (بالأيام)",
        dechallengeStopInterval: "فاصل إيقاف سحب العلاج",
        dechallengeEvalWindow: "نافذة تقييم سحب العلاج",
        start: "البداية (بالأيام)",
        end: "النهاية (بالأيام)",
        cleanWindow: "نافذة التنقية (بالأيام)",
        method: "الطريقة",
        evidenceSourceModule: "وحدة مصدر الأدلة",
      },
      options: {
        modelTypes: {
          lassoLogistic: "انحدار لوجستي Lasso",
          gradientBoosting: "التعزيز التدريجي",
          randomForest: "الغابة العشوائية",
          deepLearning: "التعلم العميق",
        },
        synthesisMethods: {
          fixedEffects: "تأثيرات ثابتة",
          randomEffects: "تأثيرات عشوائية",
          bayesian: "بايزي",
        },
        evidenceSources: {
          cohortMethod: "طريقة المجموعة",
          selfControlledCaseSeries: "سلسلة الحالات ذاتية الضبط",
        },
      },
    },
    moduleMeta: {
      cohortGenerator: {
        label: "مولد المجموعات",
        description: "ينشئ المجموعات من التعريفات. وهو مطلوب لجميع أنواع الدراسات.",
      },
      cohortMethod: {
        label: "طريقة المجموعة",
        description: "تقدير الأثر على مستوى السكان باستخدام تصميم مجموعة مقارنة.",
      },
      patientLevelPrediction: {
        label: "التنبؤ على مستوى المريض",
        description:
          "يبني نماذج تنبؤية لنتائج المرضى على المستوى الفردي باستخدام ML.",
      },
      selfControlledCaseSeries: {
        label: "سلسلة الحالات ذاتية الضبط",
        description: "يقدّر نسب معدلات الحدوث باستخدام تصميم SCCS.",
      },
      cohortDiagnostics: {
        label: "تشخيصات المجموعة",
        description: "يقيّم خوارزميات الأنماط الظاهرية ويصف خصائص المجموعات.",
      },
      characterization: {
        label: "التوصيف",
        description: "يحسب الخصائص الأساسية عبر مجموعات الهدف والمقارنة.",
      },
      cohortIncidence: {
        label: "حدوث المجموعة",
        description: "يحسب معدلات حدوث النتائج في الفئات السكانية المستهدفة.",
      },
      evidenceSynthesis: {
        label: "توليف الأدلة",
        description:
          "يجري تحليلا تجميعيا عبر مصادر البيانات باستخدام نماذج التأثيرات الثابتة أو العشوائية.",
      },
    },
  },
});

export const strategusResources: Record<string, MessageTree> = {
  "en-US": enStrategus,
  "es-ES": esStrategus,
  "fr-FR": frStrategus,
  "de-DE": deStrategus,
  "pt-BR": ptStrategus,
  "fi-FI": mergeMessageTrees(enStrategus, {
    strategus: {
      common: {
        added: "Lisätty",
        auto: "Automaattinen",
        back: "Takaisin",
        comparator: "Vertailija",
        cohorts: "Kohortit",
        description: "Kuvaus",
        issues: "Ongelmat",
        modules: "Moduulit",
        next: "Seuraavaksi",
        noneConfigured: "Mitään ei ole määritetty",
        outcome: "Tulokset",
        required: "Pakollinen",
        source: "Lähde",
        status: "Tila",
        target: "Kohde",
        warnings: "Varoitukset",
      },
      page: {
        header: {
          title: "Opintopaketit",
          subtitle:
            "Rakenna ja toteuta Strategus-monianalyysin OHDSI-tutkimuspaketteja",
          importJson: "Tuo JSON",
          exportJson: "Vie JSON",
        },
        steps: {
          studyInfo: "Opintotiedot",
          selectModules: "Valitse Moduulit",
          sharedCohorts: "Jaetut kohortit",
          moduleSettings: "Moduulin asetukset",
          jsonPreview: "JSON-esikatselu",
          reviewValidate: "Tarkista & Vahvista",
          execute: "Suorittaa",
        },
        studyInfo: {
          title: "Tutkimustiedot",
          intro: "Nimeä opintopakettisi ja anna valinnainen kuvaus.",
          studyName: "Tutkimuksen nimi",
          description: "Kuvaus",
          studyNamePlaceholder:
            "esim. SGLT2i vs DPP4i sydämen vajaatoiminnan riskitutkimus",
          descriptionPlaceholder:
            "Kuvaile lyhyesti tutkimuksen tavoitteita, väestöä ja odotettuja tuloksia...",
          info: "Strategus suorittaa usean analyysin OHDSI-tutkimuspaketteja yhdessä tai useammassa CDM-tietolähteessä.Jokainen analyysimoduuli toimii itsenäisesti ja kirjoittaa tulokset määritettyyn tuloshakemistoon.",
        },
        selectModules: {
          loading: "Ladataan käytettävissä olevia moduuleja...",
          title: "Valitse Analyysimoduulit",
          intro:
            "Valitse sisällytettävät OHDSI-analyysimoduulit.CohortGenerator vaaditaan ja aina mukana.",
        },
        sharedCohorts: {
          title: "Jaetut kohortin määritelmät",
          intro:
            "Lisää kohde-, vertailu- ja tuloskohortit, jotka jaetaan kaikille analyysimoduuleille.",
          addCohort: "Lisää kohortti",
          loading: "Ladataan kohortteja...",
          noneFound: "Kohorttimääritelmiä ei löytynyt.",
          empty:
            "Kohortteja ei ole vielä lisätty.Useimmat analyysimoduulit vaativat vähintään yhden kohdekohortin.",
          roles: {
            target: "Kohde",
            comparator: "Vertailija",
            outcome: "Tulokset",
          },
        },
        review: {
          title: "Tutkimuspaketin yhteenveto",
          studyName: "Tutkimuksen nimi",
          description: "Kuvaus",
          modules: "Moduulit",
          cohorts: "Kohortit",
          validateTitle: "Vahvista määritys",
          validateIntro:
            "Tarkista moduulin kokoonpanoongelmien analyysitiedot ennen suorittamista.",
          runValidation: "Suorita vahvistus",
          validationPassed: "Validointi meni läpi",
          validationFailed: "Vahvistus epäonnistui",
          validationRequestFailed: "Vahvistuspyyntö epäonnistui",
          severity: {
            error: "Virhe",
            warning: "Varoitus",
          },
        },
        execute: {
          title: "Suorita opintopaketti",
          targetDataSource: "Kohdetietolähde",
          loadingSources: "Ladataan lähteitä...",
          selectSource: "Valitse lähde",
          executeStudyPackage: "Suorita opintopaketti",
          executing: "Suoritetaan...",
          runningTitle: "Opintopaketti käynnissä...",
          runningIntro:
            "Strategus ohjaa moduulin suorittamista.Tämä voi kestää useita minuutteja tietojoukon koosta ja moduulien lukumäärästä riippuen.",
          executionRequestFailed: "Suorituspyyntö epäonnistui",
          executionComplete: "Suoritus valmis",
          outputDirectory: "Tulostushakemisto",
          modulesExecuted: "Moduulit suoritettu",
          resultStats: {
            modulesRun: "Moduulit Suorita",
            resultFiles: "Tulostiedostot",
            status: "Tila",
          },
          statusLabels: {
            completed: "Valmis",
            running: "Juoksemassa",
            failed: "Epäonnistui",
          },
        },
      },
      jsonEditor: {
        title: "JSON-määritysten esikatselu",
        intro:
          "Tarkista luotu analyysispesifikaatio.Muokkaa suoraan tai ota muutokset käyttöön alla.",
        copied: "Kopioitu",
        copyToClipboard: "Kopioi leikepöydälle",
        resetToGenerated: "Palauta Luotu",
        validJson: "Kelvollinen JSON",
        invalidJson: "Virheellinen JSON",
        applyChanges: "Ota muutokset käyttöön",
      },
      moduleSettings: {
        title: "Moduulin asetukset",
        intro:
          "Määritä moduulikohtaiset parametrit.Napsauta moduulia laajentaaksesi sen asetuksia.",
        autoBadge: "Automaattinen",
        noConfigurationNeeded:
          "Määritystä ei tarvita.CohortGenerator rakentaa automaattisesti kohortteja jaetuista kohorttimäärittelyistä.",
        noCohorts:
          "Kohortteja ei ole saatavilla.Lisää kohortteja Jaetut kohortit -vaiheessa.",
        sections: {
          cohortAssignment: "Kohorttitehtävä",
          parameters: "Parametrit",
          covariateSettings: "Kovariaattiasetukset",
          modelConfiguration: "Mallin kokoonpano",
          timeAtRisk: "Aika vaarassa",
          trainingParameters: "Harjoitteluparametrit",
          eraCovariateSettings: "Aikakauden kovariaattiasetukset",
          diagnosticsOptions: "Diagnostiikkavaihtoehdot",
          synthesisConfiguration: "Synteesikokoonpano",
        },
        fields: {
          splitSeed: "Jaon siemen",
          targetCohorts: "Kohortit",
          comparatorCohorts: "Vertailukohortit",
          outcomeCohorts: "Tuloskohortit",
          exposureCohorts: "Altistumiskohortit",
          washoutPeriod: "Huuhtelujakso (päivää)",
          maxCohortSize: "Kohortin enimmäiskoko (0 = rajoittamaton)",
          demographics: "Väestötiedot",
          conditionOccurrence: "Tilan esiintyminen",
          drugExposure: "Huumeiden altistuminen",
          procedureOccurrence: "Toimenpide Tapahtuma",
          measurement: "Mittaus",
          modelType: "Mallin tyyppi",
          windowStart: "Ikkunan aloitus (päivää)",
          windowEnd: "Ikkunan loppu (päivää)",
          minCohortSize: "Vähimmäiskohortin koko",
          testFraction: "Testifraktio",
          includeEraOverlap: "Sisällytä aikakauden päällekkäisyys",
          firstOccurrenceOnly: "Vain ensimmäinen esiintyminen",
          inclusionStatistics: "Inkluusiotilastot",
          incidenceRate: "Ilmaantuvuusprosentti",
          timeSeries: "Aikasarja",
          breakdownIndexEvents: "Jaotteluindeksitapahtumat",
          orphanConcepts: "Orpokonseptit",
          minCellCount: "Minimaalinen solumäärä",
          minPriorObservation: "Minimi ennakkotarkkailu (päiviä)",
          dechallengeStopInterval: "Poista haaste pysäytysväli",
          dechallengeEvalWindow: "Dechallenge Eval -ikkuna",
          start: "Aloitus (päivää)",
          end: "Loppu (päivää)",
          cleanWindow: "Puhdas ikkuna (päivää)",
          method: "Menetelmä",
          evidenceSourceModule: "Todisteiden lähdemoduuli",
        },
        options: {
          modelTypes: {
            gradientBoosting: "Gradientin tehostaminen",
            randomForest: "Satunnainen metsä",
            deepLearning: "Syväoppiminen",
          },
          synthesisMethods: {
            fixedEffects: "Kiinteät tehosteet",
            randomEffects: "Satunnaiset tehosteet",
            bayesian: "Bayesin",
          },
          evidenceSources: {
            cohortMethod: "Kohorttimenetelmä",
            selfControlledCaseSeries: "Itseohjautuva kotelosarja",
          },
        },
      },
      moduleMeta: {
        cohortGenerator: {
          label: "Kohorttigeneraattori",
          description:
            "Luo kohortteja määritelmistä.Vaaditaan kaikille opintotyypeille.",
        },
        cohortMethod: {
          label: "Kohorttimenetelmä",
          description:
            "Väestötason vaikutusten arviointi käyttämällä vertailevaa kohorttisuunnittelua.",
        },
        patientLevelPrediction: {
          label: "Potilastason ennuste",
          description:
            "Rakentaa ennustemalleja potilastason tuloksille ML:n avulla.",
        },
        selfControlledCaseSeries: {
          label: "Itseohjautuva kotelosarja",
          description:
            "Arvioi ilmaantuvuussuhteet käyttämällä SCCS-suunnittelua.",
        },
        cohortDiagnostics: {
          label: "Kohorttidiagnostiikka",
          description: "Arvioi fenotyyppialgoritmit ja luonnehtii kohortteja.",
        },
        characterization: {
          label: "Karakterisointi",
          description:
            "Laskee lähtötason ominaisuudet kohde- ja vertailukohorttien kesken.",
        },
        cohortIncidence: {
          label: "Kohortin ilmaantuvuus",
          description: "Laskee tulosten esiintyvyysasteet kohdepopulaatioissa.",
        },
        evidenceSynthesis: {
          label: "Todisteiden synteesi",
          description:
            "Meta-analyysi tietolähteistä käyttämällä kiinteitä / satunnaisia ​​​​vaikutusmalleja.",
        },
      },
    },
  }),
  "ja-JP": mergeMessageTrees(enStrategus, {
    strategus: {
      common: {
        added: "追加した",
        auto: "自動",
        back: "戻る",
        comparator: "コンパレータ",
        cohorts: "コホート",
        description: "説明",
        issues: "問題",
        modules: "モジュール",
        next: "次",
        noneConfigured: "何も設定されていません",
        outcome: "結果",
        required: "必須",
        source: "ソース",
        status: "状態",
        target: "ターゲット",
        warnings: "警告",
      },
      page: {
        header: {
          title: "学習パッケージ",
          subtitle:
            "Strategus マルチ分析 OHDSI スタディ パッケージを構築して実行する",
          importJson: "JSONをインポートする",
          exportJson: "JSONのエクスポート",
        },
        steps: {
          studyInfo: "研究情報",
          selectModules: "モジュールの選択",
          sharedCohorts: "共有コホート",
          moduleSettings: "モジュール設定",
          jsonPreview: "JSON プレビュー",
          reviewValidate: "レビューと検証",
          execute: "実行する",
        },
        studyInfo: {
          title: "研究情報",
          intro: "学習パッケージに名前を付け、オプションで説明を入力します。",
          studyName: "研究名",
          description: "説明",
          studyNamePlaceholder: "例：SGLT2i 対 DPP4i 心不全リスク研究",
          descriptionPlaceholder:
            "研究の目的、母集団、期待される結果を簡単に説明します...",
          info: "Strategus は、1 つ以上の CDM データ ソースにわたってマルチ分析 OHDSI スタディ パッケージを実行します。各分析モジュールは独立して実行され、構成された出力ディレクトリに結果を書き込みます。",
        },
        selectModules: {
          loading: "利用可能なモジュールをロードしています...",
          title: "分析モジュールの選択",
          intro:
            "どの OHDSI 解析モジュールを含めるかを選択します。CohortGenerator は必須であり、常に含まれます。",
        },
        sharedCohorts: {
          title: "共有コホートの定義",
          intro:
            "すべての分析モジュールで共有されるターゲット、比較対象、および結果コホートを追加します。",
          addCohort: "コホートの追加",
          loading: "コホートを読み込んでいます...",
          noneFound: "コホート定義が見つかりません。",
          empty:
            "まだコホートは追加されていません。ほとんどの分析モジュールには、少なくとも 1 つのターゲット コホートが必要です。",
          roles: {
            target: "ターゲット",
            comparator: "コンパレータ",
            outcome: "結果",
          },
        },
        review: {
          title: "学習パッケージの概要",
          studyName: "研究名",
          description: "説明",
          modules: "モジュール",
          cohorts: "コホート",
          validateTitle: "仕様の検証",
          validateIntro:
            "実行する前に、モジュール構成の問題がないか解析仕様を確認してください。",
          runValidation: "検証の実行",
          validationPassed: "検証に合格しました",
          validationFailed: "検証に失敗しました",
          validationRequestFailed: "検証リクエストが失敗しました",
          severity: {
            error: "エラー",
            warning: "警告",
          },
        },
        execute: {
          title: "スタディパッケージの実行",
          targetDataSource: "ターゲットデータソース",
          loadingSources: "ソースを読み込んでいます...",
          selectSource: "ソースを選択してください",
          executeStudyPackage: "スタディパッケージの実行",
          executing: "実行中...",
          runningTitle: "学習パッケージが実行中です...",
          runningIntro:
            "Strategus はモジュールの実行を調整しています。データセットのサイズとモジュールの数によっては、これには数分かかる場合があります。",
          executionRequestFailed: "実行リクエストが失敗しました",
          executionComplete: "実行完了",
          outputDirectory: "出力ディレクトリ",
          modulesExecuted: "実行されるモジュール",
          resultStats: {
            status: "状態",
            modulesRun: "モジュールの実行",
            resultFiles: "結果ファイル",
          },
          statusLabels: {
            completed: "完了しました",
            running: "ランニング",
            failed: "失敗した",
          },
        },
      },
      jsonEditor: {
        title: "JSON仕様プレビュー",
        intro:
          "生成された分析仕様を確認します。直接編集するか、以下の変更を適用します。",
        copied: "コピーされました",
        copyToClipboard: "クリップボードにコピー",
        resetToGenerated: "生成済みにリセット",
        validJson: "有効なJSON",
        invalidJson: "無効な JSON",
        applyChanges: "変更を適用する",
      },
      moduleSettings: {
        title: "モジュール設定",
        intro:
          "モジュールごとのパラメータを設定します。モジュールをクリックして設定を展開します。",
        autoBadge: "自動",
        noConfigurationNeeded:
          "設定は必要ありません。CohortGenerator は、共有コホート定義からコホートを自動的に構築します。",
        noCohorts:
          "利用可能なコホートはありません。「共有コホート」ステップでコホートを追加します。",
        sections: {
          cohortAssignment: "コホートの割り当て",
          parameters: "パラメータ",
          covariateSettings: "共変量の設定",
          modelConfiguration: "モデル構成",
          timeAtRisk: "危険にさらされている時間",
          trainingParameters: "トレーニングパラメータ",
          eraCovariateSettings: "時代の共変量の設定",
          diagnosticsOptions: "診断オプション",
          synthesisConfiguration: "合成構成",
        },
        fields: {
          targetCohorts: "対象コホート",
          comparatorCohorts: "比較対象コホート",
          outcomeCohorts: "結果コホート",
          exposureCohorts: "暴露コホート",
          washoutPeriod: "ウォッシュアウト期間 (日)",
          maxCohortSize: "最大コホート サイズ (0 = 無制限)",
          demographics: "人口動態",
          conditionOccurrence: "条件の発生",
          drugExposure: "薬物曝露",
          procedureOccurrence: "手順の発生",
          measurement: "測定",
          modelType: "モデルタイプ",
          windowStart: "開始期間 (日)",
          windowEnd: "終了期間 (日)",
          minCohortSize: "最小コホートサイズ",
          splitSeed: "スプリットシード",
          testFraction: "試験分画",
          includeEraOverlap: "時代の重複を含める",
          firstOccurrenceOnly: "最初の出現のみ",
          inclusionStatistics: "包含統計",
          incidenceRate: "発生率",
          timeSeries: "時系列",
          breakdownIndexEvents: "内訳インデックスイベント",
          orphanConcepts: "孤立した概念",
          minCellCount: "最小セル数",
          minPriorObservation: "最小事前観察 (日)",
          dechallengeStopInterval: "チャレンジ解除停止間隔",
          dechallengeEvalWindow: "評価ウィンドウのチャレンジを解除する",
          start: "開始（日）",
          end: "終了（日）",
          cleanWindow: "窓の掃除（日）",
          method: "方法",
          evidenceSourceModule: "証拠ソースモジュール",
        },
        options: {
          modelTypes: {
            gradientBoosting: "勾配ブースティング",
            randomForest: "ランダムフォレスト",
            deepLearning: "ディープラーニング",
          },
          synthesisMethods: {
            fixedEffects: "固定効果",
            randomEffects: "ランダム効果",
            bayesian: "ベイジアン",
          },
          evidenceSources: {
            cohortMethod: "コホート法",
            selfControlledCaseSeries: "自主規制事例シリーズ",
          },
        },
      },
      moduleMeta: {
        cohortGenerator: {
          label: "コホートジェネレーター",
          description:
            "定義からコホートを生成します。すべての学習タイプに必須です。",
        },
        cohortMethod: {
          label: "コホート法",
          description: "比較コホート設計を使用した集団レベルの効果推定。",
        },
        patientLevelPrediction: {
          label: "患者レベルの予測",
          description:
            "ML を使用して患者レベルの転帰の予測モデルを構築します。",
        },
        selfControlledCaseSeries: {
          label: "自主規制事例シリーズ",
          description: "SCCS 設計を使用して発生率比を推定します。",
        },
        cohortDiagnostics: {
          label: "コホート診断",
          description: "表現型アルゴリズムを評価し、コホートを特徴付けます。",
        },
        characterization: {
          label: "特性評価",
          description:
            "ターゲットおよび比較対象コホート全体のベースライン特性を計算します。",
        },
        cohortIncidence: {
          label: "コホートの発生率",
          description: "対象集団におけるアウトカムの発生率を計算します。",
        },
        evidenceSynthesis: {
          label: "証拠の総合",
          description:
            "固定/ランダム効果モデルを使用したデータソースにわたるメタ分析。",
        },
      },
    },
  }),
  "zh-Hans": mergeMessageTrees(enStrategus, {
    strategus: {
      common: {
        added: "额外",
        auto: "汽车",
        back: "后退",
        comparator: "比较器",
        cohorts: "队列",
        description: "描述",
        issues: "问题",
        modules: "模块",
        next: "下一个",
        noneConfigured: "未配置",
        outcome: "结果",
        required: "必需的",
        source: "来源",
        status: "地位",
        target: "目标",
        warnings: "警告",
      },
      page: {
        header: {
          title: "学习套餐",
          subtitle: "构建并执行 Strategus 多重分析 OHDSI 研究包",
          importJson: "导入 JSON",
          exportJson: "导出 JSON",
        },
        steps: {
          studyInfo: "学习信息",
          selectModules: "选择模块",
          sharedCohorts: "共享群组",
          moduleSettings: "模块设置",
          jsonPreview: "JSON 预览",
          reviewValidate: "审查和验证",
          execute: "执行",
        },
        studyInfo: {
          title: "学习资讯",
          intro: "为您的学习包命名并提供可选的描述。",
          studyName: "研究名称",
          description: "描述",
          studyNamePlaceholder: "例如，SGLT2i 与 DPP4i 心力衰竭风险研究",
          descriptionPlaceholder: "简要描述研究目标、人群和预期结果......",
          info: "Strategus 跨一个或多个 CDM 数据源执行多重分析 OHDSI 研究包。每个分析模块独立运行并将结果写入配置的输出目录。",
        },
        selectModules: {
          loading: "正在加载可用模块...",
          title: "选择分析模块",
          intro:
            "选择要包含的 OHDSI 分析模块。CohortGenerator 是必需的并且始终包含在内。",
        },
        sharedCohorts: {
          title: "共享群组定义",
          intro: "添加在所有分析模块之间共享的目标、比较器和结果队列。",
          addCohort: "添加群组",
          loading: "正在加载群组...",
          noneFound: "未找到群组定义。",
          empty: "尚未添加群组。大多数分析模块至少需要一个目标群体。",
          roles: {
            target: "目标",
            comparator: "比较器",
            outcome: "结果",
          },
        },
        review: {
          title: "学习包摘要",
          studyName: "研究名称",
          description: "描述",
          modules: "模块",
          cohorts: "队列",
          validateTitle: "验证规格",
          validateIntro: "在执行之前检查模块配置问题的分析规范。",
          runValidation: "运行验证",
          validationPassed: "验证通过",
          validationFailed: "验证失败",
          validationRequestFailed: "验证请求失败",
          severity: {
            error: "错误",
            warning: "警告",
          },
        },
        execute: {
          title: "执行学习包",
          targetDataSource: "目标数据源",
          loadingSources: "正在加载源...",
          selectSource: "选择来源",
          executeStudyPackage: "执行学习包",
          executing: "正在执行...",
          runningTitle: "学习包正在运行...",
          runningIntro:
            "Strategus 正在编排模块执行。这可能需要几分钟，具体取决于数据集大小和模块数量。",
          executionRequestFailed: "执行请求失败",
          executionComplete: "执行完成",
          outputDirectory: "输出目录",
          modulesExecuted: "执行的模块",
          resultStats: {
            status: "地位",
            modulesRun: "模块运行",
            resultFiles: "结果文件",
          },
          statusLabels: {
            completed: "完全的",
            running: "跑步",
            failed: "失败的",
          },
        },
      },
      jsonEditor: {
        title: "JSON 规范预览",
        intro: "查看生成的分析规范。直接编辑或应用下面的更改。",
        copied: "已复制",
        copyToClipboard: "复制到剪贴板",
        resetToGenerated: "重置为生成",
        validJson: "有效的 JSON",
        invalidJson: "无效的 JSON",
        applyChanges: "应用更改",
      },
      moduleSettings: {
        title: "模块设置",
        intro: "配置每个模块的参数。单击模块可展开其设置。",
        autoBadge: "汽车",
        noConfigurationNeeded:
          "无需配置。CohortGenerator 根据共享群组定义自动构建群组。",
        noCohorts: "没有可用的群组。在“共享群组”步骤中添加群组。",
        sections: {
          cohortAssignment: "队列分配",
          parameters: "参数",
          covariateSettings: "协变量设置",
          modelConfiguration: "型号配置",
          timeAtRisk: "风险时间",
          trainingParameters: "训练参数",
          eraCovariateSettings: "时代协变量设置",
          diagnosticsOptions: "诊断选项",
          synthesisConfiguration: "合成配置",
        },
        fields: {
          targetCohorts: "目标群体",
          comparatorCohorts: "比较队列",
          outcomeCohorts: "结果队列",
          exposureCohorts: "暴露队列",
          washoutPeriod: "清洗期（天）",
          maxCohortSize: "最大队列大小（0 = 无限制）",
          demographics: "人口统计",
          conditionOccurrence: "条件发生",
          drugExposure: "药物暴露",
          procedureOccurrence: "程序发生情况",
          measurement: "测量",
          modelType: "型号类型",
          windowStart: "窗口开始（天）",
          windowEnd: "窗口结束（天）",
          minCohortSize: "最小队列规模",
          splitSeed: "分裂种子",
          testFraction: "测试分数",
          includeEraOverlap: "包括时代重叠",
          firstOccurrenceOnly: "仅首次出现",
          inclusionStatistics: "纳入统计",
          incidenceRate: "发病率",
          timeSeries: "时间序列",
          breakdownIndexEvents: "细分指数事件",
          orphanConcepts: "孤儿概念",
          minCellCount: "最小细胞计数",
          minPriorObservation: "最短先前观察时间（天）",
          dechallengeStopInterval: "解除挑战停止间隔",
          dechallengeEvalWindow: "消除挑战评估窗口",
          start: "开始（天）",
          end: "结束（天）",
          cleanWindow: "清洁窗户（天）",
          method: "方法",
          evidenceSourceModule: "证据来源模块",
        },
        options: {
          modelTypes: {
            gradientBoosting: "梯度提升",
            randomForest: "随机森林",
            deepLearning: "深度学习",
          },
          synthesisMethods: {
            fixedEffects: "固定效应",
            randomEffects: "随机效应",
            bayesian: "贝叶斯",
          },
          evidenceSources: {
            cohortMethod: "队列法",
            selfControlledCaseSeries: "自控箱系列",
          },
        },
      },
      moduleMeta: {
        cohortGenerator: {
          label: "同类群组生成器",
          description: "根据定义生成群组。所有研究类型都需要。",
        },
        cohortMethod: {
          label: "队列法",
          description: "使用比较队列设计进行人群水平效应估计。",
        },
        patientLevelPrediction: {
          label: "患者水平预测",
          description: "使用机器学习构建患者级别结果的预测模型。",
        },
        selfControlledCaseSeries: {
          label: "自控箱系列",
          description: "使用 SCCS 设计估计发病率比率。",
        },
        cohortDiagnostics: {
          label: "队列诊断",
          description: "评估表型算法并描述群体特征。",
        },
        characterization: {
          label: "表征",
          description: "计算目标群体和比较群体的基线特征。",
        },
        cohortIncidence: {
          label: "群组发生率",
          description: "计算目标人群中结果的发生率。",
        },
        evidenceSynthesis: {
          label: "证据综合",
          description: "使用固定/随机效应模型跨数据源进行荟萃分析。",
        },
      },
    },
  }),
  "ko-KR": koStrategus,
  "hi-IN": hiStrategus,
  ar: arStrategus,
  "en-XA": mergeMessageTrees(enStrategus, {}),
};
