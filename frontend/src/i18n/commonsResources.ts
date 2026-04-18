type MessageTree = {
  [key: string]: string | MessageTree;
};

const enCommons: MessageTree = {
  page: {
    title: "Commons",
    loading: "Loading...",
    whatsNew: "What's New",
    announcements: "Announcements",
    knowledgeBase: "Knowledge Base",
  },
  channel: {
    label: "Commons Channel",
    fallbackDescription:
      "Discuss ideas, share files, and collaborate with the rest of the Commons.",
    members: "Members",
    active: "Active",
  },
  call: {
    start: "Start call",
    starting: "Starting...",
    join: "Join call",
    ending: "Ending...",
    end: "End",
    startFailed: "Unable to start LiveKit call",
    endFailed: "Unable to end LiveKit call",
  },
  sidebar: {
    searchPlaceholder: "Search channels...",
    channels: "Channels",
    createChannel: "Create channel",
    aiAssistant: "AI Assistant",
    studyChannels: "Study Channels",
    directMessages: "Direct Messages",
    newMessage: "New message",
    emptyDirectMessages:
      "Start a conversation from the + button or the online roster",
    unknownUser: "Unknown",
  },
  announcements: {
    title: "Announcements",
    allCategories: "All categories",
    new: "New",
    loading: "Loading...",
    emptyTitle: "No announcements yet",
    emptyMessage: "Post updates, study recruitment notices, and milestones",
    bookmark: "Bookmark",
    removeBookmark: "Remove bookmark",
    delete: "Delete",
    expires: "Expires {{date}}",
    modal: {
      title: "New Announcement",
      cancel: "Cancel",
      posting: "Posting...",
      post: "Post Announcement",
    },
    form: {
      title: "Title",
      titlePlaceholder: "Announcement title",
      body: "Body",
      bodyPlaceholder: "Write your announcement...",
      category: "Category",
      pinToTop: "Pin to top",
    },
    categories: {
      general: "General",
      studyRecruitment: "Study Recruitment",
      dataUpdate: "Data Update",
      milestone: "Milestone",
      policy: "Policy",
    },
  },
};

const esCommons: MessageTree = {
  page: {
    title: "Recursos compartidos",
    loading: "Cargando...",
    whatsNew: "Novedades",
    announcements: "Anuncios",
    knowledgeBase: "Base de conocimiento",
  },
  channel: {
    label: "Canal de recursos compartidos",
    fallbackDescription:
      "Comparte ideas, archivos y colabora con el resto del espacio compartido.",
    members: "Miembros",
    active: "Activos",
  },
  call: {
    start: "Iniciar llamada",
    starting: "Iniciando...",
    join: "Unirse a la llamada",
    ending: "Finalizando...",
    end: "Finalizar",
    startFailed: "No se pudo iniciar la llamada de LiveKit",
    endFailed: "No se pudo finalizar la llamada de LiveKit",
  },
  sidebar: {
    searchPlaceholder: "Buscar canales...",
    channels: "Canales",
    createChannel: "Crear canal",
    aiAssistant: "Asistente de IA",
    studyChannels: "Canales de estudio",
    directMessages: "Mensajes directos",
    newMessage: "Nuevo mensaje",
    emptyDirectMessages:
      "Inicia una conversación con el botón + o desde la lista de usuarios en línea",
    unknownUser: "Desconocido",
  },
  announcements: {
    title: "Anuncios",
    allCategories: "Todas las categorías",
    new: "Nuevo",
    loading: "Cargando...",
    emptyTitle: "Aún no hay anuncios",
    emptyMessage:
      "Publica actualizaciones, avisos de reclutamiento de estudios e hitos",
    bookmark: "Marcar",
    removeBookmark: "Quitar marcador",
    delete: "Eliminar",
    expires: "Caduca el {{date}}",
    modal: {
      title: "Nuevo anuncio",
      cancel: "Cancelar",
      posting: "Publicando...",
      post: "Publicar anuncio",
    },
    form: {
      title: "Título",
      titlePlaceholder: "Título del anuncio",
      body: "Contenido",
      bodyPlaceholder: "Escribe tu anuncio...",
      category: "Categoría",
      pinToTop: "Fijar arriba",
    },
    categories: {
      general: "General",
      studyRecruitment: "Reclutamiento de estudio",
      dataUpdate: "Actualización de datos",
      milestone: "Hito",
      policy: "Política",
    },
  },
};

const koCommons: MessageTree = {
  page: {
    title: "공유재",
    loading: "불러오는 중...",
    whatsNew: "새로운 소식",
    announcements: "공지",
    knowledgeBase: "지식 베이스",
  },
  channel: {
    label: "공유재 채널",
    fallbackDescription:
      "아이디어와 파일을 공유하고 공유재 구성원들과 협업하세요.",
    members: "멤버",
    active: "활성",
  },
  call: {
    start: "통화 시작",
    starting: "시작 중...",
    join: "통화 참여",
    ending: "종료 중...",
    end: "종료",
    startFailed: "LiveKit 통화를 시작할 수 없습니다",
    endFailed: "LiveKit 통화를 종료할 수 없습니다",
  },
  sidebar: {
    searchPlaceholder: "채널 검색...",
    channels: "채널",
    createChannel: "채널 만들기",
    aiAssistant: "AI 어시스턴트",
    studyChannels: "연구 채널",
    directMessages: "다이렉트 메시지",
    newMessage: "새 메시지",
    emptyDirectMessages:
      "+ 버튼이나 온라인 명단에서 대화를 시작하세요",
    unknownUser: "알 수 없음",
  },
  announcements: {
    title: "공지",
    allCategories: "모든 범주",
    new: "새 공지",
    loading: "불러오는 중...",
    emptyTitle: "아직 공지가 없습니다",
    emptyMessage: "업데이트, 연구 모집 공지, 주요 이정표를 게시하세요",
    bookmark: "북마크",
    removeBookmark: "북마크 제거",
    delete: "삭제",
    expires: "{{date}} 만료",
    modal: {
      title: "새 공지",
      cancel: "취소",
      posting: "게시 중...",
      post: "공지 게시",
    },
    form: {
      title: "제목",
      titlePlaceholder: "공지 제목",
      body: "내용",
      bodyPlaceholder: "공지 내용을 작성하세요...",
      category: "범주",
      pinToTop: "상단에 고정",
    },
    categories: {
      general: "일반",
      studyRecruitment: "연구 모집",
      dataUpdate: "데이터 업데이트",
      milestone: "이정표",
      policy: "정책",
    },
  },
};

export const commonsResources: Record<string, MessageTree> = {
  "en-US": enCommons,
  "es-ES": esCommons,
  "ko-KR": koCommons,
};
