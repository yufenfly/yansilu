import { searchNotes, fetchNoteRelations, createNoteRelation, updateNoteRelation } from "./prototype-api.js";
import { relationFollowupSuggestionForDraft, relationTypeLabel } from "./editor-relation-helpers.js";
import { completeSmartNotesDemoStep } from "./beginner-onboarding-flow.js";
import { wikilinkTokenForNote } from "./editor-link-picker.js";
import { saveRelationTransaction } from "./relation-save-transaction.js";
import {
  normalizeRelationDraft,
  relationDraftCanSave,
  relationDraftErrorText,
  resetRelationDraftResult
} from "./permanent-relation-draft-model.js";

function cleanText(value = "") {
  return String(value || "").trim();
}

function stateSourceNote(host) {
  const stateNoteId = cleanText(host.permanentRelationWorkspaceState?.sourceNoteId || host.permanentRelationWorkspaceState?.noteId);
  return (stateNoteId ? host.state?.notes?.find?.((note) => note?.id === stateNoteId) : null) || host.activeNote?.() || null;
}

function stateSourceNoteId(host) {
  return cleanText(host.permanentRelationWorkspaceState?.sourceNoteId || host.permanentRelationWorkspaceState?.noteId);
}

function stateSessionId(host) {
  return cleanText(host.permanentRelationWorkspaceState?.relationComposerSessionId);
}

function noteTitle(host, noteId = "") {
  const cleanNoteId = cleanText(noteId);
  return host.state?.notes?.find?.((note) => note?.id === cleanNoteId)?.title || cleanNoteId;
}

export function completePendingSmartNotesDemoRelation(appState = {}, sourceNoteId = "") {
  const pending = appState?.smartNotesDemoPendingRelationStep;
  if (!pending?.key || cleanText(pending.noteId) !== cleanText(sourceNoteId)) return false;
  appState.smartNotesDemoCompletedSteps = completeSmartNotesDemoStep(appState.smartNotesDemoCompletedSteps, pending.key);
  appState.smartNotesDemoPendingRelationStep = null;
  return true;
}

export class PermanentRelationComposerController {
  constructor(host) {
    this.host = host;
  }

  sourceNote() {
    return stateSourceNote(this.host);
  }

  patchState(patch = {}) {
    const host = this.host;
    const sourceNote = this.sourceNote();
    const sourceNoteId = sourceNote?.id || host.permanentRelationWorkspaceState?.noteId || "";
    host.permanentRelationWorkspaceState = normalizeRelationDraft({
      ...host.permanentRelationWorkspaceState,
      ...patch
    }, sourceNoteId);
    host.syncPermanentRelationWorkspaceOverlay();
  }

  chooseManualTarget(targetNoteId = "") {
    const host = this.host;
    const sourceNote = this.sourceNote();
    if (!sourceNote?.id) return;
    const timerHost = host.windowRef || window;
    timerHost.clearTimeout?.(host.permanentRelationSearchTimer);
    host.permanentRelationSearchSerial += 1;
    const targetId = cleanText(targetNoteId);
    const target = host.permanentRelationWorkspaceState.manualTargets.find((item) => item?.id === targetId) || null;
    host.upsertApiNotes?.(target ? [target] : []);
    this.patchState(resetRelationDraftResult({
      ...host.permanentRelationWorkspaceState,
      mode: "manual",
      selectedTargetNoteId: targetId,
      relationType: host.permanentRelationWorkspaceState.relationType || "associated_with",
      rationale: host.permanentRelationWorkspaceState.rationale || "",
      dirty: true
    }));
  }

  async refreshManualSearch(query = "") {
    const host = this.host;
    const sourceNote = this.sourceNote();
    if (!sourceNote?.id) return;
    const serial = ++host.permanentRelationSearchSerial;
    const requestSourceNoteId = sourceNote.id;
    const requestSessionId = stateSessionId(host);
    const stillCurrentSearch = () =>
      serial === host.permanentRelationSearchSerial &&
      stateSourceNoteId(host) === requestSourceNoteId &&
      stateSessionId(host) === requestSessionId;
    const cleanQuery = cleanText(query);
    host.permanentRelationWorkspaceState = normalizeRelationDraft({
      ...host.permanentRelationWorkspaceState,
      mode: "manual",
      manualQuery: cleanQuery,
      searchState: cleanQuery ? "loading" : "idle",
      selectedTargetNoteId: cleanQuery ? "" : host.permanentRelationWorkspaceState.selectedTargetNoteId,
      error: "",
      notice: "",
      dirty: cleanQuery ? true : host.permanentRelationWorkspaceState.dirty === true
    }, sourceNote.id);
    host.syncPermanentRelationManualResults();
    if (!cleanQuery) {
      host.permanentRelationWorkspaceState = normalizeRelationDraft({
        ...host.permanentRelationWorkspaceState,
        manualTargets: [],
        selectedTargetNoteId: "",
        searchState: "idle"
      }, sourceNote.id);
      host.syncPermanentRelationManualResults();
      return;
    }
    try {
      const result = await searchNotes({
        query: cleanQuery,
        rootDirectoryId: host.relationTargetSearchRootId(sourceNote),
        excludeNoteId: sourceNote.id,
        limit: 30
      });
      if (!stillCurrentSearch()) return;
      const items = Array.isArray(result?.items) ? result.items : [];
      host.upsertApiNotes?.(items);
      host.permanentRelationWorkspaceState = normalizeRelationDraft({
        ...host.permanentRelationWorkspaceState,
        manualTargets: items,
        searchState: "loaded",
        notice: items.length ? "" : "没有找到匹配的笔记。"
      }, sourceNote.id);
      host.syncPermanentRelationManualResults();
    } catch (error) {
      if (!stillCurrentSearch()) return;
      host.permanentRelationWorkspaceState = normalizeRelationDraft({
        ...host.permanentRelationWorkspaceState,
        searchState: "error",
        error: `搜索失败：${String(error?.message || error)}`
      }, sourceNote.id);
      host.syncPermanentRelationManualResults();
    }
  }

  queueManualSearch(input) {
    const host = this.host;
    const timerHost = host.windowRef || window;
    timerHost.clearTimeout?.(host.permanentRelationSearchTimer);
    const query = input?.value || "";
    host.permanentRelationSearchTimer = timerHost.setTimeout(() => {
      void this.refreshManualSearch(query);
    }, 180);
  }

  updateField(field = "", value = "") {
    const key = cleanText(field);
    if (!["relationType", "rationale", "insightQuestion"].includes(key)) return;
    const host = this.host;
    host.permanentRelationWorkspaceState = normalizeRelationDraft(resetRelationDraftResult({
      ...host.permanentRelationWorkspaceState,
      [key]: cleanText(value),
      dirty: true
    }), this.sourceNote()?.id || host.permanentRelationWorkspaceState.noteId || "");
  }

  async insertLinkIfRequested(state = {}) {
    const host = this.host;
    if (state.insertLinkOnSave !== true) return false;
    if (!host.isActiveNoteId?.(state.noteId)) return false;
    const target = host.state?.notes?.find?.((note) => note?.id === state.selectedTargetNoteId) || { id: state.selectedTargetNoteId, title: noteTitle(host, state.selectedTargetNoteId) };
    const token = wikilinkTokenForNote(target);
    const range = state.cursorRange && typeof state.cursorRange === "object" ? state.cursorRange : null;
    if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
      const cursor = range.from + token.length;
      if (host.isWysiwygMode?.()) {
        host.replaceMarkdownWhileInWysiwyg(range.from, range.to, token, { selectionStart: cursor, selectionEnd: cursor });
      } else {
        host.replaceEditorRange(range.from, range.to, token, { selectionStart: cursor, selectionEnd: cursor });
      }
    } else {
      host.insertAtCursor?.(token);
    }
    host.handleEditorInput?.();
    const saved = await host.saveActiveNote?.({ trigger: "relation-composer-link-insert", skipOriginalityCheck: true, suppressSaveAiSuggestion: true });
    host.hideSaveAiSuggestion?.();
    return saved !== false && !(saved && typeof saved === "object" && saved.ok === false);
  }

  async submit(form = null) {
    const host = this.host;
    const sourceNote = this.sourceNote();
    if (!sourceNote?.id) return;
    const data = new FormData(form);
    const state = normalizeRelationDraft({
      ...host.permanentRelationWorkspaceState,
      relationType: data.get("relationType"),
      rationale: data.get("rationale"),
      insightQuestion: data.get("insightQuestion")
    }, sourceNote.id);
    const sourceIsActive = host.isActiveNoteId?.(sourceNote.id) === true;
    const sourceStillActive = () => host.isActiveNoteId?.(sourceNote.id) === true;
    const submitSessionId = cleanText(state.relationComposerSessionId || stateSessionId(host));
    const draftStillCurrent = () =>
      Boolean(submitSessionId) &&
      stateSourceNoteId(host) === sourceNote.id &&
      stateSessionId(host) === submitSessionId;
    const currentRelations = sourceIsActive ? host.currentSemanticRelations : null;
    const validation = relationDraftCanSave({
      state,
      relations: currentRelations,
      allowExistingUpdate: true
    });
    if (!validation.ok) {
      this.patchState({ ...state, error: relationDraftErrorText(validation.reason), notice: "" });
      return;
    }
    this.patchState({ ...state, saveState: "saving", error: "", notice: "正在保存关联..." });
    try {
      const latestRelations = await fetchNoteRelations(sourceNote.id);
      if (!draftStillCurrent()) return;
      if (sourceStillActive()) {
        host.currentSemanticRelations = latestRelations;
        host.semanticRelationsState = "loaded";
      }
      const latestValidation = relationDraftCanSave({
        state,
        relations: latestRelations,
        allowExistingUpdate: true
      });
      if (!latestValidation.ok) {
        if (!draftStillCurrent()) return;
        this.patchState({ ...state, saveState: "idle", error: relationDraftErrorText(latestValidation.reason), notice: "" });
        return;
      }
      const target = host.state.notes.find((item) => item.id === state.selectedTargetNoteId) || null;
      const existingRelationId = latestValidation.existing?.id || latestValidation.existing?.relationId || "";
      const relationPayload = {
        relationType: state.relationType,
        rationale: state.rationale,
        insightQuestion: state.insightQuestion,
        confidence: 1,
        status: "confirmed"
      };
      let relation = null;
      let transaction = null;
      if (existingRelationId) {
        relation = await updateNoteRelation(existingRelationId, relationPayload);
      } else {
        transaction = await saveRelationTransaction({
          noteId: sourceNote.id,
          targetNoteId: state.selectedTargetNoteId,
          ...relationPayload,
          createdBy: ""
        }, {
          createNoteRelation,
          targetTitle: target?.title || state.selectedTargetNoteId,
          relationLabel: relationTypeLabel(state.relationType)
        });
        if (!draftStillCurrent()) return;
        if (!transaction.ok) {
          this.patchState({ ...state, saveState: "idle", error: transaction.error, notice: "" });
          return;
        }
        relation = transaction.relation;
      }
      if (!draftStillCurrent()) return;
      host.syncRelationNetworkConnected?.(sourceNote.id, state.selectedTargetNoteId);
      await host.refreshRelationNetworkStatuses?.(sourceNote.id, state.selectedTargetNoteId);
      if (!draftStillCurrent()) return;
      const savedRelations = await fetchNoteRelations(sourceNote.id).catch(() => null);
      if (!draftStillCurrent()) return;
      if (savedRelations && sourceStillActive()) {
        host.currentSemanticRelations = savedRelations;
        host.semanticRelationsState = "loaded";
      }
      if (sourceStillActive()) {
        host.renderPreview?.();
        host.setRelationFollowupSuggestion?.(relationFollowupSuggestionForDraft({
          noteId: sourceNote.id,
          relationId: relation?.id || relation?.relationId || "",
          relationType: state.relationType,
          rationale: state.rationale,
          insightQuestion: state.insightQuestion,
          targetTitle: target?.title || state.selectedTargetNoteId
        }));
      }
      const linkInserted = await this.insertLinkIfRequested(state);
      if (!draftStillCurrent()) return;
      completePendingSmartNotesDemoRelation(host.state, sourceNote.id);
      host.renderAll?.();
      if (state.entryRoute?.returnTo === "graph") {
        await host.refreshDirectoryGraph?.();
        if (!draftStillCurrent()) return;
      }
      const successMessage = existingRelationId ? "关联已更新。" : relation?.created === false ? "关联已存在，已直接复用。" : "关联已保存。";
      host.permanentSidebarController().commitSavedRelationWorkspaceResult({
        noteId: sourceNote.id,
        state,
        successMessage: linkInserted ? `${successMessage} 关联已插入。` : successMessage,
        result: {
          ...(transaction?.result || {
            targetNoteId: state.selectedTargetNoteId,
            targetTitle: target?.title || state.selectedTargetNoteId,
            relationType: state.relationType,
            relationLabel: relationTypeLabel(state.relationType),
            created: relation?.created !== false
          }),
          updated: Boolean(existingRelationId),
          linkInserted
        }
      });
    } catch (error) {
      if (!draftStillCurrent()) return;
      this.patchState({
        saveState: "error",
        error: `Save failed: ${String(error?.message || error)}`
      });
      host.onStatus?.(`关联保存失败：${String(error?.message || error)}`, "warn");
    }
  }
}
