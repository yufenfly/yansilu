export function deriveWritingProjectIntent({ title = "", goal = "", indexCard = null } = {}) {
  const cleanGoal = String(goal || "").trim();
  if (cleanGoal) return cleanGoal;
  const centralQuestion = String(indexCard?.central_question || indexCard?.centralQuestion || indexCard?.summary || "").trim();
  if (centralQuestion) return centralQuestion;
  const cleanTitle = String(title || "").trim();
  return cleanTitle ? `说明「${cleanTitle}」这组材料到底想表达什么判断。` : "";
}

export function deriveWritingProjectTakeaway({ title = "", goal = "", audience = "", indexCard = null } = {}) {
  const cleanAudience = String(audience || "").trim();
  const base = deriveWritingProjectIntent({ title, goal, indexCard });
  if (!base) return "";
  return cleanAudience ? `${cleanAudience} 读完后应带走这个判断：${base}` : `读者读完后应带走这个判断：${base}`;
}

export function mapDirectoryItem(item) {
  return {
    id: item.id,
    name: item.title,
    parentId: item.parentDirectoryId,
    isDefault: Boolean(item.isDefault),
    hidden: Boolean(item.isHidden),
    maxCards: Number(item.maxNotes || 500),
    fsPath: item.fsPath || ""
  };
}

export function mapNoteItem(item, {
  generatedOriginalNoteIdFromBody,
  normalizeAuthorshipItem,
  normalizeOptionalNumber,
  normalizeThinkingStatusItem,
  relationNetworkStatusForNote,
  state,
  typeFromFolder
} = {}) {
  const body = item.body || `# ${item.title || "未命名笔记"}\n`;
  const folderId = item.directoryId || item.folderId || "";
  const noteType = (folderId ? typeFromFolder(state, folderId) : "") || item.noteType || "original";
  const normalizedAuthorship =
    normalizeAuthorshipItem(item.authorship) ||
    normalizeAuthorshipItem({
      user_confirmed: item.authorshipConfirmed ?? item.authorship_confirmed,
      ai_assisted: item.authorshipAiAssisted ?? item.authorship_ai_assisted
    });
  return {
    id: item.id,
    title: item.title || "未命名笔记",
    folderId,
    noteType,
    status: item.status || "draft",
    markdownPath: item.markdownPath || "",
    body,
    originalityStatus: item.originalityStatus || item.originality_status || "",
    originalitySimilarity: normalizeOptionalNumber(item.originalitySimilarity ?? item.originality_similarity),
    authorship: normalizedAuthorship,
    thesis: item.thesis || "",
    threeLineSummary: Array.isArray(item.threeLineSummary || item.three_line_summary)
      ? item.threeLineSummary || item.three_line_summary
      : [],
    distillationStatus: item.distillationStatus || item.distillation_status || "",
    startingQuestion: item.startingQuestion || item.starting_question || "",
    viewpointHistory: Array.isArray(item.viewpointHistory || item.viewpoint_history)
      ? item.viewpointHistory || item.viewpoint_history
      : [],
    pendingViewpointRevision: item.pendingViewpointRevision || item.pending_viewpoint_revision || null,
    thinkingStatus: normalizeThinkingStatusItem(item.thinkingStatus),
    generatedOriginalNoteId:
      String(item.generatedOriginalNoteId || item.generated_original_note_id || generatedOriginalNoteIdFromBody(body)).trim(),
    relationNetworkStatus: relationNetworkStatusForNote({
      id: item.id,
      folderId,
      noteType,
      relationNetworkStatus: item.relationNetworkStatus || item.relation_network_status || ""
    }),
    boundaryOrCounterpoint: item.boundaryOrCounterpoint || item.boundary_or_counterpoint || "",
    tags: [],
    links: [],
    bodyLoaded: Boolean(item.body),
    updatedAt: item.updatedAt || new Date().toISOString(),
    isLocalOnly: Boolean(item.isLocalOnly)
  };
}

export function createLocalDraftNote({ folderId, body }, {
  ensureEditableNoteBody,
  generatedOriginalNoteIdFromBody,
  relationNetworkStatusForNote,
  typeFromFolder,
  uid,
  state
} = {}) {
  const nextBody = ensureEditableNoteBody(body);
  const noteType = typeFromFolder(state, folderId);
  const noteId = uid("local_note");
  return {
    id: noteId,
    title: "未命名笔记",
    folderId,
    noteType,
    status: "draft",
    markdownPath: "",
    body: nextBody,
    originalityStatus: "",
    originalitySimilarity: null,
    authorship: null,
    thesis: "",
    threeLineSummary: [],
    distillationStatus: "",
    startingQuestion: "",
    viewpointHistory: [],
    pendingViewpointRevision: null,
    thinkingStatus: null,
    generatedOriginalNoteId: generatedOriginalNoteIdFromBody(nextBody),
    relationNetworkStatus: relationNetworkStatusForNote({
      id: noteId,
      folderId,
      noteType
    }),
    boundaryOrCounterpoint: "",
    tags: [],
    links: [],
    bodyLoaded: true,
    updatedAt: new Date().toISOString(),
    isLocalOnly: true
  };
}

export function moduleLabel(moduleName = "") {
  const labels = {
    today: "首页",
    explorer: "笔记编辑",
    backup: "备份与恢复",
    imports: "导入导出",
    aiInbox: "AI 建议",
    distillation: "观点提纯",
    graph: "关系图谱",
    writing: "写作",
    settings: "设置"
  };
  return labels[String(moduleName || "").trim()] || "工作台";
}

export function displayFolderName(folder) {
  if (!folder) return "目录";
  if (folder.id === "dir_original_default") return "永久笔记盒";
  if (folder.id === "dir_fleeting_default") return "随笔卡片盒";
  if (folder.id === "dir_literature_default") return "文献卡片盒";
  if (!folder.parentId && String(folder.name || "").trim() === "永久笔记目录") return "永久笔记盒";
  return folder.name || "目录";
}

export function directoryPathLabel(directoryId, { folderById, state } = {}) {
  const folder = folderById(state, directoryId);
  if (!folder) return "未选择目录";
  const names = [displayFolderName(folder)];
  let cursor = folder;
  while (cursor?.parentId) {
    cursor = folderById(state, cursor.parentId);
    if (cursor) names.unshift(displayFolderName(cursor));
  }
  return names.join(" / ");
}

export function noteTypeLabel(noteType = "") {
  const labels = {
    fleeting: "随笔记",
    literature: "文献笔记",
    original: "永久笔记",
    permanent: "永久笔记"
  };
  return labels[String(noteType || "").trim().toLowerCase()] || "笔记";
}

export function distillationStatusOf(note = null) {
  const explicit = String(note?.distillationStatus || "").trim().toLowerCase();
  if (explicit === "confirmed") return "confirmed";
  const thesis = String(note?.thesis || "").trim();
  const summary = Array.isArray(note?.threeLineSummary) ? note.threeLineSummary.filter((item) => String(item || "").trim()) : [];
  if (explicit === "draft" || thesis || summary.length) return "draft";
  return "missing";
}

export function distillationReasonOf(note = null) {
  const thesis = String(note?.thesis || "").trim();
  const status = distillationStatusOf(note);
  if (status === "confirmed") return "已确认观点";
  if (!thesis) return "待写一句话判断";
  return "待确认观点";
}

export function distillationStatusLabel(status = "") {
  const labels = {
    missing: "待提纯",
    draft: "待确认",
    confirmed: "已确认"
  };
  return labels[String(status || "").trim().toLowerCase()] || "待提纯";
}

export function writingProjectStatusLabel(status = "") {
  const labels = {
    draft: "草稿中",
    active: "进行中",
    paused: "已暂停",
    archived: "已归档",
    completed: "已完成"
  };
  const normalized = String(status || "").trim().toLowerCase();
  return labels[normalized] || String(status || "").trim() || "草稿中";
}

export function distillationStageOf(note = null) {
  const status = distillationStatusOf(note);
  const thesis = String(note?.thesis || "").trim();
  if (status === "confirmed") return "confirmed";
  if (!thesis) return "needs_thesis";
  return "needs_confirm";
}

export function distillationStageLabel(stage = "") {
  const labels = {
    needs_thesis: "待一句话判断",
    needs_confirm: "待确认",
    confirmed: "已确认"
  };
  return labels[String(stage || "").trim()] || "全部";
}

export function saveAiSuggestionKey(note = null, action = "") {
  const noteId = String(note?.id || "").trim();
  const body = String(note?.body || "");
  const contentFingerprint = `${body.length}:${body.slice(0, 80)}`;
  const savedAt = String(note?.updatedAt || note?.updated_at || contentFingerprint).trim();
  return `${noteId}:${savedAt}:${String(action || "").trim()}`;
}

export function sourceNoteTypeLabel(noteType = "") {
  if (noteType === "literature") return "文献笔记";
  if (noteType === "fleeting") return "随笔";
  return "来源笔记";
}

export function noteMatchesSearchQuery(note = null, query = "") {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return true;
  const target = `${note?.title || ""}\n${note?.body || ""}\n${(note?.tags || []).join(" ")}`.toLowerCase();
  return target.includes(normalized);
}

export function workflowMessageDedupeKey(noteId = "", category = "", focus = "") {
  return [String(category || "").trim(), String(noteId || "").trim(), String(focus || "").trim()].filter(Boolean).join(":");
}

export function sourcePromotionWorkflowMessageForNote(note = null, suggestion = null, {
  isOriginalRecordableSource,
  noteHasGeneratedOriginal,
  state,
  typeFromFolder
} = {}) {
  if (!note?.id || !isOriginalRecordableSource(note) || noteHasGeneratedOriginal(note)) return null;
  const noteType = String((note?.folderId ? typeFromFolder(state, note.folderId) : "") || note?.noteType || "").trim().toLowerCase();
  const focus = "record-permanent";
  const dedupeKey = workflowMessageDedupeKey(note.id, "source-promotion", focus);
  const isLiterature = noteType === "literature";
  const actionLabel = isLiterature ? "提炼为永久笔记" : "提炼为永久笔记";
  const noteTitle = String(note.title || note.id || "未命名笔记").trim() || "未命名笔记";
  const title = isLiterature ? `${noteTitle} 适合生成永久笔记` : `${noteTitle} 适合生成永久笔记`;
  const body = isLiterature
    ? `“${noteTitle}”已经保存。打开它后可以继续整理来源、转述和判断种子，并把成熟材料提炼为永久笔记。`
    : `“${noteTitle}”已经保存。随笔只是临时记录；如果它值得长期保留，下一步是把它写成一条自己愿意承担的永久判断。`;
  return {
    id: `workflow:${dedupeKey}`,
    type: "workflow",
    category: "source-promotion",
    title,
    body: suggestion?.text ? `${body}\n\n当前提示：${suggestion.text}` : body,
    action: "open-note-workflow",
    actionLabel,
    noteId: note.id,
    sourceNoteId: note.id,
    dedupeKey,
    workflowRoute: {
      module: "explorer",
      focus,
      source: "system-message"
    }
  };
}

export function relationNetworkWorkflowMessageForNote(note = null, overview = {}, {
  distillationStatusOf,
  isPermanentLikeNote
} = {}) {
  if (!note?.id || !isPermanentLikeNote(note)) return null;
  if (distillationStatusOf(note) !== "confirmed") return null;
  const relationState = String(overview?.relationState || "").trim().toLowerCase();
  const explicitRelationCount = Number(overview?.explicitRelationCount || 0) || 0;
  const dedupeKey = workflowMessageDedupeKey(note.id, "relation-network", "relations");
  const noteTitle = String(note.title || note.id || "未命名笔记").trim() || "未命名笔记";
  if (relationState === "loaded" && explicitRelationCount > 0) {
    return { resolved: true, dedupeKey };
  }
  if (relationState && relationState !== "loaded") return null;
  return {
    id: `workflow:${dedupeKey}`,
    type: "workflow",
    category: "relation-network",
    title: `${noteTitle} 还没关联`,
    body: `“${noteTitle}”已经是一条永久笔记，但还没有和其他永久笔记建立关联。打开它后先关联一条真正相关的笔记，并写清它们是支持、反驳、限定还是桥接；如果暂时独立，也在边界里写下理由。`,
    action: "open-note-workflow",
    actionLabel: "关联一条笔记",
    noteId: note.id,
    dedupeKey,
    workflowRoute: {
      module: "explorer",
      focus: "relations",
      source: "system-message"
    }
  };
}
