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
        intro:
          "Name your study package and provide an optional description.",
        studyName: "Study Name",
        description: "Description",
        studyNamePlaceholder:
          "e.g., SGLT2i vs DPP4i Heart Failure Risk Study",
        descriptionPlaceholder:
          "Briefly describe the study objectives, population, and expected outcomes...",
        info:
          "Strategus executes multi-analysis OHDSI study packages across one or more CDM data sources. Each analysis module runs independently and writes results to the configured output directory.",
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
        description:
          "Estimates incidence rate ratios using SCCS design.",
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
        info:
          "Strategus execute des packages d'etude OHDSI multi-analyses sur une ou plusieurs sources CDM. Chaque module d'analyse s'execute independamment et ecrit ses resultats dans le repertoire de sortie configure.",
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
        info:
          "Strategus fuhrt OHDSI-Studienpakete mit mehreren Analysen uber eine oder mehrere CDM-Datenquellen aus. Jedes Analysemodul lauft unabhangig und schreibt Ergebnisse in das konfigurierte Ausgabeverzeichnis.",
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
        description:
          "Schatzt Inzidenzratenverhaltnisse mit dem SCCS-Design.",
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
        intro:
          "Nomeie seu pacote de estudo e forneca uma descricao opcional.",
        studyName: "Nome do estudo",
        description: "Descricao",
        studyNamePlaceholder:
          "ex.: Estudo de risco de insuficiencia cardiaca SGLT2i vs DPP4i",
        descriptionPlaceholder:
          "Descreva brevemente os objetivos do estudo, a populacao e os desfechos esperados...",
        info:
          "Strategus executa pacotes de estudo OHDSI multi-analise em uma ou mais fontes de dados CDM. Cada modulo de analise roda de forma independente e grava os resultados no diretorio de saida configurado.",
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
        description:
          "Avalia algoritmos de fenotipo e caracteriza coortes.",
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

export const strategusResources: Record<string, MessageTree> = {
  "en-US": enStrategus,
  "es-ES": mergeMessageTrees(enStrategus, {}),
  "fr-FR": frStrategus,
  "de-DE": deStrategus,
  "pt-BR": ptStrategus,
  "fi-FI": mergeMessageTrees(enStrategus, {}),
  "ja-JP": mergeMessageTrees(enStrategus, {}),
  "zh-Hans": mergeMessageTrees(enStrategus, {}),
  "ko-KR": mergeMessageTrees(enStrategus, {}),
  "hi-IN": mergeMessageTrees(enStrategus, {}),
  ar: mergeMessageTrees(enStrategus, {}),
  "en-XA": mergeMessageTrees(enStrategus, {}),
};
