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

const enSmallWorkbench: MessageTree = {
  studyAgent: {
    header: {
      title: "Study Designer",
      subtitle: "AI-assisted study design powered by OHDSI StudyAgent",
    },
    tabs: {
      intent: "Study Intent",
      search: "Phenotype Search",
      recommend: "Recommendations",
      lint: "Cohort Lint",
    },
    intent: {
      title: "Describe Your Study",
      description:
        "Enter a natural language description of your study. The AI will split it into target population and outcome, then recommend phenotypes from the OHDSI library.",
      placeholder:
        "e.g., Compare the risk of heart failure in patients newly prescribed SGLT2 inhibitors vs DPP-4 inhibitors among adults with type 2 diabetes...",
      analyze: "Analyze Study Intent",
      targetPopulation: "Target Population",
      outcome: "Outcome",
    },
    recommendations: {
      title: "Recommended Phenotypes",
      score: "Score: {{value}}",
      loading: "Finding phenotype recommendations...",
      promptPrefix: "Enter a study intent on the",
      promptSuffix: "tab to get AI-ranked phenotype recommendations.",
    },
    search: {
      title: "Search Phenotype Library",
      placeholder:
        "Search for phenotypes (e.g., type 2 diabetes, heart failure, COPD)...",
      submit: "Search",
      resultsFound_one: "{{count}} result found",
      resultsFound_other: "{{count}} results found",
      noneFound: "No phenotypes found. Try a different search term.",
    },
    lint: {
      title: "Lint Cohort Definition",
      description:
        "Paste a cohort definition JSON to check for design issues like missing washout periods, empty concept sets, and inverted time windows.",
      run: "Run Lint",
      noIssuesFound: "No issues found",
      issuesFound_one: "{{count}} issue found",
      issuesFound_other: "{{count}} issues found",
      failed: "Failed to lint: Invalid JSON or server error.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Phenotype Library",
      subtitle:
        "300+ curated OHDSI phenotype definitions - browse, filter, and import in one click",
      searchPlaceholder: "Search phenotypes by name or description...",
      allDomains: "All Domains",
      loading: "Loading...",
      clearFilters: "Clear filters",
      resultCount_one: "{{displayCount}} phenotype",
      resultCount_other: "{{displayCount}} phenotypes",
      matchingFilters: "matching filters",
    },
    detail: {
      description: "Description",
      logic: "Logic",
      noAdditionalDetails: "No additional details available.",
    },
    stats: {
      totalPhenotypes: "Total Phenotypes",
      withExpression: "With Expression",
      domainsCovered: "Domains Covered",
      imported: "Imported",
    },
    table: {
      headers: {
        name: "Name",
        domain: "Domain",
        severity: "Severity",
        tags: "Tags",
        action: "Action",
      },
      failedToLoad: "Failed to load phenotype library.",
      empty: "No phenotypes found.",
      noTags: "no tags",
    },
    actions: {
      imported: "Imported",
      import: "Import",
      importing: "Importing...",
      noExpressionAvailable: "No expression available",
      importAsCohortDefinition: "Import as cohort definition",
    },
    pagination: {
      pageOf: "Page {{page}} of {{totalPages}}",
      previous: "Previous",
      next: "Next",
    },
    domains: {
      condition: "Condition",
      drug: "Drug",
      measurement: "Measurement",
      procedure: "Procedure",
      observation: "Observation",
      device: "Device",
    },
    severities: {
      acute: "Acute",
      chronic: "Chronic",
      subacute: "Subacute",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Phase 3 Demo",
      title: "Community Workbench SDK Demo",
      subtitle:
        "This sandbox page shows what an SDK-generated tool looks like inside Parthenon before domain-specific logic is wired in. It is a non-production reference implementation for community developers, partner teams, and AI coding assistants.",
      backToWorkbench: "Back To Workbench",
      openSdkDocs: "Open SDK Docs",
      loading: "Loading demo payload from Parthenon backend...",
      failed:
        "The Community Workbench SDK demo payload could not be loaded from the backend.",
    },
    serviceDescriptor: {
      title: "Sample Service Descriptor",
      description:
        "This is the discovery and availability metadata a generated tool should expose before the frontend renders the workbench surface.",
    },
    checklist: {
      title: "Integration Checklist",
      step: "Step {{index}}",
      items: {
        serviceRegistry:
          "Add a service registry entry in {{path}}.",
        toolModule:
          "Register the MCP tool module in {{path}}.",
        backendController:
          "Wire a backend controller and workbench service for validation, permissions, and persistence.",
        frontendRoute:
          "Add a frontend route and replace placeholder panels with domain-specific rendering.",
        validatePayloads:
          "Validate real payloads against the Community Workbench SDK schemas before release.",
      },
    },
    resultEnvelope: {
      title: "Sample Result Envelope",
      description:
        "SDK-generated tools should normalize their runtime diagnostics, source context, summary, and artifacts into a predictable envelope like this before rendering richer panels.",
    },
    artifacts: {
      title: "Generated Artifact Inventory",
      descriptionPrefix:
        "This demo is backed by a real generated sample scaffold at",
      descriptionSuffix: "in the repository.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Novel capabilities and research toolsets",
    },
    sections: {
      toolsetsTitle: "Toolsets",
      toolsetsSubtitle: "Pick the workbench that fits your research question.",
      recentTitle: "Recent investigations",
      recentSubtitle: "Evidence investigations you've worked on recently.",
    },
    states: {
      loadingInvestigations: "Loading investigations...",
      emptyInvestigations: "Start your first Evidence Investigation.",
    },
    actions: {
      createInvestigation: "Create Investigation",
      newInvestigation: "New Investigation",
    },
    footer: {
      prompt: "Want to build a custom toolset?",
      link: "View the Community SDK reference",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline: "Inpatient outcomes & ICU analytics workbench",
        description:
          "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
      },
      sdk: {
        name: "Build a Toolset",
        tagline: "Community SDK for third-party integrations",
        description:
          "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
      },
    },
    toolsetStatus: {
      available: "Available",
      comingSoon: "Coming Soon",
      sdkRequired: "SDK Required",
    },
    investigationStatus: {
      draft: "Draft",
      active: "Active",
      complete: "Complete",
      archived: "Archived",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "Loading ETL projects...",
      createTitle: "Create ETL Mapping Project",
      createDescription:
        "Start mapping your source schema to the OMOP CDM. Select a source that has been profiled via the Source Profiler tab first.",
      cdmVersion: "CDM Version",
      cdm54: "OMOP CDM v5.4",
      cdm53: "OMOP CDM v5.3",
      creating: "Creating...",
      createProject: "Create Project",
      createFailed: "Failed to create project",
      emptyTitle: "Aqueduct ETL Mapping Designer",
      emptyDescription:
        'Navigate to an ingestion project and click "Open in Aqueduct" to start designing ETL mappings from your source schema to the OMOP CDM.',
    },
  },
};

const frSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Concepteur d'etude",
      subtitle:
        "Conception d'etude assistee par IA avec OHDSI StudyAgent",
    },
    tabs: {
      intent: "Intention de l'etude",
      search: "Recherche de phenotypes",
      recommend: "Recommandations",
      lint: "Controle de cohorte",
    },
    intent: {
      title: "Decrivez votre etude",
      description:
        "Saisissez une description en langage naturel de votre etude. L'IA la separera en population cible et resultat, puis recommandera des phenotypes de la bibliotheque OHDSI.",
      placeholder:
        "p. ex., comparer le risque d'insuffisance cardiaque chez les patients nouvellement traites par inhibiteurs SGLT2 versus inhibiteurs DPP-4 parmi les adultes atteints de diabete de type 2...",
      analyze: "Analyser l'intention de l'etude",
      targetPopulation: "Population cible",
      outcome: "Resultat",
    },
    recommendations: {
      title: "Phenotypes recommandes",
      score: "Score : {{value}}",
      loading: "Recherche de recommandations de phenotypes...",
      promptPrefix: "Saisissez une intention d'etude dans l'onglet",
      promptSuffix:
        "pour obtenir des recommandations de phenotypes classees par IA.",
    },
    search: {
      title: "Rechercher dans la bibliotheque de phenotypes",
      placeholder:
        "Rechercher des phenotypes (p. ex., diabete de type 2, insuffisance cardiaque, BPCO)...",
      submit: "Rechercher",
      resultsFound_one: "{{count}} resultat trouve",
      resultsFound_other: "{{count}} resultats trouves",
      noneFound:
        "Aucun phenotype trouve. Essayez un autre terme de recherche.",
    },
    lint: {
      title: "Verifier une definition de cohorte",
      description:
        "Collez un JSON de definition de cohorte pour detecter des problemes de conception comme des periodes de washout manquantes, des ensembles de concepts vides et des fenetres temporelles inversees.",
      run: "Executer le controle",
      noIssuesFound: "Aucun probleme trouve",
      issuesFound_one: "{{count}} probleme trouve",
      issuesFound_other: "{{count}} problemes trouves",
      failed: "Echec du controle : JSON invalide ou erreur serveur.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Bibliotheque de phenotypes",
      subtitle:
        "Plus de 300 definitions de phenotypes OHDSI organisees - parcourir, filtrer et importer en un clic",
      searchPlaceholder: "Rechercher des phenotypes par nom ou description...",
      allDomains: "Tous les domaines",
      loading: "Chargement...",
      clearFilters: "Effacer les filtres",
      resultCount_one: "{{displayCount}} phenotype",
      resultCount_other: "{{displayCount}} phenotypes",
      matchingFilters: "correspondant aux filtres",
    },
    detail: {
      description: "Description",
      logic: "Logique",
      noAdditionalDetails: "Aucun detail supplementaire disponible.",
    },
    stats: {
      totalPhenotypes: "Total des phenotypes",
      withExpression: "Avec expression",
      domainsCovered: "Domaines couverts",
      imported: "Importes",
    },
    table: {
      headers: {
        name: "Nom",
        domain: "Domaine",
        severity: "Gravite",
        tags: "Etiquettes",
        action: "Action",
      },
      failedToLoad: "Echec du chargement de la bibliotheque de phenotypes.",
      empty: "Aucun phenotype trouve.",
      noTags: "aucune etiquette",
    },
    actions: {
      imported: "Importe",
      import: "Importer",
      importing: "Importation...",
      noExpressionAvailable: "Aucune expression disponible",
      importAsCohortDefinition: "Importer comme definition de cohorte",
    },
    pagination: {
      pageOf: "Page {{page}} sur {{totalPages}}",
      previous: "Precedent",
      next: "Suivant",
    },
    domains: {
      condition: "Affection",
      drug: "Medicament",
      measurement: "Mesure",
      procedure: "Procedure",
      observation: "Observation",
      device: "Dispositif",
    },
    severities: {
      acute: "Aigu",
      chronic: "Chronique",
      subacute: "Subaigu",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Demo phase 3",
      title: "Demo du SDK Community Workbench",
      subtitle:
        "Cette page bac a sable montre a quoi ressemble un outil genere par SDK dans Parthenon avant le raccordement d'une logique propre au domaine. Il s'agit d'une implementation de reference hors production pour les developpeurs de la communaute, les equipes partenaires et les assistants de codage IA.",
      backToWorkbench: "Retour au Workbench",
      openSdkDocs: "Ouvrir la documentation SDK",
      loading: "Chargement de la charge utile de demo depuis le backend Parthenon...",
      failed:
        "La charge utile de demo Community Workbench SDK n'a pas pu etre chargee depuis le backend.",
    },
    serviceDescriptor: {
      title: "Descripteur de service exemple",
      description:
        "Voici les metadonnees de decouverte et de disponibilite qu'un outil genere doit exposer avant que le frontend n'affiche la surface Workbench.",
    },
    checklist: {
      title: "Liste de controle d'integration",
      step: "Etape {{index}}",
      items: {
        serviceRegistry:
          "Ajouter une entree de registre de service dans {{path}}.",
        toolModule: "Enregistrer le module d'outil MCP dans {{path}}.",
        backendController:
          "Raccorder un controleur backend et un service Workbench pour la validation, les autorisations et la persistance.",
        frontendRoute:
          "Ajouter une route frontend et remplacer les panneaux temporaires par un rendu propre au domaine.",
        validatePayloads:
          "Valider les charges utiles reelles avec les schemas Community Workbench SDK avant la publication.",
      },
    },
    resultEnvelope: {
      title: "Enveloppe de resultat exemple",
      description:
        "Les outils generes par SDK doivent normaliser leurs diagnostics d'execution, leur contexte source, leur resume et leurs artefacts dans une enveloppe previsible comme celle-ci avant d'afficher des panneaux plus riches.",
    },
    artifacts: {
      title: "Inventaire des artefacts generes",
      descriptionPrefix:
        "Cette demo s'appuie sur un exemple d'echafaudage genere reel situe dans",
      descriptionSuffix: "dans le depot.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Nouvelles capacites et boites a outils de recherche",
    },
    sections: {
      toolsetsTitle: "Boites a outils",
      toolsetsSubtitle:
        "Choisissez le workbench adapte a votre question de recherche.",
      recentTitle: "Investigations recentes",
      recentSubtitle:
        "Investigations de preuves sur lesquelles vous avez travaille recemment.",
    },
    states: {
      loadingInvestigations: "Chargement des investigations...",
      emptyInvestigations: "Commencez votre premiere investigation de preuves.",
    },
    actions: {
      createInvestigation: "Creer une investigation",
      newInvestigation: "Nouvelle investigation",
    },
    footer: {
      prompt: "Vous voulez creer une boite a outils personnalisee ?",
      link: "Voir la reference du SDK Community",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline:
          "Workbench d'analytique des resultats hospitaliers et de soins intensifs",
        description:
          "Analytique axee sur les soins intensifs exploitant les donnees MIMIC-IV dans OMOP CDM 5.4. Conformite au bundle ABCDEF Liberation, prediction du sevrage ventilatoire, surveillance de la sedation et recherche sur les resultats hospitaliers.",
      },
      sdk: {
        name: "Creer une boite a outils",
        tagline: "SDK Community pour integrations tierces",
        description:
          "Implementation de reference et documentation SDK pour creer des boites a outils personnalisees qui se branchent sur Parthenon Workbench. Descripteurs de service, enveloppes de resultat et modeles d'artefacts.",
      },
    },
    toolsetStatus: {
      available: "Disponible",
      comingSoon: "Bientot disponible",
      sdkRequired: "SDK requis",
    },
    investigationStatus: {
      draft: "Brouillon",
      active: "Actif",
      complete: "Termine",
      archived: "Archive",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "Chargement des projets ETL...",
      createTitle: "Creer un projet de mappage ETL",
      createDescription:
        "Commencez a mapper votre schema source vers l'OMOP CDM. Selectionnez d'abord une source profilee via l'onglet Source Profiler.",
      cdmVersion: "Version du CDM",
      creating: "Creation...",
      createProject: "Creer le projet",
      createFailed: "Echec de la creation du projet",
      emptyTitle: "Concepteur de mappage ETL Aqueduct",
      emptyDescription:
        'Accedez a un projet d\'ingestion et cliquez sur "Open in Aqueduct" pour commencer a concevoir les mappages ETL entre votre schema source et l\'OMOP CDM.',
    },
  },
});

const deSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Studien-Designer",
      subtitle:
        "KI-gestutztes Studiendesign mit OHDSI StudyAgent",
    },
    tabs: {
      intent: "Studienabsicht",
      search: "Phaenotypsuche",
      recommend: "Empfehlungen",
      lint: "Kohortenpruefung",
    },
    intent: {
      title: "Beschreiben Sie Ihre Studie",
      description:
        "Geben Sie eine natuerlichsprachliche Beschreibung Ihrer Studie ein. Die KI teilt sie in Zielpopulation und Ergebnis auf und empfiehlt dann Phaenotypen aus der OHDSI-Bibliothek.",
      placeholder:
        "z. B. Vergleich des Risikos fuer Herzinsuffizienz bei Patienten mit neuer Verordnung von SGLT2-Hemmern gegenueber DPP-4-Hemmern bei Erwachsenen mit Typ-2-Diabetes...",
      analyze: "Studienabsicht analysieren",
      targetPopulation: "Zielpopulation",
      outcome: "Ergebnis",
    },
    recommendations: {
      title: "Empfohlene Phaenotypen",
      score: "Score: {{value}}",
      loading: "Phaenotypempfehlungen werden gesucht...",
      promptPrefix: "Geben Sie eine Studienabsicht im Tab",
      promptSuffix:
        "ein, um KI-gerankte Phaenotypempfehlungen zu erhalten.",
    },
    search: {
      title: "Phaenotypbibliothek durchsuchen",
      placeholder:
        "Phaenotypen suchen (z. B. Typ-2-Diabetes, Herzinsuffizienz, COPD)...",
      submit: "Suchen",
      resultsFound_one: "{{count}} Ergebnis gefunden",
      resultsFound_other: "{{count}} Ergebnisse gefunden",
      noneFound:
        "Keine Phaenotypen gefunden. Versuchen Sie einen anderen Suchbegriff.",
    },
    lint: {
      title: "Kohortendefinition pruefen",
      description:
        "Fuegen Sie JSON einer Kohortendefinition ein, um Designprobleme wie fehlende Washout-Perioden, leere Konzeptsets und invertierte Zeitfenster zu erkennen.",
      run: "Pruefung ausfuehren",
      noIssuesFound: "Keine Probleme gefunden",
      issuesFound_one: "{{count}} Problem gefunden",
      issuesFound_other: "{{count}} Probleme gefunden",
      failed: "Pruefung fehlgeschlagen: ungueltiges JSON oder Serverfehler.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Phaenotypbibliothek",
      subtitle:
        "Mehr als 300 kuratierte OHDSI-Phaenotypdefinitionen - durchsuchen, filtern und mit einem Klick importieren",
      searchPlaceholder: "Phaenotypen nach Name oder Beschreibung suchen...",
      allDomains: "Alle Domaenen",
      loading: "Wird geladen...",
      clearFilters: "Filter zuruecksetzen",
      resultCount_one: "{{displayCount}} Phaenotyp",
      resultCount_other: "{{displayCount}} Phaenotypen",
      matchingFilters: "passend zu den Filtern",
    },
    detail: {
      description: "Beschreibung",
      logic: "Logik",
      noAdditionalDetails: "Keine weiteren Details verfuegbar.",
    },
    stats: {
      totalPhenotypes: "Phaenotypen insgesamt",
      withExpression: "Mit Ausdruck",
      domainsCovered: "Abgedeckte Domaenen",
      imported: "Importiert",
    },
    table: {
      headers: {
        name: "Name",
        domain: "Domaene",
        severity: "Schweregrad",
        tags: "Tags",
        action: "Aktion",
      },
      failedToLoad: "Phaenotypbibliothek konnte nicht geladen werden.",
      empty: "Keine Phaenotypen gefunden.",
      noTags: "keine Tags",
    },
    actions: {
      imported: "Importiert",
      import: "Importieren",
      importing: "Importieren...",
      noExpressionAvailable: "Kein Ausdruck verfuegbar",
      importAsCohortDefinition: "Als Kohortendefinition importieren",
    },
    pagination: {
      pageOf: "Seite {{page}} von {{totalPages}}",
      previous: "Zurueck",
      next: "Weiter",
    },
    domains: {
      condition: "Erkrankung",
      drug: "Arzneimittel",
      measurement: "Messung",
      procedure: "Prozedur",
      observation: "Beobachtung",
      device: "Geraet",
    },
    severities: {
      acute: "Akut",
      chronic: "Chronisch",
      subacute: "Subakut",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Phase-3-Demo",
      title: "Community Workbench SDK-Demo",
      subtitle:
        "Diese Sandbox-Seite zeigt, wie ein SDK-generiertes Werkzeug in Parthenon aussieht, bevor domainspezifische Logik verdrahtet ist. Es ist eine nicht-produktive Referenzimplementierung fuer Community-Entwickler, Partnerteams und KI-Coding-Assistenten.",
      backToWorkbench: "Zurueck zum Workbench",
      openSdkDocs: "SDK-Dokumentation oeffnen",
      loading: "Demo-Nutzlast wird vom Parthenon-Backend geladen...",
      failed:
        "Die Demo-Nutzlast des Community Workbench SDK konnte nicht aus dem Backend geladen werden.",
    },
    serviceDescriptor: {
      title: "Beispiel-Service-Deskriptor",
      description:
        "Dies sind die Discovery- und Verfuegbarkeitsmetadaten, die ein generiertes Werkzeug bereitstellen sollte, bevor das Frontend die Workbench-Oberflaeche rendert.",
    },
    checklist: {
      title: "Integrations-Checkliste",
      step: "Schritt {{index}}",
      items: {
        serviceRegistry:
          "Einen Service-Registry-Eintrag in {{path}} hinzufuegen.",
        toolModule: "Das MCP-Werkzeugmodul in {{path}} registrieren.",
        backendController:
          "Einen Backend-Controller und Workbench-Service fuer Validierung, Berechtigungen und Persistenz verdrahten.",
        frontendRoute:
          "Eine Frontend-Route hinzufuegen und Platzhalterpanels durch domainspezifisches Rendering ersetzen.",
        validatePayloads:
          "Reale Nutzlasten vor der Freigabe gegen die Community Workbench SDK-Schemas validieren.",
      },
    },
    resultEnvelope: {
      title: "Beispiel-Ergebnisumschlag",
      description:
        "SDK-generierte Werkzeuge sollten Laufzeitdiagnostik, Quellkontext, Zusammenfassung und Artefakte in einem vorhersagbaren Umschlag wie diesem normalisieren, bevor reichere Panels gerendert werden.",
    },
    artifacts: {
      title: "Inventar generierter Artefakte",
      descriptionPrefix:
        "Diese Demo basiert auf einem real generierten Beispielgeruest unter",
      descriptionSuffix: "im Repository.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Neue Funktionen und Forschungswerkzeugsets",
    },
    sections: {
      toolsetsTitle: "Werkzeugsets",
      toolsetsSubtitle:
        "Waehlen Sie den Workbench, der zu Ihrer Forschungsfrage passt.",
      recentTitle: "Aktuelle Untersuchungen",
      recentSubtitle:
        "Evidenzuntersuchungen, an denen Sie kuerzlich gearbeitet haben.",
    },
    states: {
      loadingInvestigations: "Untersuchungen werden geladen...",
      emptyInvestigations: "Starten Sie Ihre erste Evidenzuntersuchung.",
    },
    actions: {
      createInvestigation: "Untersuchung erstellen",
      newInvestigation: "Neue Untersuchung",
    },
    footer: {
      prompt: "Moechten Sie ein eigenes Werkzeugset bauen?",
      link: "Community-SDK-Referenz ansehen",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline:
          "Workbench fuer stationaere Ergebnisse und ICU-Analytik",
        description:
          "ICU-fokussierte Analytik mit MIMIC-IV-Daten in OMOP CDM 5.4. ABCDEF Liberation Bundle-Compliance, Vorhersage der Beatmungsentwoehnung, Sedierungsueberwachung und Forschung zu stationaeren Ergebnissen.",
      },
      sdk: {
        name: "Werkzeugset bauen",
        tagline: "Community-SDK fuer Drittanbieter-Integrationen",
        description:
          "Referenzimplementierung und SDK-Dokumentation fuer den Bau benutzerdefinierter Werkzeugsets, die sich in den Parthenon Workbench einklinken. Service-Deskriptoren, Ergebnisumschlaege und Artefaktmuster.",
      },
    },
    toolsetStatus: {
      available: "Verfuegbar",
      comingSoon: "Bald verfuegbar",
      sdkRequired: "SDK erforderlich",
    },
    investigationStatus: {
      draft: "Entwurf",
      active: "Aktiv",
      complete: "Abgeschlossen",
      archived: "Archiviert",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "ETL-Projekte werden geladen...",
      createTitle: "ETL-Mapping-Projekt erstellen",
      createDescription:
        "Beginnen Sie damit, Ihr Quellschema dem OMOP CDM zuzuordnen. Wahlen Sie zuerst eine Quelle aus, die uber den Reiter Source Profiler profiliert wurde.",
      cdmVersion: "CDM-Version",
      creating: "Erstellen...",
      createProject: "Projekt erstellen",
      createFailed: "Projekt konnte nicht erstellt werden",
      emptyTitle: "Aqueduct ETL-Mapping-Designer",
      emptyDescription:
        'Navigieren Sie zu einem Ingestion-Projekt und klicken Sie auf "Open in Aqueduct", um mit dem Entwerfen von ETL-Zuordnungen von Ihrem Quellschema zum OMOP CDM zu beginnen.',
    },
  },
});

const ptSmallWorkbench: MessageTree = mergeMessageTrees(enSmallWorkbench, {
  studyAgent: {
    header: {
      title: "Designer de estudo",
      subtitle:
        "Desenho de estudo assistido por IA com OHDSI StudyAgent",
    },
    tabs: {
      intent: "Intencao do estudo",
      search: "Busca de fenotipos",
      recommend: "Recomendacoes",
      lint: "Verificacao da coorte",
    },
    intent: {
      title: "Descreva seu estudo",
      description:
        "Insira uma descricao em linguagem natural do seu estudo. A IA separara em populacao-alvo e desfecho e depois recomendara fenotipos da biblioteca OHDSI.",
      placeholder:
        "ex.: comparar o risco de insuficiencia cardiaca em pacientes com nova prescricao de inibidores de SGLT2 versus inibidores de DPP-4 entre adultos com diabetes tipo 2...",
      analyze: "Analisar intencao do estudo",
      targetPopulation: "Populacao-alvo",
      outcome: "Desfecho",
    },
    recommendations: {
      title: "Fenotipos recomendados",
      score: "Score: {{value}}",
      loading: "Buscando recomendacoes de fenotipos...",
      promptPrefix: "Insira uma intencao de estudo na aba",
      promptSuffix:
        "para obter recomendacoes de fenotipos ranqueadas por IA.",
    },
    search: {
      title: "Buscar na biblioteca de fenotipos",
      placeholder:
        "Buscar fenotipos (ex.: diabetes tipo 2, insuficiencia cardiaca, DPOC)...",
      submit: "Buscar",
      resultsFound_one: "{{count}} resultado encontrado",
      resultsFound_other: "{{count}} resultados encontrados",
      noneFound:
        "Nenhum fenotipo encontrado. Tente outro termo de busca.",
    },
    lint: {
      title: "Verificar definicao de coorte",
      description:
        "Cole um JSON de definicao de coorte para verificar problemas de desenho, como periodos de washout ausentes, conjuntos de conceitos vazios e janelas temporais invertidas.",
      run: "Executar verificacao",
      noIssuesFound: "Nenhum problema encontrado",
      issuesFound_one: "{{count}} problema encontrado",
      issuesFound_other: "{{count}} problemas encontrados",
      failed: "Falha na verificacao: JSON invalido ou erro do servidor.",
    },
  },
  phenotypeLibrary: {
    page: {
      title: "Biblioteca de fenotipos",
      subtitle:
        "Mais de 300 definicoes de fenotipos OHDSI curadas - navegue, filtre e importe com um clique",
      searchPlaceholder: "Buscar fenotipos por nome ou descricao...",
      allDomains: "Todos os dominios",
      loading: "Carregando...",
      clearFilters: "Limpar filtros",
      resultCount_one: "{{displayCount}} fenotipo",
      resultCount_other: "{{displayCount}} fenotipos",
      matchingFilters: "correspondendo aos filtros",
    },
    detail: {
      description: "Descricao",
      logic: "Logica",
      noAdditionalDetails: "Nenhum detalhe adicional disponivel.",
    },
    stats: {
      totalPhenotypes: "Total de fenotipos",
      withExpression: "Com expressao",
      domainsCovered: "Dominios cobertos",
      imported: "Importados",
    },
    table: {
      headers: {
        name: "Nome",
        domain: "Dominio",
        severity: "Gravidade",
        tags: "Tags",
        action: "Acao",
      },
      failedToLoad: "Falha ao carregar a biblioteca de fenotipos.",
      empty: "Nenhum fenotipo encontrado.",
      noTags: "sem tags",
    },
    actions: {
      imported: "Importado",
      import: "Importar",
      importing: "Importando...",
      noExpressionAvailable: "Nenhuma expressao disponivel",
      importAsCohortDefinition: "Importar como definicao de coorte",
    },
    pagination: {
      pageOf: "Pagina {{page}} de {{totalPages}}",
      previous: "Anterior",
      next: "Proximo",
    },
    domains: {
      condition: "Condicao",
      drug: "Medicamento",
      measurement: "Medida",
      procedure: "Procedimento",
      observation: "Observacao",
      device: "Dispositivo",
    },
    severities: {
      acute: "Agudo",
      chronic: "Cronico",
      subacute: "Subagudo",
    },
  },
  communityWorkbenchSdk: {
    page: {
      badge: "Demo da fase 3",
      title: "Demo do SDK Community Workbench",
      subtitle:
        "Esta pagina sandbox mostra como uma ferramenta gerada pelo SDK aparece dentro do Parthenon antes que a logica especifica de dominio seja conectada. E uma implementacao de referencia nao produtiva para desenvolvedores da comunidade, equipes parceiras e assistentes de codificacao por IA.",
      backToWorkbench: "Voltar ao Workbench",
      openSdkDocs: "Abrir docs do SDK",
      loading: "Carregando carga de demo do backend Parthenon...",
      failed:
        "A carga de demo do Community Workbench SDK nao pode ser carregada do backend.",
    },
    serviceDescriptor: {
      title: "Descritor de servico de exemplo",
      description:
        "Estes sao os metadados de descoberta e disponibilidade que uma ferramenta gerada deve expor antes que o frontend renderize a superficie do workbench.",
    },
    checklist: {
      title: "Lista de verificacao de integracao",
      step: "Etapa {{index}}",
      items: {
        serviceRegistry:
          "Adicione uma entrada de registro de servico em {{path}}.",
        toolModule: "Registre o modulo da ferramenta MCP em {{path}}.",
        backendController:
          "Conecte um controlador backend e um servico workbench para validacao, permissoes e persistencia.",
        frontendRoute:
          "Adicione uma rota frontend e substitua paineis temporarios por renderizacao especifica do dominio.",
        validatePayloads:
          "Valide cargas reais contra os schemas do Community Workbench SDK antes do lancamento.",
      },
    },
    resultEnvelope: {
      title: "Envelope de resultado de exemplo",
      description:
        "Ferramentas geradas pelo SDK devem normalizar diagnosticos de execucao, contexto da fonte, resumo e artefatos em um envelope previsivel como este antes de renderizar paineis mais ricos.",
    },
    artifacts: {
      title: "Inventario de artefatos gerados",
      descriptionPrefix:
        "Esta demo e apoiada por um scaffold de amostra gerado real em",
      descriptionSuffix: "no repositorio.",
    },
  },
  workbenchLauncher: {
    page: {
      title: "Workbench",
      subtitle: "Novas capacidades e conjuntos de ferramentas de pesquisa",
    },
    sections: {
      toolsetsTitle: "Conjuntos de ferramentas",
      toolsetsSubtitle:
        "Escolha o workbench que se ajusta a sua pergunta de pesquisa.",
      recentTitle: "Investigacoes recentes",
      recentSubtitle:
        "Investigacoes de evidencias em que voce trabalhou recentemente.",
    },
    states: {
      loadingInvestigations: "Carregando investigacoes...",
      emptyInvestigations: "Inicie sua primeira Investigacao de Evidencias.",
    },
    actions: {
      createInvestigation: "Criar investigacao",
      newInvestigation: "Nova investigacao",
    },
    footer: {
      prompt: "Quer criar um conjunto de ferramentas personalizado?",
      link: "Ver a referencia do SDK Community",
    },
    toolsetMeta: {
      morpheus: {
        name: "Morpheus",
        tagline:
          "Workbench de desfechos hospitalares e analitica de UTI",
        description:
          "Analitica focada em UTI usando dados MIMIC-IV em OMOP CDM 5.4. Conformidade com o bundle ABCDEF Liberation, predicao de desmame ventilatorio, monitoramento de sedacao e pesquisa de desfechos hospitalares.",
      },
      sdk: {
        name: "Criar um conjunto de ferramentas",
        tagline: "SDK Community para integracoes de terceiros",
        description:
          "Implementacao de referencia e documentacao do SDK para criar conjuntos de ferramentas personalizados que se conectam ao Parthenon Workbench. Descritores de servico, envelopes de resultado e padroes de artefatos.",
      },
    },
    toolsetStatus: {
      available: "Disponivel",
      comingSoon: "Em breve",
      sdkRequired: "SDK necessario",
    },
    investigationStatus: {
      draft: "Rascunho",
      active: "Ativo",
      complete: "Concluido",
      archived: "Arquivado",
    },
  },
  etl: {
    toolsPage: {
      loadingProjects: "Carregando projetos ETL...",
      createTitle: "Criar projeto de mapeamento ETL",
      createDescription:
        "Comece a mapear seu esquema de origem para o OMOP CDM. Primeiro selecione uma origem que tenha sido perfilada pela aba Perfilador de origem.",
      cdmVersion: "Versao do CDM",
      creating: "Criando...",
      createProject: "Criar projeto",
      createFailed: "Falha ao criar o projeto",
      emptyTitle: "Designer de mapeamento ETL Aqueduct",
      emptyDescription:
        'Navegue ate um projeto de ingestao e clique em "Open in Aqueduct" para comecar a desenhar mapeamentos ETL do seu esquema de origem para o OMOP CDM.',
    },
  },
});

export const smallWorkbenchResources: Record<string, MessageTree> = {
  "en-US": enSmallWorkbench,
  "es-ES": mergeMessageTrees(enSmallWorkbench, {}),
  "fr-FR": frSmallWorkbench,
  "de-DE": deSmallWorkbench,
  "pt-BR": ptSmallWorkbench,
  "fi-FI": mergeMessageTrees(enSmallWorkbench, {}),
  "ja-JP": mergeMessageTrees(enSmallWorkbench, {}),
  "zh-Hans": mergeMessageTrees(enSmallWorkbench, {}),
  "ko-KR": mergeMessageTrees(enSmallWorkbench, {}),
  "hi-IN": mergeMessageTrees(enSmallWorkbench, {}),
  ar: mergeMessageTrees(enSmallWorkbench, {}),
  "en-XA": mergeMessageTrees(enSmallWorkbench, {}),
};
