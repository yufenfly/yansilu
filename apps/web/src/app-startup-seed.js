import {
  runConfirmedSmartNotesDemoImport
} from "./smart-notes-demo-import-flow.js";
import {
  SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID,
  smartNotesDemoExistingFolder,
  smartNotesDemoOpenedExistingGuideStatus,
  smartNotesDemoStartupNoteId
} from "./smart-notes-demo-startup-note.js";

export async function openInitialStartupRouteForRuntime(deps = {}) {
  const {
    windowRef = typeof window !== "undefined" ? window : undefined,
    state = {},
    usingLocalFallbackData = false,
    startupAutoOpenSuppressed = false,
    getStartupAutoOpenSuppressed = () => startupAutoOpenSuppressed,
    confirm = null,
    importSmartNotesProductThinkingDemo = async () => false,
    preferredLocalFallbackNote = () => null,
    rootBoxIdFromFolder = () => "",
    syncNotesForDirectory = async () => {},
    openNoteById = () => false,
    openStartupUntitledNote = async () => null,
    activateModule = () => {},
    renderAll = () => {},
    setStatus = () => {}
  } = deps;
  const startupParams = new URLSearchParams(windowRef?.location?.search || "");
  const startupDemo = String(startupParams.get("demo") || "").trim().toLowerCase();
  const explicitNoteId = startupParams.get("note") || "";
  const initialNote = explicitNoteId ? state.notes?.find((note) => note.id === explicitNoteId) : null;
  const shouldSkipAutoOpen = () => getStartupAutoOpenSuppressed() === true || Boolean(state.activeTabId || state.selectedFileId);
  const openedDemo =
    startupDemo === "smart-notes-product-thinking" || startupDemo === "smart-notes"
      ? await runConfirmedSmartNotesDemoImport({ startup: true }, {
          confirm,
          importSmartNotesDemo: importSmartNotesProductThinkingDemo,
          setStatus
        })
      : false;
  if (openedDemo) {
    renderAll();
    return { route: "demo", startupDemo };
  }
  if (initialNote) {
    state.browserRootId = rootBoxIdFromFolder(state, initialNote.folderId);
    state.selectedFolderId = initialNote.folderId;
    openNoteById(explicitNoteId);
    return { route: "note", noteId: explicitNoteId };
  }
  if (!usingLocalFallbackData && !shouldSkipAutoOpen()) {
    const demoFolder = smartNotesDemoExistingFolder(state.folders);
    if (demoFolder?.id) {
      try {
        state.browserRootId = rootBoxIdFromFolder(state, demoFolder.id);
        state.selectedFolderId = demoFolder.id;
        await syncNotesForDirectory(demoFolder.id);
        await syncNotesForDirectory(SMART_NOTES_DEMO_GUIDE_DIRECTORY_ID);
        const guideNoteId = smartNotesDemoStartupNoteId({ notes: state.notes });
        if (guideNoteId) {
          state.selectedFileId = guideNoteId;
          activateModule("explorer");
          openNoteById(guideNoteId, { preferTitleSelection: false });
          setStatus(smartNotesDemoOpenedExistingGuideStatus(), "ok");
          return { route: "existing_demo", noteId: guideNoteId };
        }
      } catch (error) {
        setStatus(`Demo 导览暂时无法自动打开：${String(error?.message || error)}`, "warn");
      }
    }
  }
  if (usingLocalFallbackData) {
    const fallbackNote = preferredLocalFallbackNote();
    if (fallbackNote) {
      state.browserRootId = rootBoxIdFromFolder(state, fallbackNote.folderId);
      state.selectedFolderId = fallbackNote.folderId;
      openNoteById(fallbackNote.id, { preferTitleSelection: false });
      setStatus(`API 连接失败，已打开本地示例笔记：${fallbackNote.title || fallbackNote.id}`, "warn");
      return { route: "fallback_note", noteId: fallbackNote.id };
    }
    if (!shouldSkipAutoOpen()) {
      await openStartupUntitledNote();
      return { route: "untitled" };
    }
    return { route: "skipped" };
  }
  if (!shouldSkipAutoOpen()) {
    activateModule("today");
    return { route: "today" };
  }
  return { route: "skipped" };
}
