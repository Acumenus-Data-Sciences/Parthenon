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

export const morpheusResources: Record<string, MessageTree> = {
  'en-US': enMorpheus,
  'es-ES': mergeMessageTrees(enMorpheus, {}),
  'fr-FR': mergeMessageTrees(enMorpheus, {}),
  'de-DE': mergeMessageTrees(enMorpheus, {}),
  'pt-BR': mergeMessageTrees(enMorpheus, {}),
  'fi-FI': mergeMessageTrees(enMorpheus, {}),
  'ja-JP': mergeMessageTrees(enMorpheus, {}),
  'zh-Hans': mergeMessageTrees(enMorpheus, {}),
  'ko-KR': mergeMessageTrees(enMorpheus, {}),
  'hi-IN': mergeMessageTrees(enMorpheus, {}),
  ar: mergeMessageTrees(enMorpheus, {}),
  'en-XA': mergeMessageTrees(enMorpheus, {}),
};
