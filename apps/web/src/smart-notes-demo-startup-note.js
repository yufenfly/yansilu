export const SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID = "dir_demo_smart_notes_product_thinking_guide";

export function smartNotesDemoStartupNoteId({ result = {}, notes = [] } = {}) {
  const firstNoteId = String(result?.firstNoteId || "").trim();
  const guideById = firstNoteId
    ? (Array.isArray(notes) ? notes : []).find((note) => String(note?.id || "").trim() === firstNoteId)
    : null;
  if (guideById) return firstNoteId;
  const guideByTitle = (Array.isArray(notes) ? notes : []).find((note) =>
    /^00\s+从这里开始/.test(String(note?.title || "").trim())
  );
  return String(guideByTitle?.id || firstNoteId || "").trim();
}

function countDemoItems(result = {}, keys = []) {
  const counts = result?.counts && typeof result.counts === "object" ? result.counts : {};
  const summary = result?.summary && typeof result.summary === "object" ? result.summary : {};
  for (const key of keys) {
    const value = Number(counts[key] ?? summary[key] ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

export function smartNotesDemoImportedStatus(result = {}, { openedGuide = false, refreshedHome = false } = {}) {
  const noteCount = countDemoItems(result, ["permanent_notes", "permanentNotes", "createdNotes", "updatedNotes"]);
  const relationCount = countDemoItems(result, ["relations", "createdRelations", "updatedRelations"]);
  const projectCount = countDemoItems(result, ["writing_projects", "writingProjects", "createdWritingProjects", "updatedWritingProjects"]);
  const detail = [
    `${noteCount} 条永久笔记`,
    `${relationCount} 条关系`,
    `${projectCount} 个写作项目`
  ].join("，");
  const suffix = refreshedHome && openedGuide
    ? "首页已刷新，已打开导览笔记。"
    : refreshedHome
      ? "首页已刷新。"
      : openedGuide
        ? "已打开导览笔记。"
        : "可以继续体验。";
  return `已导入 Smart Notes Demo：${detail}。${suffix}`;
}

export function shouldRefreshHomeAfterSmartNotesDemoImport(options = {}) {
  if (options?.startup === true) return true;
  const source = String(options?.source || "").trim();
  return new Set(["today-empty-start", "empty-start", "settings-help"]).has(source);
}

export function smartNotesDemoExistingFolder(folders = []) {
  return (Array.isArray(folders) ? folders : []).find((folder) => {
    const name = String(folder?.name || folder?.title || "").toLowerCase();
    return name.includes("smart notes") || name.includes("产品思考") || name.includes("寫作 demo") || name.includes("写作 demo");
  }) || null;
}

export function smartNotesDemoOpenedExistingGuideStatus() {
  return "Smart Notes Demo 已存在，已为你打开导览笔记。可以继续按 10 分钟导览体验卡片笔记写作法。";
}
