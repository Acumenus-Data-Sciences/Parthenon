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

const esAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "Constructor inteligente de cohortes",
      newQuery: "Nueva consulta",
      examplesTitle: "Pruebe un ejemplo",
      examples: {
        diabetesMetformin:
          "Pacientes con diabetes tipo 2 tratados con metformina",
        aceInhibitors:
          "Nuevos usuarios de inhibidores de la ECA sin insuficiencia cardiaca previa",
        hipFracture:
          "Pacientes de 65 anos o mas con primera fractura de cadera",
        breastCancerChemo:
          "Mujeres con cancer de mama que recibieron quimioterapia",
      },
      analyzing: "Abby esta analizando su pregunta de investigacion",
      errorTitle: "Algo salio mal",
      errorFallback:
        "No se pudo procesar su solicitud. Intentelo de nuevo.",
      analysisTitle: "Analisis",
      conceptSetsTitle: "Conjuntos de conceptos ({{count}})",
      conceptsCount_one: "{{count}} concepto",
      conceptsCount_other: "{{count}} conceptos",
      applyToBuilder: "Aplicar al constructor",
      refine: "Refinar",
      refinePlaceholder: "Como le gustaria modificar esta cohorte?",
      refineCohort: "Refinar cohorte",
      promptPlaceholder: "Describa su poblacion objetivo...",
      buildCohort: "Construir cohorte",
    },
    plan: {
      title: "Plan de accion",
      status: {
        executing: "Ejecutando...",
        completed: "Completado",
        failed: "Fallido",
        cancelled: "Cancelado",
      },
      actions: {
        approveAndExecute: "Aprobar y ejecutar",
        cancel: "Cancelar",
      },
      runningSteps: "Ejecutando pasos del plan...",
      success: "Todos los pasos se completaron correctamente.",
      failure:
        "Uno o mas pasos fallaron. Los pasos restantes se omitieron.",
    },
    profile: {
      loading: "Cargando perfil...",
      failed: "No se pudo cargar el perfil",
      title: "Mi perfil de investigacion",
      reset: "Restablecer",
      researchInterests: "Intereses de investigacion",
      expertise: "Experiencia",
      responseStyle: "Estilo de respuesta",
      verbosity: {
        terse: "Conciso",
        normal: "Estandar",
        verbose: "Detallado",
      },
      learningMessage:
        "Abby esta aprendiendo sobre sus intereses de investigacion. Siga conversando y construira su perfil automaticamente.",
    },
  },
});

const koAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "지능형 코호트 빌더",
      newQuery: "새 질의",
      examplesTitle: "예시 보기",
      examples: {
        diabetesMetformin: "메트포르민을 복용 중인 제2형 당뇨병 환자",
        aceInhibitors:
          "이전 심부전 병력이 없는 ACE 억제제 신규 사용자",
        hipFracture: "첫 고관절 골절을 경험한 65세 이상 환자",
        breastCancerChemo: "항암치료를 받은 유방암 여성 환자",
      },
      analyzing: "Abby가 연구 질문을 분석하고 있습니다",
      errorTitle: "문제가 발생했습니다",
      errorFallback:
        "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      analysisTitle: "분석",
      conceptSetsTitle: "개념 집합 ({{count}})",
      conceptsCount_one: "{{count}}개 개념",
      conceptsCount_other: "{{count}}개 개념",
      applyToBuilder: "빌더에 적용",
      refine: "구체화",
      refinePlaceholder: "이 코호트를 어떻게 수정하시겠습니까?",
      refineCohort: "코호트 구체화",
      promptPlaceholder: "대상 집단을 설명해 주세요...",
      buildCohort: "코호트 생성",
    },
    plan: {
      title: "실행 계획",
      status: {
        executing: "실행 중...",
        completed: "완료됨",
        failed: "실패",
        cancelled: "취소됨",
      },
      actions: {
        approveAndExecute: "승인 후 실행",
        cancel: "취소",
      },
      runningSteps: "계획 단계를 실행하는 중...",
      success: "모든 단계가 성공적으로 완료되었습니다.",
      failure:
        "하나 이상의 단계가 실패했습니다. 나머지 단계는 건너뛰었습니다.",
    },
    profile: {
      loading: "프로필을 불러오는 중...",
      failed: "프로필을 불러오지 못했습니다",
      title: "내 연구 프로필",
      reset: "재설정",
      researchInterests: "연구 관심 분야",
      expertise: "전문성",
      responseStyle: "응답 스타일",
      verbosity: {
        terse: "간결함",
        normal: "표준",
        verbose: "자세함",
      },
      learningMessage:
        "Abby가 연구 관심사를 학습하고 있습니다. 계속 대화하면 자동으로 프로필을 구축합니다.",
    },
  },
});

const hiAbbyLegacy: MessageTree = mergeMessageTrees(enAbbyLegacy, {
  abbyLegacy: {
    panel: {
      title: "Abby AI",
      subtitle: "बुद्धिमान कोहोर्ट बिल्डर",
      newQuery: "नई क्वेरी",
      examplesTitle: "एक उदाहरण आजमाएं",
      examples: {
        diabetesMetformin: "मेटफॉर्मिन लेने वाले टाइप 2 डायबिटीज रोगी",
        aceInhibitors:
          "पूर्व हृदय विफलता के बिना ACE inhibitors के नए उपयोगकर्ता",
        hipFracture: "पहली कूल्हे की फ्रैक्चर वाले 65+ आयु के रोगी",
        breastCancerChemo:
          "कीमोथेरेपी प्राप्त करने वाली स्तन कैंसर की महिलाएं",
      },
      analyzing: "Abby आपके शोध प्रश्न का विश्लेषण कर रही है",
      errorTitle: "कुछ गलत हो गया",
      errorFallback:
        "आपका अनुरोध संसाधित नहीं किया जा सका। कृपया फिर से प्रयास करें।",
      analysisTitle: "विश्लेषण",
      conceptSetsTitle: "कॉन्सेप्ट सेट ({{count}})",
      conceptsCount_one: "{{count}} कॉन्सेप्ट",
      conceptsCount_other: "{{count}} कॉन्सेप्ट",
      applyToBuilder: "बिल्डर पर लागू करें",
      refine: "परिष्कृत करें",
      refinePlaceholder: "आप इस कोहोर्ट को कैसे बदलना चाहते हैं?",
      refineCohort: "कोहोर्ट परिष्कृत करें",
      promptPlaceholder: "अपनी लक्षित आबादी का वर्णन करें...",
      buildCohort: "कोहोर्ट बनाएं",
    },
    plan: {
      title: "कार्य योजना",
      status: {
        executing: "निष्पादित हो रहा है...",
        completed: "पूर्ण",
        failed: "विफल",
        cancelled: "रद्द",
      },
      actions: {
        approveAndExecute: "स्वीकृत करें और चलाएं",
        cancel: "रद्द करें",
      },
      runningSteps: "योजना के चरण चल रहे हैं...",
      success: "सभी चरण सफलतापूर्वक पूरे हुए।",
      failure:
        "एक या अधिक चरण विफल हुए। शेष चरणों को छोड़ दिया गया।",
    },
    profile: {
      loading: "प्रोफाइल लोड हो रही है...",
      failed: "प्रोफाइल लोड नहीं हो सकी",
      title: "मेरा शोध प्रोफाइल",
      reset: "रीसेट करें",
      researchInterests: "शोध रुचियां",
      expertise: "विशेषज्ञता",
      responseStyle: "प्रतिक्रिया शैली",
      verbosity: {
        terse: "संक्षिप्त",
        normal: "मानक",
        verbose: "विस्तृत",
      },
      learningMessage:
        "Abby आपकी शोध रुचियों के बारे में सीख रही है। बातचीत जारी रखें और वह आपका प्रोफाइल अपने आप बनाएगी।",
    },
  },
});

export const abbyLegacyResources: Record<string, MessageTree> = {
  "en-US": enAbbyLegacy,
  "es-ES": esAbbyLegacy,
  "fr-FR": frAbbyLegacy,
  "de-DE": deAbbyLegacy,
  "pt-BR": ptAbbyLegacy,
  "fi-FI": mergeMessageTrees(enAbbyLegacy, {}),
  "ja-JP": mergeMessageTrees(enAbbyLegacy, {}),
  "zh-Hans": mergeMessageTrees(enAbbyLegacy, {}),
  "ko-KR": koAbbyLegacy,
  "hi-IN": hiAbbyLegacy,
  ar: mergeMessageTrees(enAbbyLegacy, {}),
  "en-XA": mergeMessageTrees(enAbbyLegacy, {}),
};
