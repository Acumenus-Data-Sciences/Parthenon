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

const frAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "Constructeur intelligent de cohortes",
      newQuery: "Nouvelle requete",
      examplesTitle: "Essayez un exemple",
      examples: {
        diabetesMetformin:
          "Patients atteints de diabete de type 2 sous metformine",
        aceInhibitors:
          "Nouveaux utilisateurs d'inhibiteurs de l'ECA sans insuffisance cardiaque anterieure",
        hipFracture:
          "Patients ages de 65 ans et plus avec premiere fracture de la hanche",
        breastCancerChemo:
          "Femmes atteintes d'un cancer du sein ayant recu une chimiotherapie",
      },
      analyzing: "Abby analyse votre question de recherche",
      errorTitle: "Un probleme est survenu",
      errorFallback:
        "Echec du traitement de votre demande. Veuillez reessayer.",
      analysisTitle: "Analyse",
      conceptSetsTitle: "Ensembles de concepts ({{count}})",
      conceptsCount_one: "{{count}} concept",
      conceptsCount_other: "{{count}} concepts",
      applyToBuilder: "Appliquer au constructeur",
      refine: "Affiner",
      refinePlaceholder: "Comment souhaitez-vous modifier cette cohorte ?",
      refineCohort: "Affiner la cohorte",
      promptPlaceholder: "Decrivez votre population cible...",
      buildCohort: "Construire la cohorte",
    },
    plan: {
      title: "Plan d'action",
      status: {
        executing: "Execution...",
        completed: "Termine",
        failed: "Echec",
        cancelled: "Annule",
      },
      actions: {
        approveAndExecute: "Approuver et executer",
        cancel: "Annuler",
      },
      runningSteps: "Execution des etapes du plan...",
      success: "Toutes les etapes se sont terminees avec succes.",
      failure:
        "Une ou plusieurs etapes ont echoue. Les etapes restantes ont ete ignorees.",
    },
    profile: {
      loading: "Chargement du profil...",
      failed: "Echec du chargement du profil",
      title: "Mon profil de recherche",
      reset: "Reinitialiser",
      researchInterests: "Interets de recherche",
      expertise: "Expertise",
      responseStyle: "Style de reponse",
      verbosity: {
        terse: "Concis",
        normal: "Standard",
        verbose: "Detaille",
      },
      learningMessage:
        "Abby apprend vos interets de recherche. Continuez a discuter et elle construira automatiquement votre profil.",
    },
  },
});

const deAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "Intelligenter Kohorten-Builder",
      newQuery: "Neue Abfrage",
      examplesTitle: "Beispiel ausprobieren",
      examples: {
        diabetesMetformin:
          "Patienten mit Typ-2-Diabetes unter Metformin",
        aceInhibitors:
          "Neue Anwender von ACE-Hemmern ohne fruehere Herzinsuffizienz",
        hipFracture:
          "Patienten ab 65 Jahren mit erster Hueftfraktur",
        breastCancerChemo:
          "Frauen mit Brustkrebs, die eine Chemotherapie erhalten haben",
      },
      analyzing: "Abby analysiert Ihre Forschungsfrage",
      errorTitle: "Etwas ist schiefgelaufen",
      errorFallback:
        "Ihre Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
      analysisTitle: "Analyse",
      conceptSetsTitle: "Konzeptsets ({{count}})",
      conceptsCount_one: "{{count}} Konzept",
      conceptsCount_other: "{{count}} Konzepte",
      applyToBuilder: "Auf Builder anwenden",
      refine: "Verfeinern",
      refinePlaceholder: "Wie moechten Sie diese Kohorte anpassen?",
      refineCohort: "Kohorte verfeinern",
      promptPlaceholder: "Beschreiben Sie Ihre Zielpopulation...",
      buildCohort: "Kohorte erstellen",
    },
    plan: {
      title: "Aktionsplan",
      status: {
        executing: "Wird ausgefuehrt...",
        completed: "Abgeschlossen",
        failed: "Fehlgeschlagen",
        cancelled: "Abgebrochen",
      },
      actions: {
        approveAndExecute: "Genehmigen und ausfuehren",
        cancel: "Abbrechen",
      },
      runningSteps: "Planschritte werden ausgefuehrt...",
      success: "Alle Schritte wurden erfolgreich abgeschlossen.",
      failure:
        "Ein oder mehrere Schritte sind fehlgeschlagen. Die verbleibenden Schritte wurden uebersprungen.",
    },
    profile: {
      loading: "Profil wird geladen...",
      failed: "Profil konnte nicht geladen werden",
      title: "Mein Forschungsprofil",
      reset: "Zuruecksetzen",
      researchInterests: "Forschungsinteressen",
      expertise: "Expertise",
      responseStyle: "Antwortstil",
      verbosity: {
        terse: "Kurz",
        normal: "Standard",
        verbose: "Detailliert",
      },
      learningMessage:
        "Abby lernt Ihre Forschungsinteressen kennen. Chatten Sie weiter, und sie erstellt Ihr Profil automatisch.",
    },
  },
});

const ptAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "Construtor inteligente de coortes",
      newQuery: "Nova consulta",
      examplesTitle: "Experimente um exemplo",
      examples: {
        diabetesMetformin:
          "Pacientes com diabetes tipo 2 usando metformina",
        aceInhibitors:
          "Novos usuarios de inibidores da ECA sem insuficiencia cardiaca previa",
        hipFracture:
          "Pacientes com 65 anos ou mais com primeira fratura de quadril",
        breastCancerChemo:
          "Mulheres com cancer de mama que receberam quimioterapia",
      },
      analyzing: "Abby esta analisando sua pergunta de pesquisa",
      errorTitle: "Algo deu errado",
      errorFallback:
        "Falha ao processar sua solicitacao. Tente novamente.",
      analysisTitle: "Analise",
      conceptSetsTitle: "Conjuntos de conceitos ({{count}})",
      conceptsCount_one: "{{count}} conceito",
      conceptsCount_other: "{{count}} conceitos",
      applyToBuilder: "Aplicar ao construtor",
      refine: "Refinar",
      refinePlaceholder: "Como voce gostaria de modificar esta coorte?",
      refineCohort: "Refinar coorte",
      promptPlaceholder: "Descreva sua populacao-alvo...",
      buildCohort: "Construir coorte",
    },
    plan: {
      title: "Plano de acao",
      status: {
        executing: "Executando...",
        completed: "Concluido",
        failed: "Falhou",
        cancelled: "Cancelado",
      },
      actions: {
        approveAndExecute: "Aprovar e executar",
        cancel: "Cancelar",
      },
      runningSteps: "Executando etapas do plano...",
      success: "Todas as etapas foram concluidas com sucesso.",
      failure:
        "Uma ou mais etapas falharam. As etapas restantes foram ignoradas.",
    },
    profile: {
      loading: "Carregando perfil...",
      failed: "Falha ao carregar perfil",
      title: "Meu perfil de pesquisa",
      reset: "Redefinir",
      researchInterests: "Interesses de pesquisa",
      expertise: "Especialidade",
      responseStyle: "Estilo de resposta",
      verbosity: {
        terse: "Conciso",
        normal: "Padrao",
        verbose: "Detalhado",
      },
      learningMessage:
        "Abby esta aprendendo sobre seus interesses de pesquisa. Continue conversando e ela criara seu perfil automaticamente.",
    },
  },
});

export const abbyLegacyResources: Record<string, MessageTree> = {
  "en-US": enAbbyLegacy,
  "es-ES": mergeMessageTrees(enAbbyLegacy, {}),
  "fr-FR": frAbbyLegacy,
  "de-DE": deAbbyLegacy,
  "pt-BR": ptAbbyLegacy,
  "fi-FI": mergeMessageTrees(enAbbyLegacy, {}),
  "ja-JP": mergeMessageTrees(enAbbyLegacy, {}),
  "zh-Hans": mergeMessageTrees(enAbbyLegacy, {}),
  "ko-KR": mergeMessageTrees(enAbbyLegacy, {}),
  "hi-IN": mergeMessageTrees(enAbbyLegacy, {}),
  ar: mergeMessageTrees(enAbbyLegacy, {}),
  "en-XA": mergeMessageTrees(enAbbyLegacy, {}),
};
