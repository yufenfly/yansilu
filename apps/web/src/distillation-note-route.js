export async function openDistillationQueueNoteRoute(noteId = "", deps = {}) {
  const {
    documentRef = globalThis.document,
    queueMicrotaskRef = globalThis.queueMicrotask,
    state = {},
    editor = {},
    ensureNoteBodyLoaded = async () => {},
    openNoteById = () => false,
    distillationStageOf = () => "",
    renderAll = () => {},
    setStatus = () => {}
  } = deps;

  const id = String(noteId || "").trim();
  if (!id) return false;
  await ensureNoteBodyLoaded(id);
  state.module = "explorer";
  documentRef?.querySelectorAll?.(".rail-btn[data-module]")?.forEach((button) => {
    button.classList.toggle("active", button.dataset.module === "explorer");
  });
  const opened = openNoteById(id, { preferTitleSelection: false });
  if (opened) {
    state.inspectorVisible = false;
    editor?.setInspectorVisible?.(false);
    setStatus("已从观点整理待处理列表打开笔记", "ok");
  }
  renderAll();
  queueMicrotaskRef?.(() => {
    const note = state.notes?.find((item) => item.id === id) || null;
    const stage = distillationStageOf(note);
    const selector =
      stage === "needs_thesis"
        ? '[data-note-distillation-form] textarea[name="thesis"]'
        : stage === "needs_confirm"
          ? '[data-note-distillation-form] button[type="submit"]'
          : "[data-note-distillation-section]";
    documentRef?.querySelector?.("[data-note-distillation-section]")?.scrollIntoView({ block: "start", behavior: "smooth" });
    documentRef?.querySelector?.(selector)?.focus?.();
  });
  return opened;
}
