type MessageTree = {
  [key: string]: string | MessageTree;
};

function mergeMessageTrees(base: MessageTree, overrides: MessageTree): MessageTree {
  return Object.fromEntries(
    Object.entries(base).map(([key, baseValue]) => {
      const overrideValue = overrides[key];
      if (
        baseValue &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue)
      ) {
        return [
          key,
          mergeMessageTrees(
            baseValue,
            overrideValue &&
              typeof overrideValue === 'object' &&
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

const enMorpheus: MessageTree = {
  morpheus: {
    common: {
      brand: 'Morpheus',
      navigation: {
        dashboard: 'Dashboard',
        patientJourney: 'Patient Journey',
        workbench: 'Workbench',
      },
      actions: {
        icuPatients: 'ICU Patients',
        deceased: 'Deceased',
        browseAll: 'Browse All',
        clearAll: 'Clear all',
        exportCsv: 'Export CSV',
        viewInVocabularyBrowser: 'View in Vocabulary Browser',
      },
      loading: {
        generic: 'Loading...',
        failed: 'Failed to load',
        metricsFailed: 'Failed to load metrics',
        patients: 'Loading patients...',
      },
      data: {
        noData: 'No data',
        noTrendData: 'No trend data',
        noPatientsFound: 'No patients found',
        noPatientsMatchFilters: 'No patients match the current filters',
        noDiagnosesRecorded: 'No diagnoses recorded',
        noTransferData: 'No transfer data available',
        noMedicationData: 'No medication data available',
        noNumericLabs: 'No numeric lab results available',
        noVitalSigns: 'No vital signs data available',
        noCultureData: 'No culture data available',
        noAntibiogramData: 'No antibiogram data available',
        noPopulationData: 'Population data not available',
        noGrowth: 'No growth',
      },
      values: {
        yes: 'Yes',
        no: 'No',
        unknown: 'Unknown',
        mapped: 'Mapped',
        unmapped: 'Unmapped',
        other: 'Other',
        patients: 'patients',
        patientsShort: 'pts',
        admissionsShort: 'adm',
        daysShort: 'd',
        hoursShort: 'h',
        primary: 'Primary',
      },
      gender: {
        male: 'Male',
        female: 'Female',
      },
      counts: {
        showingPatients: 'Showing {{shown}} of {{total}} patients',
        testsSummary: '{{tests}} tests · {{values}} numeric values',
        tests_one: '{{count}} test',
        tests_other: '{{count}} tests',
        occurrences_one: '{{count}} occurrence',
        occurrences_other: '{{count}} occurrences',
        more: '+{{count}} more',
        patientsWithPercent:
          '{{patientCount}} of {{totalPatients}} patients ({{percentage}}%)',
      },
      tooltips: {
        diedInHospital: 'Died in hospital',
        viewConceptInVocabularyBrowser: 'View concept in Vocabulary Browser',
      },
      search: {
        patientPlaceholder: 'Search by Subject ID...',
        searching: 'Searching...',
        age: 'Age',
      },
      filters: {
        icu: 'ICU:',
        mortality: 'Mortality:',
        los: 'LOS:',
        diagnosis: 'Diagnosis:',
        days: 'days',
        min: 'Min',
        max: 'Max',
        clinicalExpanded: '▼ Clinical',
        clinicalCollapsed: '▸ Clinical',
        all: 'All',
        survived: 'Survived',
        deceased: 'Deceased',
        activeCount: '{{count}} active',
        diagnosisPlaceholder: 'Search ICD code or description...',
      },
    },
    dashboard: {
      title: '{{dataset}} Population Dashboard',
      subtitle: 'Aggregate metrics across the inpatient population',
      metrics: {
        patients: 'Patients',
        admissions: 'Admissions',
        icuRate: 'ICU Rate',
        mortality: 'Mortality',
        avgLos: 'Avg LOS',
        avgIcuLos: 'Avg ICU LOS',
      },
      charts: {
        admissionVolume: 'Admission Volume',
        mortalityTrend: 'Mortality Trend',
        gender: 'Gender',
        ageDistribution: 'Age Distribution',
        lengthOfStay: 'Length of Stay',
        topDiagnoses: 'Top 10 Diagnoses',
        topProcedures: 'Top 10 Procedures',
        mortalityByAdmissionType: 'Mortality by Admission Type',
        icuUtilizationByUnit: 'ICU Utilization by Unit',
        admissions: 'Admissions',
        mortalityPercent: 'Mortality %',
        deathsWithRate: '{{deaths}} deaths ({{rate}}%)',
        avgDays: '{{days}}d avg',
      },
    },
    journey: {
      patientCrumb: 'Patient {{subjectId}}',
      tabs: {
        journey: 'Journey',
        diagnoses: 'Diagnoses',
        medications: 'Medications',
        labs: 'Labs',
        vitals: 'Vitals',
        microbiology: 'Microbiology',
      },
      admissionPicker: {
        allAdmissions: 'All Admissions ({{count}})',
      },
      list: {
        subjectId: 'Subject ID',
        gender: 'Gender',
        ageAnchor: 'Age (anchor)',
        yearGroup: 'Year Group',
        admissions: 'Admissions',
        icuStays: 'ICU Stays',
        totalLos: 'Total LOS',
        longestIcu: 'Longest ICU',
        primaryDx: 'Primary Dx',
        deceased: 'Deceased',
      },
      sections: {
        topDiagnoses: 'Top Diagnoses ({{count}} total)',
        admissions: 'Admissions',
      },
      labels: {
        total: 'total',
      },
    },
    eventCounts: {
      admissions: 'Admissions',
      icuStays: 'ICU Stays',
      transfers: 'Transfers',
      diagnoses: 'Diagnoses',
      procedures: 'Procedures',
      medications: 'Medications',
      labs: 'Labs',
      vitals: 'Vitals',
      inputs: 'Inputs',
      outputs: 'Outputs',
      micro: 'Micro',
    },
    conceptDrawer: {
      sourceCode: 'Source Code',
      omopConcept: 'OMOP Concept',
      occurrenceDetails: 'Occurrence Details',
      thisPatient: 'This Patient',
      datasetPopulation: 'Dataset Population',
      date: 'Date',
      value: 'Value',
      route: 'Route',
      dose: 'Dose',
      sequence: 'Sequence',
      mean: 'Mean:',
      median: 'Median:',
      belowRange: 'Below range ({{value}})',
      aboveRange: 'Above range ({{value}})',
      normalRange: 'Normal ({{low}}-{{high}})',
    },
    diagnoses: {
      icdCode: 'ICD Code',
      description: 'Description',
      standardConcept: 'Standard Concept',
      admission: 'Admission',
      sequence: 'Sequence',
    },
    distributionChart: {
      count: 'Count: {{value}}',
    },
    trendChart: {
      valueLabel: 'Value',
      rateLabel: 'Rate',
      value: 'Value: {{value}}',
      rate: 'Rate: {{value}}%',
    },
    truncation: {
      message:
        'Showing {{loaded}} of {{total}} {{domain}}. Results capped for performance.',
    },
    dataset: {
      patientsSuffix: '({{count}} patients)',
      patientsShortSuffix: '({{count}} pts)',
      inpatientFallback: 'Inpatient',
    },
    culture: {
      title: 'Culture Results',
      antibiotic: 'Antibiotic',
      result: 'Result',
      mic: 'MIC',
    },
    antibiogram: {
      title: 'Antibiogram',
      allSpecimens: 'All specimens',
      testedOnly: 'Tested only',
      notTested: 'Not tested',
      organism: 'Organism',
      countPrefix: 'n=',
      caution:
        '* Organisms with <30 isolates - interpret with caution (CLSI M39)',
      interpretation: {
        susceptible: 'Susceptible',
        intermediate: 'Intermediate',
        resistant: 'Resistant',
      },
      classes: {
        penicillins: 'Penicillins',
        cephalosporins: 'Cephalosporins',
        carbapenems: 'Carbapenems',
        fluoroquinolones: 'Fluoroquinolones',
        aminoglycosides: 'Aminoglycosides',
        glycopeptides: 'Glycopeptides',
        macrolides: 'Macrolides',
        lincosamides: 'Lincosamides',
        tetracyclines: 'Tetracyclines',
        sulfonamides: 'Sulfonamides',
        other: 'Other',
      },
    },
    locationTrack: {
      title: 'Location Track',
      ariaLabel: 'Patient location track timeline',
      discharged: 'Discharged',
      icuLabel: 'ICU:',
      duration: 'Duration: {{hours}}h',
      icuStay: 'ICU Stay',
      legend: {
        ed: 'ED',
        icu: 'ICU',
        stepDown: 'Step-down',
        floor: 'Floor',
        pacu: 'PACU',
      },
    },
    medications: {
      title: 'Medications (top {{count}} by frequency)',
      ariaLabel: 'Medication timeline',
      route: 'Route:',
      dose: 'Dose:',
    },
    labs: {
      severity: {
        normal: 'Normal',
        mild: 'Mild',
        moderate: 'Moderate',
        critical: 'Critical',
      },
      panels: {
        renal: 'Renal',
        hepatic: 'Hepatic',
        hematologic: 'Hematologic',
        metabolic: 'Metabolic',
        coagulation: 'Coagulation',
        cardiac: 'Cardiac',
        inflammatory: 'Inflammatory',
        other: 'Other',
      },
    },
    vitals: {
      timelineTitle: 'Vital Signs Timeline',
      selectVitalToDisplay: 'Select a vital to display',
      low: 'Lo:',
      high: 'Hi:',
      labels: {
        heartRate: 'Heart Rate',
        bloodPressureSystolic: 'BP Systolic',
        bloodPressureDiastolic: 'BP Diastolic',
        bloodPressureMean: 'MAP',
        spo2: 'SpO2',
        respiratoryRate: 'Resp Rate',
        temperature: 'Temperature',
        gcs: 'GCS',
        pain: 'Pain',
      },
    },
  },
};

const frMorpheus: MessageTree = mergeMessageTrees(enMorpheus, {
  morpheus: {
    common: {
      navigation: {
        dashboard: 'Tableau de bord',
        patientJourney: 'Parcours patient',
        workbench: 'Espace de travail',
      },
      actions: {
        icuPatients: 'Patients en USI',
        deceased: 'Decedes',
        browseAll: 'Parcourir tout',
        clearAll: 'Tout effacer',
        exportCsv: 'Exporter CSV',
        viewInVocabularyBrowser:
          'Voir dans le navigateur de vocabulaire',
      },
      loading: {
        generic: 'Chargement...',
        failed: 'Echec du chargement',
        metricsFailed: 'Echec du chargement des indicateurs',
        patients: 'Chargement des patients...',
      },
      data: {
        noData: 'Aucune donnee',
        noTrendData: 'Aucune donnee de tendance',
        noPatientsFound: 'Aucun patient trouve',
        noPatientsMatchFilters:
          'Aucun patient ne correspond aux filtres actuels',
        noDiagnosesRecorded: 'Aucun diagnostic enregistre',
        noTransferData: 'Aucune donnee de transfert disponible',
        noMedicationData:
          'Aucune donnee medicamenteuse disponible',
        noNumericLabs:
          "Aucun resultat de laboratoire numerique disponible",
        noVitalSigns: 'Aucune donnee de signes vitaux disponible',
        noCultureData: 'Aucune donnee de culture disponible',
        noAntibiogramData:
          "Aucune donnee d'antibiogramme disponible",
        noPopulationData:
          'Donnees populationnelles non disponibles',
        noGrowth: 'Aucune croissance',
      },
      values: {
        yes: 'Oui',
        no: 'Non',
        unknown: 'Inconnu',
        mapped: 'Mappe',
        unmapped: 'Non mappe',
        other: 'Autre',
        patients: 'patients',
        primary: 'Principal',
      },
      gender: {
        male: 'Homme',
        female: 'Femme',
      },
      counts: {
        showingPatients:
          'Affichage de {{shown}} patients sur {{total}}',
        testsSummary:
          '{{tests}} tests · {{values}} valeurs numeriques',
        tests_one: '{{count}} test',
        tests_other: '{{count}} tests',
        occurrences_one: '{{count}} occurrence',
        occurrences_other: '{{count}} occurrences',
        more: '+{{count}} de plus',
        patientsWithPercent:
          '{{patientCount}} patients sur {{totalPatients}} ({{percentage}}%)',
      },
      tooltips: {
        diedInHospital: "Decede a l'hopital",
        viewConceptInVocabularyBrowser:
          'Voir le concept dans le navigateur de vocabulaire',
      },
      search: {
        patientPlaceholder: 'Rechercher par ID sujet...',
        searching: 'Recherche...',
        age: 'Age',
      },
      filters: {
        icu: 'USI:',
        mortality: 'Mortalite:',
        los: 'DMS:',
        diagnosis: 'Diagnostic:',
        days: 'jours',
        min: 'Min',
        max: 'Max',
        clinicalExpanded: '▼ Clinique',
        clinicalCollapsed: '▸ Clinique',
        all: 'Tous',
        survived: 'Survecu',
        deceased: 'Decede',
        activeCount: '{{count}} actifs',
        diagnosisPlaceholder:
          'Rechercher un code ICD ou une description...',
      },
    },
    dashboard: {
      title: 'Tableau de bord populationnel {{dataset}}',
      subtitle:
        'Indicateurs agreges sur la population hospitalisee',
      metrics: {
        patients: 'Patients',
        admissions: 'Admissions',
        icuRate: 'Taux USI',
        mortality: 'Mortalite',
        avgLos: 'DMS moy',
        avgIcuLos: 'DMS USI moy',
      },
      charts: {
        admissionVolume: "Volume d'admissions",
        mortalityTrend: 'Tendance de mortalite',
        gender: 'Sexe',
        ageDistribution: "Repartition par age",
        lengthOfStay: 'Duree de sejour',
        topDiagnoses: 'Top 10 diagnostics',
        topProcedures: 'Top 10 procedures',
        mortalityByAdmissionType:
          "Mortalite par type d'admission",
        icuUtilizationByUnit:
          "Utilisation de l'USI par unite",
        admissions: 'Admissions',
        mortalityPercent: 'Mortalite %',
        deathsWithRate: '{{deaths}} deces ({{rate}}%)',
        avgDays: '{{days}}j de moy',
      },
    },
    journey: {
      patientCrumb: 'Patient {{subjectId}}',
      tabs: {
        journey: 'Parcours',
        diagnoses: 'Diagnostics',
        medications: 'Medicaments',
        labs: 'Laboratoires',
        vitals: 'Signes vitaux',
        microbiology: 'Microbiologie',
      },
      admissionPicker: {
        allAdmissions: 'Toutes les admissions ({{count}})',
      },
      list: {
        subjectId: 'ID sujet',
        gender: 'Sexe',
        ageAnchor: 'Age (repere)',
        yearGroup: "Groupe d'annee",
        admissions: 'Admissions',
        icuStays: 'Sejours USI',
        totalLos: 'DMS totale',
        longestIcu: 'USI la plus longue',
        primaryDx: 'Diagnostic principal',
        deceased: 'Decede',
      },
      sections: {
        topDiagnoses:
          'Principaux diagnostics ({{count}} au total)',
        admissions: 'Admissions',
      },
      labels: {
        total: 'total',
      },
    },
    eventCounts: {
      admissions: 'Admissions',
      icuStays: 'Sejours USI',
      transfers: 'Transferts',
      diagnoses: 'Diagnostics',
      procedures: 'Procedures',
      medications: 'Medicaments',
      labs: 'Laboratoires',
      vitals: 'Signes vitaux',
      inputs: 'Entrees',
      outputs: 'Sorties',
      micro: 'Micro',
    },
    conceptDrawer: {
      sourceCode: 'Code source',
      omopConcept: 'Concept OMOP',
      occurrenceDetails: "Details de l'occurrence",
      thisPatient: 'Ce patient',
      datasetPopulation: 'Population du jeu de donnees',
      date: 'Date',
      value: 'Valeur',
      route: 'Voie',
      dose: 'Dose',
      sequence: 'Sequence',
      mean: 'Moyenne:',
      median: 'Mediane:',
      belowRange: 'Sous la plage ({{value}})',
      aboveRange: 'Au-dessus de la plage ({{value}})',
      normalRange: 'Normal ({{low}}-{{high}})',
    },
    diagnoses: {
      icdCode: 'Code ICD',
      description: 'Description',
      standardConcept: 'Concept standard',
      admission: 'Admission',
      sequence: 'Sequence',
    },
    distributionChart: {
      count: 'Compte: {{value}}',
    },
    trendChart: {
      valueLabel: 'Valeur',
      rateLabel: 'Taux',
      value: 'Valeur: {{value}}',
      rate: 'Taux: {{value}}%',
    },
    truncation: {
      message:
        'Affichage de {{loaded}} {{domain}} sur {{total}}. Resultats limites pour les performances.',
    },
    dataset: {
      inpatientFallback: 'Hospitalisation',
    },
    culture: {
      title: 'Resultats de culture',
      antibiotic: 'Antibiotique',
      result: 'Resultat',
      mic: 'CMI',
    },
    antibiogram: {
      title: 'Antibiogramme',
      allSpecimens: 'Tous les specimens',
      testedOnly: 'Testes uniquement',
      notTested: 'Non testes',
      organism: 'Organisme',
      caution:
        '* Organismes avec <30 isolats - interpreter avec prudence (CLSI M39)',
      interpretation: {
        susceptible: 'Sensible',
        intermediate: 'Intermediaire',
        resistant: 'Resistant',
      },
      classes: {
        penicillins: 'Penicillines',
        cephalosporins: 'Cephalosporines',
        carbapenems: 'Carbapenemes',
        fluoroquinolones: 'Fluoroquinolones',
        aminoglycosides: 'Aminoglycosides',
        glycopeptides: 'Glycopeptides',
        macrolides: 'Macrolides',
        lincosamides: 'Lincosamides',
        tetracyclines: 'Tetracyclines',
        sulfonamides: 'Sulfamides',
        other: 'Autre',
      },
    },
    locationTrack: {
      title: 'Parcours de localisation',
      ariaLabel:
        'Chronologie du parcours de localisation du patient',
      discharged: 'Sorti',
      icuLabel: 'USI:',
      duration: 'Duree: {{hours}}h',
      icuStay: 'Sejour USI',
      legend: {
        stepDown: 'Unite de surveillance',
        floor: 'Service',
      },
    },
    medications: {
      title:
        'Medicaments (top {{count}} par frequence)',
      ariaLabel: 'Chronologie des medicaments',
      route: 'Voie:',
      dose: 'Dose:',
    },
    labs: {
      severity: {
        normal: 'Normal',
        mild: 'Leger',
        moderate: 'Modere',
        critical: 'Critique',
      },
      panels: {
        renal: 'Renal',
        hepatic: 'Hepatique',
        hematologic: 'Hematologique',
        metabolic: 'Metabolique',
        coagulation: 'Coagulation',
        cardiac: 'Cardiaque',
        inflammatory: 'Inflammatoire',
        other: 'Autre',
      },
    },
    vitals: {
      timelineTitle: 'Chronologie des signes vitaux',
      selectVitalToDisplay:
        'Selectionnez un signe vital a afficher',
      low: 'Bas:',
      high: 'Haut:',
      labels: {
        heartRate: 'Frequence cardiaque',
        bloodPressureSystolic: 'PA systolique',
        bloodPressureDiastolic: 'PA diastolique',
        respiratoryRate: 'Frequence respiratoire',
        temperature: 'Temperature',
        pain: 'Douleur',
      },
    },
  },
});

const deMorpheus: MessageTree = mergeMessageTrees(enMorpheus, {
  morpheus: {
    common: {
      navigation: {
        dashboard: 'Dashboard',
        patientJourney: 'Patientenverlauf',
        workbench: 'Workbench',
      },
      actions: {
        icuPatients: 'ICU-Patienten',
        deceased: 'Verstorben',
        browseAll: 'Alle durchsuchen',
        clearAll: 'Alles loeschen',
        exportCsv: 'CSV exportieren',
        viewInVocabularyBrowser:
          'Im Vocabulary Browser anzeigen',
      },
      loading: {
        generic: 'Wird geladen...',
        failed: 'Laden fehlgeschlagen',
        metricsFailed: 'Metriken konnten nicht geladen werden',
        patients: 'Patienten werden geladen...',
      },
      data: {
        noData: 'Keine Daten',
        noTrendData: 'Keine Trenddaten',
        noPatientsFound: 'Keine Patienten gefunden',
        noPatientsMatchFilters:
          'Keine Patienten entsprechen den aktuellen Filtern',
        noDiagnosesRecorded:
          'Keine Diagnosen dokumentiert',
        noTransferData:
          'Keine Verlegungsdaten verfuegbar',
        noMedicationData:
          'Keine Medikationsdaten verfuegbar',
        noNumericLabs:
          'Keine numerischen Laborwerte verfuegbar',
        noVitalSigns:
          'Keine Vitaldaten verfuegbar',
        noCultureData:
          'Keine Kulturdaten verfuegbar',
        noAntibiogramData:
          'Keine Antibiogrammdaten verfuegbar',
        noPopulationData:
          'Populationsdaten nicht verfuegbar',
        noGrowth: 'Kein Wachstum',
      },
      values: {
        yes: 'Ja',
        no: 'Nein',
        unknown: 'Unbekannt',
        mapped: 'Gemappt',
        unmapped: 'Nicht gemappt',
        other: 'Sonstiges',
        patients: 'Patienten',
        primary: 'Primaer',
      },
      gender: {
        male: 'Maennlich',
        female: 'Weiblich',
      },
      counts: {
        showingPatients:
          '{{shown}} von {{total}} Patienten werden angezeigt',
        testsSummary:
          '{{tests}} Tests · {{values}} numerische Werte',
        tests_one: '{{count}} Test',
        tests_other: '{{count}} Tests',
        occurrences_one: '{{count}} Ereignis',
        occurrences_other: '{{count}} Ereignisse',
        more: '+{{count}} weitere',
        patientsWithPercent:
          '{{patientCount}} von {{totalPatients}} Patienten ({{percentage}}%)',
      },
      tooltips: {
        diedInHospital: 'Im Krankenhaus verstorben',
        viewConceptInVocabularyBrowser:
          'Konzept im Vocabulary Browser anzeigen',
      },
      search: {
        patientPlaceholder:
          'Nach Subject ID suchen...',
        searching: 'Suche...',
        age: 'Alter',
      },
      filters: {
        icu: 'ICU:',
        mortality: 'Mortalitaet:',
        los: 'LOS:',
        diagnosis: 'Diagnose:',
        days: 'Tage',
        min: 'Min',
        max: 'Max',
        clinicalExpanded: '▼ Klinisch',
        clinicalCollapsed: '▸ Klinisch',
        all: 'Alle',
        survived: 'Ueberlebt',
        deceased: 'Verstorben',
        activeCount: '{{count}} aktiv',
        diagnosisPlaceholder:
          'ICD-Code oder Beschreibung suchen...',
      },
    },
    dashboard: {
      title: '{{dataset}} Populations-Dashboard',
      subtitle:
        'Aggregierte Kennzahlen fuer die stationaere Population',
      metrics: {
        patients: 'Patienten',
        admissions: 'Aufnahmen',
        icuRate: 'ICU-Rate',
        mortality: 'Mortalitaet',
        avgLos: 'Durchschn. LOS',
        avgIcuLos: 'Durchschn. ICU-LOS',
      },
      charts: {
        admissionVolume: 'Aufnahmevolumen',
        mortalityTrend: 'Mortalitaetstrend',
        gender: 'Geschlecht',
        ageDistribution: 'Altersverteilung',
        lengthOfStay: 'Verweildauer',
        topDiagnoses: 'Top 10 Diagnosen',
        topProcedures: 'Top 10 Prozeduren',
        mortalityByAdmissionType:
          'Mortalitaet nach Aufnahmetyp',
        icuUtilizationByUnit:
          'ICU-Nutzung nach Station',
        admissions: 'Aufnahmen',
        mortalityPercent: 'Mortalitaet %',
        deathsWithRate:
          '{{deaths}} Todesfaelle ({{rate}}%)',
        avgDays: '{{days}}d im Schnitt',
      },
    },
    journey: {
      patientCrumb: 'Patient {{subjectId}}',
      tabs: {
        journey: 'Verlauf',
        diagnoses: 'Diagnosen',
        medications: 'Medikamente',
        labs: 'Labore',
        vitals: 'Vitalwerte',
        microbiology: 'Mikrobiologie',
      },
      admissionPicker: {
        allAdmissions:
          'Alle Aufnahmen ({{count}})',
      },
      list: {
        subjectId: 'Subject ID',
        gender: 'Geschlecht',
        ageAnchor: 'Alter (Anker)',
        yearGroup: 'Jahresgruppe',
        admissions: 'Aufnahmen',
        icuStays: 'ICU-Aufenthalte',
        totalLos: 'Gesamte LOS',
        longestIcu: 'Laengste ICU',
        primaryDx: 'Primaerdiagnose',
        deceased: 'Verstorben',
      },
      sections: {
        topDiagnoses:
          'Haeufigste Diagnosen ({{count}} insgesamt)',
        admissions: 'Aufnahmen',
      },
      labels: {
        total: 'gesamt',
      },
    },
    eventCounts: {
      admissions: 'Aufnahmen',
      icuStays: 'ICU-Aufenthalte',
      transfers: 'Verlegungen',
      diagnoses: 'Diagnosen',
      procedures: 'Prozeduren',
      medications: 'Medikamente',
      labs: 'Labore',
      vitals: 'Vitalwerte',
      inputs: 'Zufuhr',
      outputs: 'Ausscheidung',
      micro: 'Mikro',
    },
    conceptDrawer: {
      sourceCode: 'Quellcode',
      omopConcept: 'OMOP-Konzept',
      occurrenceDetails: 'Ereignisdetails',
      thisPatient: 'Dieser Patient',
      datasetPopulation: 'Datensatzpopulation',
      date: 'Datum',
      value: 'Wert',
      route: 'Applikationsweg',
      dose: 'Dosis',
      sequence: 'Sequenz',
      mean: 'Mittelwert:',
      median: 'Median:',
      belowRange: 'Unterhalb des Bereichs ({{value}})',
      aboveRange: 'Oberhalb des Bereichs ({{value}})',
      normalRange: 'Normal ({{low}}-{{high}})',
    },
    diagnoses: {
      icdCode: 'ICD-Code',
      description: 'Beschreibung',
      standardConcept: 'Standardkonzept',
      admission: 'Aufnahme',
      sequence: 'Sequenz',
    },
    distributionChart: {
      count: 'Anzahl: {{value}}',
    },
    trendChart: {
      valueLabel: 'Wert',
      rateLabel: 'Rate',
      value: 'Wert: {{value}}',
      rate: 'Rate: {{value}}%',
    },
    truncation: {
      message:
        '{{loaded}} von {{total}} {{domain}} werden angezeigt. Ergebnisse sind aus Performancegruenden begrenzt.',
    },
    dataset: {
      inpatientFallback: 'Stationaer',
    },
    culture: {
      title: 'Kulturergebnisse',
      antibiotic: 'Antibiotikum',
      result: 'Ergebnis',
    },
    antibiogram: {
      title: 'Antibiogramm',
      allSpecimens: 'Alle Proben',
      testedOnly: 'Nur getestet',
      notTested: 'Nicht getestet',
      organism: 'Organismus',
      caution:
        '* Organismen mit <30 Isolaten - mit Vorsicht interpretieren (CLSI M39)',
      interpretation: {
        susceptible: 'Sensibel',
        intermediate: 'Intermediaer',
        resistant: 'Resistent',
      },
      classes: {
        penicillins: 'Penicilline',
        cephalosporins: 'Cephalosporine',
        carbapenems: 'Carbapeneme',
        fluoroquinolones: 'Fluorchinolone',
        aminoglycosides: 'Aminoglykoside',
        glycopeptides: 'Glykopeptide',
        macrolides: 'Makrolide',
        lincosamides: 'Lincosamide',
        tetracyclines: 'Tetrazykline',
        sulfonamides: 'Sulfonamide',
        other: 'Sonstiges',
      },
    },
    locationTrack: {
      title: 'Standortverlauf',
      ariaLabel:
        'Zeitachse des Patientenstandortverlaufs',
      discharged: 'Entlassen',
      duration: 'Dauer: {{hours}}h',
      icuStay: 'ICU-Aufenthalt',
      legend: {
        stepDown: 'Step-down',
        floor: 'Normalstation',
      },
    },
    medications: {
      title:
        'Medikamente (Top {{count}} nach Haeufigkeit)',
      ariaLabel: 'Medikationszeitachse',
      route: 'Applikationsweg:',
      dose: 'Dosis:',
    },
    labs: {
      severity: {
        normal: 'Normal',
        mild: 'Leicht',
        moderate: 'Moderat',
        critical: 'Kritisch',
      },
      panels: {
        renal: 'Renal',
        hepatic: 'Hepatisch',
        hematologic: 'Haematologisch',
        metabolic: 'Metabolisch',
        coagulation: 'Gerinnung',
        cardiac: 'Kardial',
        inflammatory: 'Entzuendlich',
        other: 'Sonstiges',
      },
    },
    vitals: {
      timelineTitle: 'Vitalwert-Zeitachse',
      selectVitalToDisplay:
        'Vitalwert zur Anzeige auswaehlen',
      low: 'Niedrig:',
      high: 'Hoch:',
      labels: {
        heartRate: 'Herzfrequenz',
        bloodPressureSystolic: 'Systolischer Blutdruck',
        bloodPressureDiastolic:
          'Diastolischer Blutdruck',
        respiratoryRate: 'Atemfrequenz',
        temperature: 'Temperatur',
        pain: 'Schmerz',
      },
    },
  },
});

const ptMorpheus: MessageTree = mergeMessageTrees(enMorpheus, {
  morpheus: {
    common: {
      navigation: {
        dashboard: 'Painel',
        patientJourney: 'Jornada do paciente',
        workbench: 'Workbench',
      },
      actions: {
        icuPatients: 'Pacientes de UTI',
        deceased: 'Obitos',
        browseAll: 'Ver todos',
        clearAll: 'Limpar tudo',
        exportCsv: 'Exportar CSV',
        viewInVocabularyBrowser:
          'Ver no navegador de vocabulario',
      },
      loading: {
        generic: 'Carregando...',
        failed: 'Falha ao carregar',
        metricsFailed:
          'Falha ao carregar metricas',
        patients: 'Carregando pacientes...',
      },
      data: {
        noData: 'Sem dados',
        noTrendData: 'Sem dados de tendencia',
        noPatientsFound: 'Nenhum paciente encontrado',
        noPatientsMatchFilters:
          'Nenhum paciente corresponde aos filtros atuais',
        noDiagnosesRecorded:
          'Nenhum diagnostico registrado',
        noTransferData:
          'Nenhum dado de transferencia disponivel',
        noMedicationData:
          'Nenhum dado de medicacao disponivel',
        noNumericLabs:
          'Nenhum resultado laboratorial numerico disponivel',
        noVitalSigns:
          'Nenhum dado de sinais vitais disponivel',
        noCultureData:
          'Nenhum dado de cultura disponivel',
        noAntibiogramData:
          'Nenhum dado de antibiograma disponivel',
        noPopulationData:
          'Dados populacionais indisponiveis',
        noGrowth: 'Sem crescimento',
      },
      values: {
        yes: 'Sim',
        no: 'Nao',
        unknown: 'Desconhecido',
        mapped: 'Mapeado',
        unmapped: 'Nao mapeado',
        other: 'Outro',
        patients: 'pacientes',
        primary: 'Principal',
      },
      gender: {
        male: 'Masculino',
        female: 'Feminino',
      },
      counts: {
        showingPatients:
          'Mostrando {{shown}} de {{total}} pacientes',
        testsSummary:
          '{{tests}} testes · {{values}} valores numericos',
        tests_one: '{{count}} teste',
        tests_other: '{{count}} testes',
        occurrences_one: '{{count}} ocorrencia',
        occurrences_other: '{{count}} ocorrencias',
        more: '+{{count}} a mais',
        patientsWithPercent:
          '{{patientCount}} de {{totalPatients}} pacientes ({{percentage}}%)',
      },
      tooltips: {
        diedInHospital: 'Obito hospitalar',
        viewConceptInVocabularyBrowser:
          'Ver conceito no navegador de vocabulario',
      },
      search: {
        patientPlaceholder:
          'Pesquisar por Subject ID...',
        searching: 'Pesquisando...',
        age: 'Idade',
      },
      filters: {
        icu: 'UTI:',
        mortality: 'Mortalidade:',
        los: 'LOS:',
        diagnosis: 'Diagnostico:',
        days: 'dias',
        min: 'Min',
        max: 'Max',
        clinicalExpanded: '▼ Clinico',
        clinicalCollapsed: '▸ Clinico',
        all: 'Todos',
        survived: 'Sobreviveu',
        deceased: 'Obito',
        activeCount: '{{count}} ativos',
        diagnosisPlaceholder:
          'Pesquisar codigo ICD ou descricao...',
      },
    },
    dashboard: {
      title: 'Painel populacional de {{dataset}}',
      subtitle:
        'Metricas agregadas de toda a populacao internada',
      metrics: {
        patients: 'Pacientes',
        admissions: 'Internacoes',
        icuRate: 'Taxa de UTI',
        mortality: 'Mortalidade',
        avgLos: 'LOS medio',
        avgIcuLos: 'LOS medio na UTI',
      },
      charts: {
        admissionVolume: 'Volume de internacoes',
        mortalityTrend: 'Tendencia de mortalidade',
        gender: 'Sexo',
        ageDistribution: 'Distribuicao por idade',
        lengthOfStay: 'Tempo de permanencia',
        topDiagnoses: 'Top 10 diagnosticos',
        topProcedures: 'Top 10 procedimentos',
        mortalityByAdmissionType:
          'Mortalidade por tipo de admissao',
        icuUtilizationByUnit:
          'Uso de UTI por unidade',
        admissions: 'Internacoes',
        mortalityPercent: 'Mortalidade %',
        deathsWithRate:
          '{{deaths}} obitos ({{rate}}%)',
        avgDays: '{{days}}d de media',
      },
    },
    journey: {
      patientCrumb: 'Paciente {{subjectId}}',
      tabs: {
        journey: 'Jornada',
        diagnoses: 'Diagnosticos',
        medications: 'Medicacoes',
        labs: 'Laboratorios',
        vitals: 'Sinais vitais',
        microbiology: 'Microbiologia',
      },
      admissionPicker: {
        allAdmissions:
          'Todas as internacoes ({{count}})',
      },
      list: {
        subjectId: 'Subject ID',
        gender: 'Sexo',
        ageAnchor: 'Idade (referencia)',
        yearGroup: 'Grupo anual',
        admissions: 'Internacoes',
        icuStays: 'Permanencias em UTI',
        totalLos: 'LOS total',
        longestIcu: 'Maior UTI',
        primaryDx: 'Diagnostico principal',
        deceased: 'Obito',
      },
      sections: {
        topDiagnoses:
          'Principais diagnosticos ({{count}} no total)',
        admissions: 'Internacoes',
      },
      labels: {
        total: 'total',
      },
    },
    eventCounts: {
      admissions: 'Internacoes',
      icuStays: 'Permanencias em UTI',
      transfers: 'Transferencias',
      diagnoses: 'Diagnosticos',
      procedures: 'Procedimentos',
      medications: 'Medicacoes',
      labs: 'Laboratorios',
      vitals: 'Sinais vitais',
      inputs: 'Entradas',
      outputs: 'Saidas',
      micro: 'Micro',
    },
    conceptDrawer: {
      sourceCode: 'Codigo-fonte',
      omopConcept: 'Conceito OMOP',
      occurrenceDetails:
        'Detalhes da ocorrencia',
      thisPatient: 'Este paciente',
      datasetPopulation:
        'Populacao do conjunto de dados',
      date: 'Data',
      value: 'Valor',
      route: 'Via',
      dose: 'Dose',
      sequence: 'Sequencia',
      mean: 'Media:',
      median: 'Mediana:',
      belowRange: 'Abaixo da faixa ({{value}})',
      aboveRange: 'Acima da faixa ({{value}})',
      normalRange: 'Normal ({{low}}-{{high}})',
    },
    diagnoses: {
      icdCode: 'Codigo ICD',
      description: 'Descricao',
      standardConcept: 'Conceito padrao',
      admission: 'Internacao',
      sequence: 'Sequencia',
    },
    distributionChart: {
      count: 'Contagem: {{value}}',
    },
    trendChart: {
      valueLabel: 'Valor',
      rateLabel: 'Taxa',
      value: 'Valor: {{value}}',
      rate: 'Taxa: {{value}}%',
    },
    truncation: {
      message:
        'Mostrando {{loaded}} de {{total}} {{domain}}. Resultados limitados por desempenho.',
    },
    dataset: {
      inpatientFallback: 'Internacao',
    },
    culture: {
      title: 'Resultados de cultura',
      antibiotic: 'Antibiotico',
      result: 'Resultado',
    },
    antibiogram: {
      title: 'Antibiograma',
      allSpecimens: 'Todos os especimes',
      testedOnly: 'Somente testados',
      notTested: 'Nao testado',
      organism: 'Organismo',
      caution:
        '* Organismos com <30 isolados - interpretar com cautela (CLSI M39)',
      interpretation: {
        susceptible: 'Suscetivel',
        intermediate: 'Intermediario',
        resistant: 'Resistente',
      },
      classes: {
        penicillins: 'Penicilinas',
        cephalosporins: 'Cefalosporinas',
        carbapenems: 'Carbapenemicos',
        fluoroquinolones: 'Fluoroquinolonas',
        aminoglycosides: 'Aminoglicosideos',
        glycopeptides: 'Glicopeptideos',
        macrolides: 'Macrolideos',
        lincosamides: 'Lincosamidas',
        tetracyclines: 'Tetraciclinas',
        sulfonamides: 'Sulfonamidas',
        other: 'Outro',
      },
    },
    locationTrack: {
      title: 'Trilha de localizacao',
      ariaLabel:
        'Linha do tempo da localizacao do paciente',
      discharged: 'Alta',
      duration: 'Duracao: {{hours}}h',
      icuStay: 'Permanencia em UTI',
      legend: {
        stepDown: 'Semi-intensiva',
        floor: 'Enfermaria',
      },
    },
    medications: {
      title:
        'Medicacoes (top {{count}} por frequencia)',
      ariaLabel: 'Linha do tempo de medicacoes',
      route: 'Via:',
      dose: 'Dose:',
    },
    labs: {
      severity: {
        normal: 'Normal',
        mild: 'Leve',
        moderate: 'Moderado',
        critical: 'Critico',
      },
      panels: {
        renal: 'Renal',
        hepatic: 'Hepatico',
        hematologic: 'Hematologico',
        metabolic: 'Metabolico',
        coagulation: 'Coagulacao',
        cardiac: 'Cardiaco',
        inflammatory: 'Inflamatorio',
        other: 'Outro',
      },
    },
    vitals: {
      timelineTitle:
        'Linha do tempo dos sinais vitais',
      selectVitalToDisplay:
        'Selecione um sinal vital para exibir',
      low: 'Min:',
      high: 'Max:',
      labels: {
        heartRate: 'Frequencia cardiaca',
        bloodPressureSystolic:
          'Pressao arterial sistolica',
        bloodPressureDiastolic:
          'Pressao arterial diastolica',
        respiratoryRate:
          'Frequencia respiratoria',
        temperature: 'Temperatura',
        pain: 'Dor',
      },
    },
  },
});

export const morpheusResources: Record<string, MessageTree> = {
  'en-US': enMorpheus,
  'es-ES': mergeMessageTrees(enMorpheus, {}),
  'fr-FR': frMorpheus,
  'de-DE': deMorpheus,
  'pt-BR': ptMorpheus,
  'fi-FI': mergeMessageTrees(enMorpheus, {}),
  'ja-JP': mergeMessageTrees(enMorpheus, {}),
  'zh-Hans': mergeMessageTrees(enMorpheus, {}),
  'ko-KR': mergeMessageTrees(enMorpheus, {}),
  'hi-IN': mergeMessageTrees(enMorpheus, {}),
  ar: mergeMessageTrees(enMorpheus, {}),
  'en-XA': mergeMessageTrees(enMorpheus, {}),
};
