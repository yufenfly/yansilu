import {
  defaultPermanentRelationWorkspaceState,
  normalizePermanentRelationWorkspaceState,
  resetPermanentRelationWorkspaceResult
} from "./permanent-relation-workspace-model.js";
import { relationDraftFromRoute } from "./permanent-relation-draft-model.js";
import {
  relationEntryRouteForPermanentWorkspace,
  relationEntryRouteForPermanentWorkspaceContinuation
} from "./relation-entry-route.js";
import { RELATION_ENTRY_SOURCES } from "./relation-entry-route.js";

function nextRelationComposerSessionId(host) {
  host.permanentRelationComposerSessionSerial = Number(host.permanentRelationComposerSessionSerial || 0) + 1;
  return `relation-composer-${host.permanentRelationComposerSessionSerial}`;
}

export function permanentRelationWorkspaceFocusSelector({
  selectedTargetNoteId = ""
} = {}) {
  if (selectedTargetNoteId) return '[data-permanent-relation-field="rationale"]';
  return "[data-permanent-relation-target-search]";
}

export class PermanentNoteSidebarController {
  constructor(host) {
    this.host = host;
  }

  openRelationWorkspace(options = {}) {
    const host = this.host;
    const requestedNoteId = String(options.noteId || options.sourceNoteId || "").trim();
    const note = (requestedNoteId ? host.state?.notes?.find?.((item) => item?.id === requestedNoteId) : null) || host.activeNote();
    if (!note?.id) return false;
    const entryRoute = relationEntryRouteForPermanentWorkspace(note.id, options);
    const overlayOnly = entryRoute.returnTo === "graph" || entryRoute.source === RELATION_ENTRY_SOURCES.GRAPH_NODE || entryRoute.source === RELATION_ENTRY_SOURCES.GRAPH_ISOLATED || entryRoute.source === RELATION_ENTRY_SOURCES.TOOLBAR_RELATION;
    if (!overlayOnly) {
      host.setInspectorVisible(true);
      host.activatePermanentWorkspaceTab("relations");
    }
    const selectedTargetNoteId = String(entryRoute.targetNoteId || "").trim();
    const relationType = String(entryRoute.relationType || host.relationCreateDefaultType(note) || "associated_with")
      .trim()
      .toLowerCase();
    host.permanentRelationWorkspaceState = relationDraftFromRoute(entryRoute, {
      noteId: note.id,
      relationComposerSessionId: nextRelationComposerSessionId(host),
      mode: "manual",
      selectedTargetNoteId,
      relationType,
      rationaleDraft: entryRoute.rationaleDraft,
      insightQuestionDraft: entryRoute.insightQuestionDraft,
      manualQuery: "",
      manualTargets: [],
      sourceKind: entryRoute.source,
      insertLinkOnSave: options.insertLinkOnSave === true,
      cursorRange: options.cursorRange || null,
      notice: options.notice || "",
      entryRoute
    });
    host.syncPermanentRelationWorkspaceOverlay();
    const focusWorkspace = () => {
      host.permanentRelationWorkspaceElement()?.querySelector?.(permanentRelationWorkspaceFocusSelector({
        selectedTargetNoteId
      }))?.focus?.();
    };
    window.setTimeout(focusWorkspace, 40);
    window.setTimeout(focusWorkspace, 250);
    return true;
  }

  closeRelationWorkspace() {
    const host = this.host;
    host.permanentRelationWorkspaceState = defaultPermanentRelationWorkspaceState(host.activeNote()?.id || "");
    host.syncPermanentRelationWorkspaceOverlay();
  }

  patchWorkspaceState(patch = {}) {
    const host = this.host;
    const noteId = host.activeNote()?.id || host.permanentRelationWorkspaceState.noteId || "";
    host.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
      ...host.permanentRelationWorkspaceState,
      ...patch
    }, noteId);
    host.syncPermanentRelationWorkspaceOverlay();
  }

  chooseManualTarget(targetNoteId = "") {
    const host = this.host;
    const note = host.activeNote();
    if (!note?.id) return;
    const targetId = String(targetNoteId || "").trim();
    const target = host.permanentRelationWorkspaceState.manualTargets.find((item) => item?.id === targetId) || null;
    host.upsertApiNotes(target ? [target] : []);
    this.patchWorkspaceState(resetPermanentRelationWorkspaceResult({
      ...host.permanentRelationWorkspaceState,
      mode: "manual",
      selectedTargetNoteId: targetId,
      relationType: host.permanentRelationWorkspaceState.relationType || "associated_with",
      rationale: host.permanentRelationWorkspaceState.rationale || "",
      dirty: true
    }));
  }

  continueRelationWorkspace() {
    const host = this.host;
    const sourceNoteId = String(host.permanentRelationWorkspaceState?.sourceNoteId || host.permanentRelationWorkspaceState?.noteId || "").trim();
    const note = (sourceNoteId ? host.state?.notes?.find?.((item) => item?.id === sourceNoteId) : null) || host.activeNote();
    if (!note?.id) return;
    const relationType = host.relationCreateDefaultType(note) || "associated_with";
    host.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
      ...defaultPermanentRelationWorkspaceState(note.id),
      open: true,
      relationComposerSessionId: nextRelationComposerSessionId(host),
      mode: "manual",
      selectedTargetNoteId: "",
      relationType,
      rationale: "",
      insightQuestion: "",
      entryRoute: relationEntryRouteForPermanentWorkspaceContinuation(note.id, host.permanentRelationWorkspaceState.entryRoute, {
        mode: "manual",
        targetNoteId: "",
        relationType,
        rationaleDraft: "",
        insightQuestionDraft: ""
      }),
      notice: ""
    }, note.id);
    host.syncPermanentRelationWorkspaceOverlay();
  }

  commitSavedRelationWorkspaceResult({
    noteId = "",
    state = {},
    result = {},
    successMessage = ""
  } = {}) {
    const host = this.host;
    host.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
      ...state,
      open: true,
      saveState: "saved",
      error: "",
      notice: "",
      result
    }, noteId);
    host.renderRelated();
    host.syncPermanentRelationWorkspaceOverlay();
    host.onStatus(successMessage, "ok");
  }
}
