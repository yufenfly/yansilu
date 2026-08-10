function syncDistillationTabFromNote(state = {}, note = null, updated = null) {
  if (!note || !updated || typeof updated.body !== "string") return;
  const tab = (state.tabs || []).find((item) => item.noteId === note.id);
  if (!tab) return;
  tab.body = updated.body;
  tab.savedBody = updated.body;
  tab.title = updated.title || tab.title;
  tab.savedTitle = tab.title;
  tab.dirty = false;
}

export async function handleSaveNoteDistillationStateChange(payload = {}, deps = {}) {
  const {
    state = {},
    updatePermanentNoteDistillation = async () => null,
    confirmPermanentNoteDistillation = async () => null,
    mapNoteItem = (item) => item,
    setStatus = () => {},
    renderDistillationPanel = () => {},
    renderAll = () => {}
  } = deps;

  const noteId = String(payload.noteId || "").trim();
  const note = (state.notes || []).find((item) => item.id === noteId);
  if (!note) return false;

  try {
    const requestedStatus = String(payload.distillationStatus || "draft").trim();
    const shouldConfirm = requestedStatus === "confirmed";
    const updatePayload = {
      thesis: payload.thesis || "",
      threeLineSummary: Array.isArray(payload.threeLineSummary) ? payload.threeLineSummary : [],
      boundaryOrCounterpoint: payload.boundaryOrCounterpoint || "",
      distillationStatus: shouldConfirm ? "draft" : requestedStatus || "draft"
    };
    if (Object.prototype.hasOwnProperty.call(payload, "startingQuestion")) {
      updatePayload.startingQuestion = payload.startingQuestion || "";
    }
    if (Object.prototype.hasOwnProperty.call(payload, "thesisChangeReason")) {
      updatePayload.thesisChangeReason = payload.thesisChangeReason || "";
    }
    if (Array.isArray(payload.viewpointChangeSourceNoteIds)) {
      updatePayload.viewpointChangeSourceNoteIds = payload.viewpointChangeSourceNoteIds;
    }
    if (payload.commitViewpointChange === true) {
      updatePayload.commitViewpointChange = true;
    }
    const updated = await updatePermanentNoteDistillation(note.id, updatePayload);
    let finalUpdated = updated;
    if (shouldConfirm) {
      finalUpdated = await confirmPermanentNoteDistillation(note.id, {
        aiAssisted: Boolean(payload.authorship?.ai_assisted ?? note.authorship?.ai_assisted)
      });
    }
    if (finalUpdated) {
      Object.assign(note, mapNoteItem(finalUpdated), { bodyLoaded: true });
      syncDistillationTabFromNote(state, note, finalUpdated);
    }
    setStatus(shouldConfirm ? "当前观点已保存" : "观点草稿已保存", "ok");
    renderDistillationPanel();
    renderAll();
    return finalUpdated || true;
  } catch (error) {
    setStatus(`当前观点保存失败：${String(error?.message || error)}`, "bad");
    return false;
  }
}

export async function handleConfirmNoteDistillationStateChange(payload = {}, deps = {}) {
  const {
    state = {},
    confirmPermanentNoteDistillation = async () => null,
    mapNoteItem = (item) => item,
    setStatus = () => {},
    renderAll = () => {}
  } = deps;

  const noteId = String(payload.noteId || "").trim();
  const note = (state.notes || []).find((item) => item.id === noteId);
  if (!note) return false;

  try {
    const updated = await confirmPermanentNoteDistillation(note.id, {
      aiAssisted: Boolean(note.authorship?.ai_assisted)
    });
    if (updated) {
      Object.assign(note, mapNoteItem(updated), { bodyLoaded: true });
      syncDistillationTabFromNote(state, note, updated);
    }
    setStatus("提炼内容已整理到正文", "ok");
    renderAll();
    return updated || true;
  } catch (error) {
    setStatus(`整理到正文失败：${String(error?.message || error)}`, "bad");
    return false;
  }
}
