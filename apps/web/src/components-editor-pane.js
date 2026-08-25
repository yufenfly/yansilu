import { escapeHtml } from "./editor-render-utils.js";
import { parseLinks, parseTags, rootBoxIdFromFolder, typeFromFolder } from "./prototype-store.js";
import {
  countExplicitSemanticRelations,
  deriveNoteWritingReadiness
} from "./writing-readiness.js";
import {
  checkOriginality,
  deleteNoteRelation,
  adoptAiInboxFieldSuggestion,
  fetchNote,
  fetchAiSuggestion,
  fetchAiSuggestions,
  fetchNoteRelations,
  fetchNotesByTag,
  listTags,
  searchNotes,
  updateAiSuggestion,
  uploadNoteAsset
} from "./prototype-api.js";
import {
  noteSuggestionReviewContent,
  renderNoteEmbeddedAiWorkspace
} from "./note-embedded-ai-workspace.js";
import { aiSuggestionStatusLabel } from "./ai-suggestions-model.js";
import {
  titleFromBody,
  composeLiteratureWorkspace,
  composePermanentWorkspace,
  deriveLiteratureSectionLabelsFromTemplate,
  distillationDraftFromForm,
  literatureCitationState,
  literatureTemplateBody,
  normalizeLiteratureSectionLabelCandidates,
  normalizedLiteratureSectionLabels,
  normalizeFieldText,
  normalizePlaceholderTitleBody,
  normalizedBodyTextForDirtyCheck,
  normalizedNoteTitleText,
  parseLiteratureWorkspace,
  parsePermanentWorkspace,
  reflectionQuestionsHint,
  selectionDistillationDraft,
  validateLiteratureTemplateSource
} from "./editor-template-workspace.js";
import {
  assetMarkdownSnippet,
  CODE_BLOCK_LANGUAGE_OPTIONS,
  decodePreviewPayload,
  formatMarkdownLinkDestination,
  formatMarkdownTableRow,
  formatMarkdownTableSeparator,
  inferCodeLanguage,
  isAllowedAttachmentFile,
  isHorizontalRuleLine,
  isImageFile,
  isExternalLinkUrl,
  isMarkdownCodeFenceLine,
  isMarkdownTableRow,
  isMarkdownTableSeparator,
  isMarkdownTableStart,
  isPreviewDocumentUrl,
  isPreviewImageUrl,
  isPreviewPdfUrl,
  normalizeCodeLanguage,
  normalizeLooseMarkdownTables,
  normalizeWysiwygMarkdownValue,
  parseMarkdownLinkSyntax,
  parseMarkdownTableRow,
  resolvePreviewableAsset
} from "./editor-markdown-commands.js";
import { renderMarkdownPreview } from "./editor-preview-renderer.js";
import { applyEditorPaneStateMethods } from "./editor-dirty-state.js";
import {
  highlightMatch,
  linkCandidateBadge,
  linkCandidateGroupLabel,
  looksLikeStableNoteId,
  markdownReferencePathCandidates,
  normalizeClickedTag,
  normalizeText,
  noteMatchesMarkdownReferencePath,
  relationCreateDefaultTypeForNote,
  renderPickerSections,
  sortRelationTargetCandidatesForNote,
  tagCandidateBadge,
  tagCandidateGroupLabel,
  tagCandidateRank,
  tokenAtCursor,
  wikilinkTargetFromRaw
} from "./editor-link-picker.js";
import { EditorRelationLinkController } from "./editor-relation-link-controller.js";
import { EditorSemanticRelationsController } from "./editor-semantic-relations-controller.js";
import { PermanentNoteDistillationController } from "./permanent-note-distillation-controller.js";
import { PermanentNoteWorkspaceController } from "./permanent-note-workspace-controller.js";
import { renderPermanentNoteActionPanel } from "./permanent-note-action-panel.js";
import { buildPermanentNoteMainPathActionModel } from "./permanent-note-main-path-model.js";
import {
  closeEditorRelatedPopovers,
  routeEditorRelationClick,
  routeEditorRelationFocusIn,
  routeEditorRelationInput,
  routeEditorRelationKeydown,
  routeEditorRelationSubmit
} from "./editor-relation-events.js";
import {
  excerptFromBody,
  isHiddenRelation,
  isMarkdownWikilinkRelation,
  noteTypeText,
  normalizeRelationTemplateVariants,
  parseInlineRelationAnnotations,
  relationQualityEvaluation,
  relationQualityLabel,
  relationSourceLabel,
  relationStatusLabel,
  relationTone,
  RELATION_CREATE_TYPES,
  relationTypeGuidance,
  relationTypeLabel,
  renderRelationQualityMeter,
  renderRelationTemplateVariantSwitcher,
  relationCreateTypeOptionsMarkup
} from "./editor-relation-helpers.js";
import {
  renderPermanentRelationManualTargets,
  renderPermanentRelationComposer
} from "./permanent-relation-composer-view.js";
import { PermanentRelationComposerController } from "./permanent-relation-composer-controller.js";
import {
  defaultPermanentRelationWorkspaceState,
  normalizePermanentRelationAiCandidates,
  normalizePermanentRelationWorkspaceState
} from "./permanent-relation-workspace-model.js";
import {
  RELATION_ENTRY_SOURCES
} from "./relation-entry-route.js";
import {
  permanentNoteRelationState,
  permanentNoteSidebarLayout,
  permanentNoteViewpointState,
  permanentNoteWorkspaceArchitecture
} from "./permanent-note-sidebar-architecture.js";
import {
  explicitPermanentNoteRelations,
  permanentNoteSidebarExplicitRelationCount,
  permanentNoteSidebarOverview
} from "./permanent-note-sidebar-model.js";
import {
  renderEditorBodyRelationActions,
  renderEditorRelatedNotesPanel
} from "./editor-related-notes-panel.js";
import {
  renderPermanentNoteRelationAssistSection as renderPermanentNoteRelationAssistSectionView,
  renderPermanentNoteStatusSummary
} from "./permanent-note-sidebar-view.js";
import { PermanentNoteSidebarController } from "./permanent-note-sidebar-controller.js";
import { renderSourceNotePromotionPanel } from "./source-note-promotion-panel.js";
import {
  CONTEXTUAL_AI_ACTION_STATUS
} from "./contextual-ai-action-model.js";
import {
  contextualAiActionIdFromElement,
  contextualAiResultInputValues
} from "./contextual-ai-result-panel.js";


const UNTITLED_NOTE_TITLE = "未命名笔记";

export {
  assetMarkdownSnippet,
  composePermanentWorkspace,
  deriveLiteratureSectionLabelsFromTemplate,
  formatMarkdownLinkDestination,
  normalizeFieldText,
  parseLiteratureWorkspace,
  parseMarkdownLinkSyntax,
  parsePermanentWorkspace,
  relationCreateDefaultTypeForNote,
  relationTypeGuidance,
  renderMarkdownPreview,
  sortRelationTargetCandidatesForNote,
  validateLiteratureTemplateSource
};

function relationNetworkVisibleRelationCount(relations = null) {
  const outgoing = Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : [];
  const backlinks = Array.isArray(relations?.backlinks) ? relations.backlinks : [];
  return [...outgoing, ...backlinks].filter((link) => !isHiddenRelation(link)).length;
}

function relationNetworkVisibleRelationNoteIds(relations = null, currentNoteId = "") {
  const ids = new Set([String(currentNoteId || "").trim()].filter(Boolean));
  const outgoing = Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : [];
  const backlinks = Array.isArray(relations?.backlinks) ? relations.backlinks : [];
  for (const link of [...outgoing, ...backlinks]) {
    if (isHiddenRelation(link)) continue;
    [
      link?.fromNoteId,
      link?.from_note_id,
      link?.sourceNoteId,
      link?.source_note_id,
      link?.from?.id,
      link?.toNoteId,
      link?.to_note_id,
      link?.targetNoteId,
      link?.target_note_id,
      link?.to?.id
    ].forEach((id) => {
      const clean = String(id || "").trim();
      if (clean) ids.add(clean);
    });
  }
  return [...ids];
}

export class EditorPane {
  constructor({
    state,
    elements,
    onStatus,
    onStateChange,
    onOpenNote,
    onChromeChange,
    resolveNoteWritingContinuation,
    notifyWorkflowReminder,
    selectPermanentDirectory,
    resolveLiteratureSectionLabels,
    resolveLiteratureSectionLabelCandidates,
    vaultScope,
    refreshDirectoryGraph,
    renderAll
  }) {
    this.state = state;
    this.els = elements;
    this.onStatus = onStatus;
    this.onStateChange = onStateChange;
    this.onOpenNote = onOpenNote;
    this.onOpenExternalUrl = typeof elements?.openExternalUrl === "function" ? elements.openExternalUrl : null;
    this.onChromeChange = typeof onChromeChange === "function" ? onChromeChange : () => {};
    this.renderAll = typeof renderAll === "function" ? renderAll : () => {};
    this.refreshDirectoryGraph = typeof refreshDirectoryGraph === "function" ? refreshDirectoryGraph : async () => false;
    this.resolveNoteWritingContinuation =
      typeof resolveNoteWritingContinuation === "function" ? resolveNoteWritingContinuation : null;
    this.notifyWorkflowReminder = typeof notifyWorkflowReminder === "function" ? notifyWorkflowReminder : () => {};
    this.selectPermanentDirectory = typeof selectPermanentDirectory === "function" ? selectPermanentDirectory : null;
    this.resolveLiteratureSectionLabels =
      typeof resolveLiteratureSectionLabels === "function" ? resolveLiteratureSectionLabels : () => ({});
    this.resolveLiteratureSectionLabelCandidates =
      typeof resolveLiteratureSectionLabelCandidates === "function" ? resolveLiteratureSectionLabelCandidates : null;
    this.vaultScope = typeof vaultScope === "function" ? vaultScope : () => "";
    this.currentLinkCandidates = [];
    this.currentLinkIndex = 0;
    this.currentPinnedLinkId = "";
    this.currentLinkContext = null;
    this.manualLinkReturnSelection = null;
    this.manualLinkReturnScrollState = null;
    this.lastEditorSelection = null;
    this.isSubmittingLinkInsert = false;
    this.currentTagCandidates = [];
    this.currentTagIndex = 0;
    this.currentTagContext = null;
    this.richEditor = null;
    this.markdownEditor = null;
    this.lastInlinePickerAnchor = 0;
    this.lastEditorValue = "";
    this.lastLinkTriggerAt = 0;
    this.lastPlainEnterAt = 0;
    this.lastTagTriggerAt = 0;
    this.suppressEditorChange = false;
    this.suppressRichEditorChange = false;
    this.suppressSourceEditorChange = false;
    this.suppressLiteratureWorkspaceChange = false;
    this.savingPromise = null;
    this.autoSaveTimer = null;
    this.autoSaveIdleTimer = null;
    this.emptyStartActionPending = false;
    this.emptyStartDemoConfirming = false;
    this.wasEditingTitleLine = false;
    this.lastTitleBlurSaveAt = 0;
    this.lastTitleInputAt = 0;
    this.saveUiState = { mode: "idle", message: "" };
    this.relationsRequestSerial = 0;
    this.currentSemanticRelations = null;
    this.semanticRelationsState = "idle";
    this.relationPanelState = {
      noteId: "",
      mode: "list",
      relationId: "",
      targetNoteId: "",
      relationType: "",
      entryHint: "",
      rationaleDraft: "",
      insightQuestionDraft: "",
      draftVariants: [],
      selectedTemplateVariant: "",
      rememberedTemplateVariantLabel: "",
      entryRoute: null
    };
    this.relationFollowupSuggestion = null;
    this.relationTargetSearchSerial = 0;
    this.relationTargetSearchTimer = null;
    this.permanentRelationWorkspaceState = defaultPermanentRelationWorkspaceState("");
    this.permanentRelationSearchSerial = 0;
    this.permanentRelationSearchTimer = null;
    this.permanentRelationAiRecommendationTimer = null;
    this.editorRelationLinkController = new EditorRelationLinkController(this);
    this.editorSemanticRelationsController = new EditorSemanticRelationsController(this);
    this.permanentRelationComposerController = new PermanentRelationComposerController(this);
    this.permanentNoteDistillationController = new PermanentNoteDistillationController(this);
    this.permanentNoteWorkspaceController = new PermanentNoteWorkspaceController(this);
    this.permanentNoteSidebarController = null;
    this.fleetingCleanupDismissedNoteIds = new Set();
    this.sourceDistillAiState = null;
    this.pendingContextualAiAction = null;
    this.noteAiAnalysisByNoteId = new Map();
    this.noteAiSuggestionsState = {
      noteId: "",
      loading: false,
      error: "",
      items: [],
      actionLoading: false,
      actionSuggestionId: "",
      actionError: "",
      actionNotice: "",
      actionNoticeTone: "muted"
    };
    this.noteAiSuggestionsRequestSerial = 0;
    this.markdownSelectionOverride = null;
    this.pendingEditorFocus = null;
    this.pendingEditorSelection = null;
    this.selectionAiActionState = {
      noteId: "",
      selectedText: "",
      from: 0,
      to: 0
    };
    this.bottomNoticeTimer = null;
    this.lastBottomNoticeKey = "";
    this.lastThinkingStatusNoticeKey = "";
    this.bind();
    this.renderPreviewVisibility();
    this.initRichEditor();
    this.initMarkdownEditor();
  }

  async autoSaveTabById(tabId, trigger = "idle") {
    const tab = this.state.tabs.find((t) => t.id === tabId) || null;
    if (!tab?.dirty) return true;
    if (this.savingPromise) return false;
    const note = this.state.notes.find((n) => n.id === tab.noteId) || null;
    if (!note) return false;

    const bodySnapshot = String(tab.body || "");
    const titleSnapshot = titleFromBody(bodySnapshot);
    const statusSnapshot = String(note.status || "draft").trim() || "draft";
    const savingTabId = tab.id;
    const savingTabIsActive = () => this.state.activeTabId === savingTabId;
    const setSavingTabUiState = (mode, message = "") => {
      tab.saveUiState = { mode, message };
      if (savingTabIsActive()) this.renderSaveHint();
    };

    this.clearAutoSaveTimer();
    setSavingTabUiState("saving", "当前文件：正在自动同步...");

    this.savingPromise = (async () => {
      note.body = bodySnapshot;
      note.title = titleSnapshot;
      note.noteType = typeFromFolder(this.state, note.folderId);
      note.tags = parseTags(note.body);
      note.links = parseLinks(note.body);
      note.updatedAt = new Date().toISOString();

      tab.title = titleSnapshot;

      const saved = await this.onStateChange("save-note", {
        noteId: note.id,
        title: titleSnapshot,
        body: bodySnapshot,
        status: statusSnapshot,
        originalityStatus: note.originalityStatus,
        originalitySimilarity: note.originalitySimilarity,
        authorshipConfirmed: true,
        authorshipClaim: "",
        preserveEditorFocus: true,
        trigger
      });

      if (saved === false || (saved && typeof saved === "object" && saved.ok === false)) {
        tab.dirty = true;
        this.writeDraft(tab);
        setSavingTabUiState(
          String(saved?.saveMode || "error").trim() || "error",
          String(saved?.saveMessage || "当前文件：同步失败，修改仍保留在编辑器中。")
        );
        return false;
      }

      tab.savedBody = bodySnapshot;
      tab.savedTitle = titleSnapshot;
      this.syncPlaceholderTitleArmed(tab);
      const liveBodyAtCompletion = savingTabIsActive() ? this.getEditorValue() : tab.body;
      const liveMatchesSaved = normalizedBodyTextForDirtyCheck(liveBodyAtCompletion) === normalizedBodyTextForDirtyCheck(bodySnapshot);
      if (
        !liveMatchesSaved &&
        (this.tabBodyChangedSinceSnapshot(tab, bodySnapshot) ||
        this.tabBodyChangedSinceSnapshot({ body: liveBodyAtCompletion }, bodySnapshot))
      ) {
        tab.body = liveBodyAtCompletion;
        tab.title = titleFromBody(tab.body);
        this.syncTabDirtyState(tab);
        if (tab.dirty) {
          this.writeDraft(tab);
          setSavingTabUiState("dirty", "当前文件：已同步早先修改，仍有未保存编辑");
        } else {
          this.clearDraft(tab.noteId);
          setSavingTabUiState("saved", "当前文件：已自动同步");
        }
        return true;
      }
      tab.title = titleSnapshot;
      tab.dirty = false;
      this.clearDraft(tab.noteId);
      setSavingTabUiState("saved", "当前文件：已自动同步");
      return true;
    })();

    try {
      return await this.savingPromise;
    } finally {
      this.savingPromise = null;
      const active = this.activeTab();
      if (active?.dirty) this.scheduleAutoSave();
      else if (active?.noteId) {
        this.clearAutoSaveTimer();
        this.clearDraft(active.noteId);
      }
    }
  }

  activeTab() {
    return this.state.tabs.find((t) => t.id === this.state.activeTabId) || null;
  }

  activeNote() {
    const t = this.activeTab();
    if (!t) return null;
    return this.state.notes.find((n) => n.id === t.noteId) || null;
  }

  resolvedNoteType(note = this.activeNote()) {
    const explicitType = String(note?.noteType || "").trim().toLowerCase();
    const safeState = this.state && Array.isArray(this.state.folders) ? this.state : { folders: [] };
    const folderType = note?.folderId ? String(typeFromFolder(safeState, note.folderId) || "").trim().toLowerCase() : "";
    const rootId = note?.folderId ? String(rootBoxIdFromFolder(safeState, note.folderId) || "").trim() : "";
    if (rootId === "dir_original_default" || rootId === "dir_fleeting_default" || rootId === "dir_literature_default") {
      if (folderType) return folderType;
      if (explicitType) return explicitType;
      return "";
    }
    if (explicitType) return explicitType;
    if (folderType) return folderType;
    return "";
  }

  isLiteratureNote(note = this.activeNote()) {
    return this.resolvedNoteType(note) === "literature";
  }

  isOriginalNote(note = this.activeNote()) {
    const noteType = this.resolvedNoteType(note);
    return noteType === "original" || noteType === "permanent";
  }

  isOriginalRecordableSource(note = this.activeNote()) {
    const noteType = this.resolvedNoteType(note);
    return noteType === "fleeting" || noteType === "literature";
  }

  sourceNotePromotionHint(note = this.activeNote()) {
    const noteType = this.resolvedNoteType(note);
    if (noteType === "literature") {
      return "选择保存位置，把文献整理成可独立阅读的判断。";
    }
    if (noteType === "fleeting") {
      return "选择保存位置，把随笔写成可长期保留的判断。";
    }
    return "选择保存位置，然后创建永久笔记。";
  }

  shouldShowFleetingCleanupPrompt(note = this.activeNote()) {
    if (!note?.id || this.resolvedNoteType(note) !== "fleeting" || this.hasGeneratedOriginal(note)) return false;
    return !this.fleetingCleanupDismissedNoteIds?.has?.(note.id);
  }

  dismissFleetingCleanupPrompt(note = this.activeNote()) {
    if (!note?.id) return;
    if (!this.fleetingCleanupDismissedNoteIds) this.fleetingCleanupDismissedNoteIds = new Set();
    this.fleetingCleanupDismissedNoteIds.add(note.id);
  }

  async pickPermanentDirectoryForNote(note = this.activeNote()) {
    if (!note || !this.isOriginalRecordableSource(note)) return "";
    if (!this.selectPermanentDirectory) {
      this.onStatus("当前环境还没有接入永久笔记目录选择器", "warn");
      return "";
    }
    return this.selectPermanentDirectory({
      sourceNoteId: note.id,
      sourceType: this.resolvedNoteType(note),
      sourceTitle: note.title || "",
      sourceHint: this.sourceNotePromotionHint(note)
    });
  }

  generatedOriginalNoteId(note = this.activeNote()) {
    return String(note?.generatedOriginalNoteId || note?.generated_original_note_id || "").trim();
  }

  hasGeneratedOriginal(note = this.activeNote()) {
    return Boolean(this.generatedOriginalNoteId(note));
  }

  isLiteratureWorkspaceActive(note = this.activeNote()) {
    return false;
  }

  isStructuredWorkspaceActive(note = this.activeNote()) {
    return this.isLiteratureWorkspaceActive(note);
  }

  defaultAuthorshipState(note = null) {
    return {
      claim: "",
      confirmed: true,
      confirmedBody: ""
    };
  }

  ensureTabAuthorshipState(tab, note = null) {
    if (!tab) return this.defaultAuthorshipState(note);
    if (!tab.authorshipState || typeof tab.authorshipState !== "object") {
      tab.authorshipState = this.defaultAuthorshipState(note);
    }
    if (!this.isOriginalNote(note)) {
      tab.authorshipState = this.defaultAuthorshipState(null);
    }
    return tab.authorshipState;
  }

  activeAuthorshipState() {
    const tab = this.activeTab();
    const note = this.activeNote();
    return this.ensureTabAuthorshipState(tab, note);
  }

  resetActiveSaveUiState() {
    const tab = this.activeTab();
    if (!tab) return;
    tab.saveUiState = this.defaultSaveUiState(tab);
  }

  authorshipBlockMessage(note = this.activeNote()) {
    return "";
  }

  literatureSectionLabels() {
    return normalizedLiteratureSectionLabels(this.resolveLiteratureSectionLabels?.() || {});
  }

  literatureSectionLabelCandidates() {
    const resolved = this.resolveLiteratureSectionLabelCandidates?.();
    return normalizeLiteratureSectionLabelCandidates(resolved, this.literatureSectionLabels());
  }

  rememberedLiteratureSectionLabels(tab = this.activeTab()) {
    return normalizedLiteratureSectionLabels(tab?.literatureSectionLabels || this.literatureSectionLabels());
  }

  rememberLiteratureWorkspaceParse(parsed = {}, tab = this.activeTab(), body = tab?.body || "") {
    const sectionLabels = normalizedLiteratureSectionLabels(parsed?.sectionLabels || this.literatureSectionLabels());
    if (!tab) return sectionLabels;
    tab.literatureParsedBody = String(body || "");
    tab.literatureSectionLabels = sectionLabels;
    return sectionLabels;
  }

  parseLiteratureBody(body = "") {
    const rawBody = String(body || "");
    const tab = this.activeTab();
    const rememberedLabels =
      tab && tab.literatureParsedBody === rawBody && tab.literatureSectionLabels
        ? normalizedLiteratureSectionLabels(tab.literatureSectionLabels)
        : null;
    const parsed = parseLiteratureWorkspace(
      rawBody,
      rememberedLabels
        ? { sectionLabels: rememberedLabels }
        : { sectionLabelCandidates: this.literatureSectionLabelCandidates() }
    );
    this.rememberLiteratureWorkspaceParse(parsed, tab, rawBody);
    return parsed;
  }

  literatureFieldsFromInputs() {
    const currentCitation = this.parseLiteratureBody(this.els.body?.value || "").citation;
    return {
      title: this.els.literatureTitle?.value || "未命名笔记",
      citation: currentCitation,
      originalText: this.els.literatureOriginal?.value || "",
      paraphrase: this.els.literatureParaphrase?.value || "",
      whyKeep: this.els.literatureWhyKeep?.value || "",
      supportsJudgment: this.els.literatureSupportsJudgment?.value || "",
      question: this.els.literatureQuestion?.value || "",
      boundary: this.els.literatureBoundary?.value || ""
    };
  }

  literatureCompletionState(note = this.activeNote()) {
    const fields = this.isLiteratureWorkspaceActive(note) ? this.literatureFieldsFromInputs() : this.parseLiteratureBody(note?.body || "");
    const hasParaphrase = Boolean(normalizeFieldText(fields.paraphrase));
    const hasOriginalText = Boolean(normalizeFieldText(fields.originalText));
    const hasJudgmentSeed = Boolean(normalizeFieldText(fields.supportsJudgment));
    const hasQuestion = Boolean(normalizeFieldText(fields.question));
    const readyForOriginal = hasOriginalText && hasParaphrase && (hasJudgmentSeed || hasQuestion);
    const generatedOriginal = this.hasGeneratedOriginal(note);
    const citation = literatureCitationState(fields.citation);
    const ready = hasOriginalText && hasParaphrase && citation.complete;
    const status = ready && String(note?.status || "").trim() === "active" ? "active" : "draft";
    const missingCitationText = citation.missingLabels.length ? `缺少引用信息：${citation.missingLabels.join("、")}` : "";
    let label = "待转述";
    let tone = "draft";
    let hint = "先写出你自己的转述，再提炼它可能长出的原创判断。";
    if (generatedOriginal) {
      label = "已转永久笔记";
      tone = "active";
      hint = "这条文献已经作为证据长出永久笔记，可以回到永久笔记继续建立关联。";
    } else if (!citation.complete || !hasOriginalText) {
      label = "待补来源";
      tone = "draft";
      hint = missingCitationText || "先补齐来源信息和原文摘录，避免材料脱离证据链。";
    } else if (!hasParaphrase) {
      label = "待转述";
      tone = "draft";
      hint = "先用自己的话说明这段材料真正表达了什么。";
    } else if (!readyForOriginal) {
      label = "待提炼判断";
      tone = "refine";
      hint = "已经有转述，下一步写出判断种子或追问，让材料能进入永久笔记。";
    } else {
      label = "可转永久笔记";
      tone = "active";
      hint = "这条材料已经具备转为永久笔记的条件。";
    }
    return {
      status,
      hasParaphrase,
      hasOriginalText,
      hasJudgmentSeed,
      hasQuestion,
      readyForOriginal,
      hasCitationMetadata: citation.complete,
      missingCitationFields: citation.missingLabels,
      label,
      tone,
      hint
    };
  }

  literatureQueueScopeDirectoryIds(note = this.activeNote()) {
    const startId = String(note?.folderId || this.state.selectedFolderId || "").trim();
    if (!startId) return new Set();
    const directoryIds = new Set();
    const queue = [startId];
    while (queue.length) {
      const currentId = queue.shift();
      if (!currentId || directoryIds.has(currentId)) continue;
      directoryIds.add(currentId);
      for (const folder of this.state.folders) {
        if (folder.parentId === currentId) queue.push(folder.id);
      }
    }
    return directoryIds;
  }

  literatureQueueRecord(note) {
    const fields = this.parseLiteratureBody(note?.body || "");
    const hasParaphrase = Boolean(normalizeFieldText(fields.paraphrase));
    const citation = literatureCitationState(fields.citation);
    const hasOriginalText = Boolean(normalizeFieldText(fields.originalText));
    const hasWhyKeep = Boolean(normalizeFieldText(fields.whyKeep));
    const hasSupportsJudgment = Boolean(normalizeFieldText(fields.supportsJudgment));
    const hasQuestion = Boolean(normalizeFieldText(fields.question));
    const hasGenerated = this.hasGeneratedOriginal(note);
    let lane = "ready";
    let label = "可转永久笔记";
    let tone = "active";
    let noteText = "转述和判断种子已经具备，可以继续转为永久笔记。";
    if (hasGenerated) {
      lane = "ready";
      label = "已转永久笔记";
      tone = "active";
      noteText = "这条文献已经长出永久笔记，现在作为证据保留。";
    } else if (!citation.complete || !hasOriginalText) {
      lane = "refine";
      label = "待补来源";
      tone = "draft";
      noteText = "先补齐来源信息和原文摘录，后续永久笔记才能保留证据链。";
    } else if (!hasParaphrase) {
      lane = "pending";
      label = "待转述";
      tone = "draft";
      noteText = "先把原文改写成你自己的判断表达，再决定它是否值得留下。";
    } else if (!hasSupportsJudgment && !hasQuestion) {
      lane = "refine";
      label = "待提炼判断";
      tone = "refine";
      noteText = "已经有转述，下一步写出判断种子或追问，让它能转为永久笔记。";
    } else if (!hasWhyKeep) {
      noteText = "已经可转永久笔记；补一句保留原因能帮助以后判断这条证据为什么重要。";
    }
    const excerpt = normalizeFieldText(fields.paraphrase || fields.originalText || "");
    return {
      note,
      fields,
      lane,
      label,
      tone,
      noteText,
          excerpt: excerpt ? excerpt.slice(0, 96) : "这条文献笔记还没有写入任何内容。"
    };
  }

  literatureQueueRecords(note = this.activeNote()) {
    const scopeDirectoryIds = this.literatureQueueScopeDirectoryIds(note);
    const currentId = String(note?.id || "").trim();
    const focusedIds = new Set(
      (Array.isArray(this.state.literatureQueueFocusNoteIds) ? this.state.literatureQueueFocusNoteIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    );
    const priority = { pending: 0, refine: 1, ready: 2 };
    return this.state.notes
      .filter(
        (item) =>
          this.resolvedNoteType(item) === "literature" &&
          scopeDirectoryIds.has(item.folderId) &&
          (!focusedIds.size || focusedIds.has(String(item.id || "").trim()))
      )
      .map((item) => ({
        ...this.literatureQueueRecord(item),
        isCurrent: String(item.id || "").trim() === currentId
      }))
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        const laneDiff = (priority[a.lane] ?? 99) - (priority[b.lane] ?? 99);
        if (laneDiff) return laneDiff;
        const aTime = Date.parse(a.note?.updatedAt || 0) || 0;
        const bTime = Date.parse(b.note?.updatedAt || 0) || 0;
        if (bTime !== aTime) return bTime - aTime;
        return String(a.note?.title || a.note?.id || "").localeCompare(String(b.note?.title || b.note?.id || ""), "zh-CN");
      });
  }

  renderLiteratureQueue(note = this.activeNote()) {
    const summary = this.els.literatureQueueSummary;
    const list = this.els.literatureQueueList;
    const queueNote = this.els.literatureQueueNote;
    const nextButton = this.els.literatureOpenNext;
    const isLiterature = this.isLiteratureWorkspaceActive(note);
    if (!summary || !list || !queueNote || !nextButton) return;
    if (!isLiterature) {
      summary.innerHTML = "";
      list.innerHTML = "";
      queueNote.textContent = "";
      nextButton.disabled = true;
      return;
    }
    const records = this.literatureQueueRecords(note);
    const pendingCount = records.filter((item) => item.lane === "pending").length;
    const refineCount = records.filter((item) => item.lane === "refine").length;
    const readyCount = records.filter((item) => item.lane === "ready").length;
    const nextRecord = records.find((item) => !item.isCurrent && item.lane === "pending") || records.find((item) => !item.isCurrent && item.lane === "refine");
    const scopeFolder = this.state.folders.find((folder) => folder.id === note?.folderId);
    const focusCount = Array.isArray(this.state.literatureQueueFocusNoteIds) ? this.state.literatureQueueFocusNoteIds.length : 0;
    const focusLabel = String(this.state.literatureQueueFocusLabel || "").trim();
    const paraphraseDoneCount = focusCount ? focusCount - pendingCount : 0;
    const remainingCount = pendingCount + refineCount;
    queueNote.textContent = focusCount
      ? `当前范围：${scopeFolder?.name || "当前目录"}。当前只显示${focusLabel || "本次导入"}的 ${focusCount} 条文献笔记；已完成转述 ${paraphraseDoneCount}/${focusCount}，已可转永久笔记 ${readyCount}/${focusCount}，剩余待处理 ${remainingCount} 条。`
      : `当前范围：${scopeFolder?.name || "当前目录"}。先清空待转述，再补齐待提炼，最后再把成熟材料送去永久笔记。`;
    summary.innerHTML = `
      <div class="literature-queue-metric"><strong>${pendingCount}</strong><span>待转述</span></div>
      <div class="literature-queue-metric"><strong>${refineCount}</strong><span>待提炼</span></div>
      <div class="literature-queue-metric"><strong>${readyCount}</strong><span>可转永久笔记</span></div>
    `;
    nextButton.disabled = !nextRecord;
    nextButton.textContent = nextRecord ? `打开下一条${nextRecord.label}` : "当前范围没有待处理条目";
    list.innerHTML = records.length
      ? records
          .map(
            (item) => `
              <article class="literature-queue-item ${item.isCurrent ? "is-current" : ""}">
                <div class="literature-queue-item-head">
                  <div>
                    <div class="literature-queue-item-title">${escapeHtml(item.note.title || item.note.id)}</div>
                    <div class="literature-queue-item-meta">${escapeHtml(item.note.id)}${item.isCurrent ? " · 当前打开" : ""}</div>
                  </div>
                  <span class="literature-status-badge" data-tone="${escapeHtml(item.tone)}">${escapeHtml(item.label)}</span>
                </div>
                <div class="literature-queue-item-note">${escapeHtml(item.noteText)}</div>
                <div class="literature-queue-item-meta">${escapeHtml(item.excerpt)}</div>
                <div class="literature-queue-item-actions">
                  <button class="mini-btn" type="button" data-open-literature-note="${escapeHtml(item.note.id)}">${item.isCurrent ? "继续编辑当前条目" : "打开条目"}</button>
                  ${
                      this.hasGeneratedOriginal(item.note)
                        ? `<span class="item-badge">已生成永久笔记</span>`
                        : item.lane === "ready"
                          ? `<button class="mini-btn primary create-original-cta" type="button" data-create-original-from-literature="${escapeHtml(item.note.id)}">选择目录并创建</button>`
                          : ""
                  }
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="literature-queue-item"><div class="literature-queue-item-note">当前目录还没有文献笔记。先创建一条，再把它放进待转述流程。</div></div>`;
  }

  isSourceMode() {
    return String(this.state.previewMode || "wysiwyg") === "source";
  }

  isWysiwygMode() {
    return !this.isSourceMode();
  }

  currentEditor() {
    if (this.isSourceMode() && this.markdownEditor) return this.markdownEditor;
    if (this.richEditor) return this.richEditor;
    return this.markdownEditor;
  }

  setMarkdownSelectionOverride(from = 0, to = from) {
    this.markdownSelectionOverride = {
      from: Math.max(0, Number(from) || 0),
      to: Math.max(0, Number(to) || 0)
    };
  }

  clearMarkdownSelectionOverride() {
    this.markdownSelectionOverride = null;
  }

  setUnderlyingEditorValue(value) {
    const text = normalizeLooseMarkdownTables(value);
    this.els.body.value = text;
    this.lastEditorValue = text;
    if (this.markdownEditor && this.markdownEditor.getValue() !== text) {
      this.suppressEditorChange = true;
      try {
        this.suppressSourceEditorChange = true;
        this.markdownEditor.setValue(text);
      } finally {
        this.suppressSourceEditorChange = false;
        this.suppressEditorChange = false;
      }
    }
    if (this.richEditor && this.richEditor.getValue() !== text) {
      this.suppressEditorChange = true;
      try {
        this.suppressRichEditorChange = true;
        this.richEditor.setValue(text);
      } finally {
        this.suppressRichEditorChange = false;
        this.suppressEditorChange = false;
      }
    }
    this.scheduleRichAssetRefresh();
  }

  syncLiteratureWorkspaceFromBody(body = "") {
    if (!this.els.literatureWorkspace) return;
    const parsed = this.parseLiteratureBody(body || "");
    this.rememberLiteratureWorkspaceParse(parsed, this.activeTab(), body || "");
    this.suppressLiteratureWorkspaceChange = true;
    try {
      if (this.els.literatureTitle) this.els.literatureTitle.value = parsed.title || "未命名笔记";
      if (this.els.literatureOriginal) this.els.literatureOriginal.value = parsed.originalText || "";
      if (this.els.literatureParaphrase) this.els.literatureParaphrase.value = parsed.paraphrase || "";
      if (this.els.literatureWhyKeep) this.els.literatureWhyKeep.value = parsed.whyKeep || "";
      if (this.els.literatureSupportsJudgment) this.els.literatureSupportsJudgment.value = parsed.supportsJudgment || "";
      if (this.els.literatureQuestion) this.els.literatureQuestion.value = parsed.question || "";
      if (this.els.literatureBoundary) this.els.literatureBoundary.value = parsed.boundary || "";
    } finally {
      this.suppressLiteratureWorkspaceChange = false;
    }
  }

  syncLiteratureWorkspaceToEditor() {
    if (this.suppressLiteratureWorkspaceChange || !this.isLiteratureWorkspaceActive()) return;
    this.setUnderlyingEditorValue(
      composeLiteratureWorkspace(this.literatureFieldsFromInputs(), { sectionLabels: this.rememberedLiteratureSectionLabels() })
    );
  }

  currentSelectionRect() {
    if (this.isSourceMode() && this.markdownEditor?.view?.coordsAtPos) {
      const selection = this.editorSelection();
      const coords = this.markdownEditor.view.coordsAtPos(Math.max(0, Number(selection.to || selection.from || 0)));
      if (coords) return coords;
    }
    const rect = this.richEditor?.selectionRect?.();
    if (rect) return rect;
    const host = (this.isSourceMode() ? this.els.editorHost : this.els.wysiwygHost) || this.els.body;
    return host?.getBoundingClientRect?.() || null;
  }

  currentSelectedEditorText() {
    if (this.isStructuredWorkspaceActive()) return "";
    const value = this.getEditorValue();
    const range = this.normalizedSelectionRangeForValue(value, this.editorSelection());
    if (!range || range.to <= range.from) return "";
    return String(value || "").slice(range.from, range.to).trim();
  }

  selectionAiActionCandidate() {
    const note = this.activeNote();
    if (!note?.id) return null;
    const noteType = this.resolvedNoteType(note);
    if (noteType !== "permanent" && noteType !== "original") return null;
    const value = this.getEditorValue();
    const range = this.normalizedSelectionRangeForValue(value, this.editorSelection());
    if (!range || range.to <= range.from) return null;
    const selectedText = String(value || "").slice(range.from, range.to).trim();
    if (selectedText.replace(/\s+/g, "").length < 6) return null;
    return {
      noteId: note.id,
      selectedText,
      from: range.from,
      to: range.to
    };
  }

  hideSelectionAiAction() {
    this.selectionAiActionState = {
      noteId: "",
      selectedText: "",
      from: 0,
      to: 0
    };
    const root = this.els.selectionAiAction;
    if (!root) return;
    root.classList.add("hidden");
    root.style.left = "";
    root.style.top = "";
  }

  updateSelectionAiAction() {
    const root = this.els.selectionAiAction;
    if (!root) return;
    const candidate = this.selectionAiActionCandidate();
    if (!candidate) {
      this.hideSelectionAiAction();
      return;
    }
    this.selectionAiActionState = candidate;
    root.classList.remove("hidden");
    root.dataset.noteId = candidate.noteId;
    root.dataset.selectionFrom = String(candidate.from);
    root.dataset.selectionTo = String(candidate.to);
    if (this.els.selectionAiActionText) {
      this.els.selectionAiActionText.textContent = `可提炼 ${candidate.selectedText.replace(/\s+/g, "").length} 字`;
    }
    this.positionSelectionAiAction();
  }

  positionSelectionAiAction() {
    const root = this.els.selectionAiAction;
    if (!root || root.classList.contains("hidden")) return;
    const rect = this.currentSelectionRect();
    if (!rect) return;
    const width = Math.min(root.offsetWidth || 260, window.innerWidth - 24);
    const height = root.offsetHeight || 46;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const preferredTop = rect.top - height - 8;
    const fallbackTop = rect.bottom + 8;
    const top = preferredTop >= 12 ? preferredTop : Math.min(fallbackTop, window.innerHeight - height - 12);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(Math.max(12, top))}px`;
  }

  editorScrollNodes() {
    if (this.isLiteratureWorkspaceActive()) {
      return [this.els.literatureParaphrase || this.els.literatureOriginal || this.els.literatureTitle].filter(Boolean);
    }
    if (this.isSourceMode()) {
      return [this.markdownEditor?.view?.scrollDOM, this.els.editorHost, this.els.body].filter(Boolean);
    }
    return [
      this.els.wysiwygHost?.querySelector?.(".toastui-editor-main"),
      this.els.wysiwygHost?.querySelector?.(".toastui-editor-ww-container"),
      this.els.wysiwygHost
    ].filter(Boolean);
  }

  captureEditorScrollState() {
    return {
      mode: this.isSourceMode() ? "source" : this.isLiteratureWorkspaceActive() ? "literature" : "wysiwyg",
      nodes: this.editorScrollNodes().map((node, index) => ({
        index,
        top: Number(node?.scrollTop || 0),
        left: Number(node?.scrollLeft || 0)
      }))
    };
  }

  restoreEditorScrollState(state) {
    if (!state || !Array.isArray(state.nodes)) return false;
    const nodes = this.editorScrollNodes();
    let restored = false;
    for (const snapshot of state.nodes) {
      const node = nodes[snapshot.index];
      if (!node) continue;
      if (typeof snapshot.top === "number") node.scrollTop = snapshot.top;
      if (typeof snapshot.left === "number") node.scrollLeft = snapshot.left;
      restored = true;
    }
    return restored;
  }

  scheduleEditorScrollRestore(state) {
    if (!state) return;
    const restore = () => {
      this.restoreEditorScrollState(state);
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        window.setTimeout(() => this.restoreEditorScrollState(state), 32);
        window.setTimeout(() => this.restoreEditorScrollState(state), 96);
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(restore);
      return;
    }
    restore();
  }

  resetEditorViewportToStart() {
    const reset = () => {
      this.editorScrollNodes().forEach((node) => {
        if (!node) return;
        node.scrollTop = 0;
        node.scrollLeft = 0;
      });
      this.markdownEditor?.setSelectionRange?.(0, 0);
      this.richEditor?.editor?.moveCursorToStart?.(false);
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(reset);
      window.setTimeout?.(reset, 32);
      window.setTimeout?.(reset, 96);
      return;
    }
    reset();
  }

  renderSourceNoteFlowSection(note) {
    const noteType = this.resolvedNoteType(note);
    if (!note?.id || (noteType !== "fleeting" && noteType !== "literature")) return "";

    const generatedOriginalId = this.generatedOriginalNoteId(note);
    const generatedOriginal = generatedOriginalId
      ? this.state.notes.find((item) => item?.id === generatedOriginalId) || null
      : null;
    const activeTab = this.activeTab();
    return renderSourceNotePromotionPanel({
      note,
      noteType,
      generatedOriginal,
      generatedOriginalId,
      generatedDirectoryLabel: generatedOriginal?.folderId ? this.folderLabel(generatedOriginal.folderId) : "",
      isOpen: Boolean(activeTab?.noteId && generatedOriginal?.id && activeTab.noteId === generatedOriginal.id),
      literatureCompletion: noteType === "literature" ? this.literatureCompletionState(note) : null,
      showFleetingCleanup: this.shouldShowFleetingCleanupPrompt(note),
      aiActionState:
        this.sourceDistillAiState?.noteId === note.id
          ? this.sourceDistillAiState
          : null
    });
  }

  renderLiteratureWorkspace() {
    const active = this.isLiteratureWorkspaceActive(this.activeNote());
    this.els.literatureWorkspace?.classList.toggle("hidden", !active);
    if (active) {
      this.els.markdownSplit?.classList.add("hidden");
      this.els.modeEdit?.classList.remove("hidden");
      this.els.modeSplit?.classList.add("hidden");
      return;
    }
    this.els.markdownSplit?.classList.remove("hidden");
    this.els.modeEdit?.classList.remove("hidden");
    this.els.modeSplit?.classList.add("hidden");
    if (!this.isOriginalNote(this.activeNote())) this.hideOriginalityNotice();
  }

  setSaveUiState(mode, message = "") {
    const tab = this.activeTab();
    if (tab) tab.saveUiState = { mode, message };
    else this.saveUiState = { mode, message };
    this.renderSaveHint();
  }

  renderPreview() {
    if (!this.els.preview) return;
    const tab = this.activeTab();
    if (!tab) {
      this.els.preview.innerHTML = `<div class="markdown-preview-empty">打开或新建一条笔记后，这里显示 Markdown 预览。</div>`;
      return;
    }
    const note = this.activeNote();
    const previewHtml = renderMarkdownPreview(this.getEditorValue(), {
      noteMarkdownPath: note?.markdownPath || ""
    });
    this.els.preview.innerHTML = `${previewHtml}${this.renderPreviewRelationLinks(note)}`;
  }

  renderPreviewRelationLinks(note = this.activeNote()) {
    if (!note?.id || this.semanticRelationsState !== "loaded" || !this.currentSemanticRelations) return "";
    const { outgoing, backlinks } = explicitPermanentNoteRelations(this.currentSemanticRelations);
    const rows = [
      ...outgoing.map((link) => ({ link, direction: "outgoing" })),
      ...backlinks.map((link) => ({ link, direction: "incoming" }))
    ];
    if (!rows.length) return "";
    return `
      <section class="preview-relation-links" data-preview-relation-links data-note-id="${escapeHtml(note.id)}">
        <div class="preview-relation-links-title">关系链接</div>
        <div class="preview-relation-links-list">
          ${rows
            .map(({ link, direction }) => {
              const endpoint = this.relationEndpoint(link, direction);
              const directionLabel = direction === "outgoing" ? "关联到" : "关联自";
              const rationale = String(link?.rationale || "").trim();
              return `
                <button class="preview-relation-link" type="button" data-open-linked-note="${escapeHtml(endpoint.id)}">
                  <span>${escapeHtml(directionLabel)} · ${escapeHtml(relationTypeLabel(link?.relationType || "associated_with"))}</span>
                  <strong>${escapeHtml(endpoint.title || endpoint.id)}</strong>
                  ${rationale ? `<small>${escapeHtml(rationale)}</small>` : ""}
                </button>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  closeTransientPanels({ closeInspector = false } = {}) {
    this.closeLinkPicker();
    this.closeTagPicker();
    this.closeAssetPreview();
    this.hideOriginalityNotice();
    if (closeInspector) this.setInspectorVisible(false);
  }

  closeAssetPreview() {
    this.els.assetPreviewMask?.classList.add("hidden");
    if (this.els.assetPreviewBody) this.els.assetPreviewBody.innerHTML = "";
    if (this.els.assetPreviewTitle) this.els.assetPreviewTitle.textContent = "附件预览";
    if (this.els.assetPreviewOpenLink) this.els.assetPreviewOpenLink.href = "#";
  }

  closeTokenPreview() {
    this.els.tokenPreviewMask?.classList.add("hidden");
    if (this.els.tokenPreviewBody) this.els.tokenPreviewBody.innerHTML = "";
    if (this.els.tokenPreviewTitle) this.els.tokenPreviewTitle.textContent = "内容预览";
  }

  openTokenPreview(title = "内容预览", html = "") {
    if (!this.els.tokenPreviewMask || !this.els.tokenPreviewBody || !this.els.tokenPreviewTitle) return;
    this.els.tokenPreviewTitle.textContent = String(title || "内容预览").trim() || "内容预览";
    this.els.tokenPreviewBody.innerHTML = html || `<div class="related-empty">没有可显示的内容。</div>`;
    this.els.tokenPreviewMask.classList.remove("hidden");
  }

  async ensurePreviewNoteLoaded(note) {
    if (!note?.id || (note.bodyLoaded && note.body)) return note;
    try {
      const full = await fetchNote(note.id);
      if (full) {
        note.title = full.title || note.title;
        note.body = typeof full.body === "string" ? full.body : note.body;
        note.markdownPath = full.markdownPath || note.markdownPath;
        note.folderId = full.directoryId || note.folderId;
        note.noteType = full.noteType || note.noteType;
        note.updatedAt = full.updatedAt || note.updatedAt;
        note.tags = parseTags(note.body || "");
        note.links = parseLinks(note.body || "");
        note.bodyLoaded = true;
      }
    } catch (error) {
      this.onStatus(`预览笔记加载失败：${String(error?.message || error)}`, "warn");
    }
    return note;
  }

  renderTokenNotePreview(note, badgeText = "关联笔记") {
    const body = note?.body || `# ${note?.title || "未命名笔记"}\n`;
    const preview = renderMarkdownPreview(body, { noteMarkdownPath: note?.markdownPath || "" });
    return `
      <div class="token-preview-note">
        <div class="token-preview-meta">
          <span>${escapeHtml(badgeText)}</span>
        </div>
        <div class="markdown-preview token-preview-markdown">${preview}</div>
      </div>
    `;
  }

  renderTokenResultList(list = [], emptyText = "没有结果。") {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return `<div class="related-empty">${escapeHtml(emptyText)}</div>`;
    return `
      <div class="token-preview-list">
        ${items
          .map(
            (n) => `
              <article class="token-preview-item">
                <div class="token-preview-item-title">${escapeHtml(n.title || "未命名笔记")}</div>
                <div class="token-preview-item-meta">${escapeHtml(noteTypeText(n.noteType || typeFromFolder(this.state, n.folderId || "")))} · ${escapeHtml(this.folderLabel(n.folderId || ""))}</div>
                ${
                  excerptFromBody(n.body || "", n.title || "")
                    ? `<div class="token-preview-item-body">${escapeHtml(excerptFromBody(n.body || "", n.title || ""))}</div>`
                    : ""
                }
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  openAssetPreview(url = "", label = "") {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) {
      this.onStatus("这条附件当前没有可预览地址", "warn");
      return;
    }
    const previewLabel = String(label || "附件预览").trim() || "附件预览";
    if (!this.els.assetPreviewMask || !this.els.assetPreviewBody || !this.els.assetPreviewTitle) {
      window.open(cleanUrl, "_blank", "noopener,noreferrer");
      return;
    }
    this.els.assetPreviewTitle.textContent = previewLabel;
    if (this.els.assetPreviewOpenLink) this.els.assetPreviewOpenLink.href = cleanUrl;
    if (isPreviewImageUrl(cleanUrl)) {
      this.els.assetPreviewBody.innerHTML = `<img class="asset-preview-image" src="${escapeHtml(cleanUrl)}" alt="${escapeHtml(previewLabel)}">`;
    } else if (isPreviewPdfUrl(cleanUrl) || isPreviewDocumentUrl(cleanUrl)) {
      this.els.assetPreviewBody.innerHTML = `<iframe class="asset-preview-frame" src="${escapeHtml(cleanUrl)}" title="${escapeHtml(previewLabel)}"></iframe>`;
    } else {
      this.els.assetPreviewBody.innerHTML = `
        <div class="asset-preview-empty">
          <div><strong>${escapeHtml(previewLabel)}</strong></div>
          <div>这类附件不支持站内预览。请用浏览器打开后查看。</div>
        </div>
      `;
    }
    this.els.assetPreviewMask.classList.remove("hidden");
  }

  async copyText(text = "", successMessage = "已复制") {
    const value = String(text || "");
    if (!value) {
      this.onStatus("没有可复制的内容", "warn");
      return false;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const temp = document.createElement("textarea");
        temp.value = value;
        temp.setAttribute("readonly", "readonly");
        temp.style.position = "fixed";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      this.onStatus(successMessage, "ok");
      return true;
    } catch (error) {
      this.onStatus(`复制失败：${String(error?.message || error)}`, "bad");
      return false;
    }
  }

  currentTableBlockModel() {
    const block = this.currentBlockRange();
    const lines = String(block?.text || "").replace(/\r\n/g, "\n").split("\n");
    if (!isMarkdownTableStart(lines, 0)) return null;
    const header = parseMarkdownTableRow(lines[0]);
    const body = lines.slice(2).filter((line) => isMarkdownTableRow(line)).map((line) => parseMarkdownTableRow(line));
    const width = Math.max(2, header.length, ...body.map((row) => row.length));
    return { block, lines, header, body, width };
  }

  currentCodeBlockModel() {
    const block = this.currentBlockRange();
    const lines = String(block?.text || "").replace(/\r\n/g, "\n").split("\n");
    if (lines.length < 2 || !isMarkdownCodeFenceLine(lines[0])) return null;
    let closingIndex = lines.length - 1;
    if (!isMarkdownCodeFenceLine(lines[closingIndex] || "")) closingIndex = lines.length;
    const fenceLine = String(lines[0] || "");
    const language = normalizeCodeLanguage(fenceLine.replace(/^\s*```/, "").trim()) || "text";
    const content = lines.slice(1, closingIndex).join("\n");
    return {
      block,
      lines,
      language,
      content,
      hasClosingFence: closingIndex < lines.length
    };
  }

  setTableBlockModel(model, options = {}) {
    if (!model) return false;
    const width = Math.max(2, Number(model.width || 0));
    const headerRow = formatMarkdownTableRow(model.header || [], width);
    const separatorRow = formatMarkdownTableSeparator(width);
    const bodyRows = (model.body?.length ? model.body : [Array.from({ length: width }, (_, index) => (index === 0 ? "内容" : ""))]).map((row) => formatMarkdownTableRow(row, width));
    const next = [headerRow, separatorRow, ...bodyRows].join("\n");
    const selectionText = String(options.selectionText || "").trim();
    let selectionStart = model.block.from + next.length;
    let selectionEnd = selectionStart;
    if (selectionText) {
      const matchIndex = next.indexOf(selectionText);
      if (matchIndex >= 0) {
        selectionStart = model.block.from + matchIndex;
        selectionEnd = selectionStart + selectionText.length;
      }
    }
    this.replaceEditorRange(model.block.from, model.block.to, next, {
      selectionStart,
      selectionEnd
    });
    return true;
  }

  addTableRow() {
    const model = this.currentTableBlockModel();
    if (!model) {
      this.formatCurrentBlock("table");
      return;
    }
    const newRow = Array.from({ length: model.width }, (_, index) => (index === 0 ? "内容" : ""));
    model.body.push(newRow);
    this.setTableBlockModel(model, { selectionText: "内容" });
    this.onStatus("已在当前表格末尾新增一行", "ok");
  }

  addTableColumn() {
    const model = this.currentTableBlockModel();
    if (!model) {
      this.formatCurrentBlock("table");
      return;
    }
    const nextLabel = `列 ${model.width + 1}`;
    model.header = [...model.header, nextLabel];
    model.body = model.body.map((row, rowIndex) => [...row, rowIndex === 0 ? "内容" : ""]);
    model.width += 1;
    this.setTableBlockModel(model, { selectionText: nextLabel });
    this.onStatus("已为当前表格新增一列", "ok");
  }

  setCodeBlockLanguage(nextLanguage = "text") {
    const model = this.currentCodeBlockModel();
    if (!model) {
      this.formatCurrentBlock("code");
      return false;
    }
    const normalizedLanguage = normalizeCodeLanguage(nextLanguage) || "text";
    const supportedValues = new Set(CODE_BLOCK_LANGUAGE_OPTIONS.map((item) => item.value));
    const resolvedLanguage = supportedValues.has(normalizedLanguage) ? normalizedLanguage : "text";
    const currentSelection = this.editorSelection();
    const offsetFromBlockStart = Math.max(0, currentSelection.from - model.block.from);
    const currentFence = String(model.lines?.[0] || "").trim();
    const nextFence = resolvedLanguage === "text" ? "```" : `\`\`\`${resolvedLanguage}`;
    const next = `${nextFence}\n${model.content}\n\`\`\``;
    const delta = nextFence.length - currentFence.length;
    const nextSelection = offsetFromBlockStart <= currentFence.length ? nextFence.length + 1 : offsetFromBlockStart + delta;
    const anchor = model.block.from + Math.max(0, Math.min(nextSelection, next.length));
    this.replaceEditorRange(model.block.from, model.block.to, next, {
      selectionStart: anchor,
      selectionEnd: anchor
    });
    this.onStatus(`已将代码块语言切换为 ${resolvedLanguage}`, "ok");
    return true;
  }

  installToolbarCommandMenu() {
    const menu = this.els.toolbarCommandMenu;
    const list = this.els.toolbarCommandList;
    if (!menu || !list) return;

    list.addEventListener("click", (e) => {
      const button = e.target.closest("[data-toolbar-command]");
      const command = String(button?.dataset.toolbarCommand || "").trim();
      if (!command) return;
      this.runToolbarCommand(command);
      this.renderContextualToolbarState();
      this.focusEditor();
    });
  }

  filterToolbarCommandMenu(query = "") {
    const list = this.els.toolbarCommandList;
    if (!list) return;
    const q = String(query || "").trim().toLowerCase();
    list.querySelectorAll("[data-toolbar-command]").forEach((button) => {
      const label = String(button.textContent || "").trim().toLowerCase();
      const key = String(button.dataset.toolbarCommand || "").trim().toLowerCase();
      const hit = !q || label.includes(q) || key.includes(q);
      button.classList.toggle("hidden", !hit);
    });
  }

  runToolbarCommand(command = "") {
    const cmd = String(command || "").trim();
    if (!cmd) return;
    if (cmd === "quote") this.formatCurrentBlock("quote");
    if (cmd === "checklist") this.formatCurrentBlock("checklist");
    if (cmd === "code") this.formatCurrentBlock("code");
    if (cmd === "table") this.formatCurrentBlock("table");
    if (cmd === "hr") this.formatCurrentBlock("hr");
    if (cmd === "table-row") this.addTableRow();
    if (cmd === "table-column") this.addTableColumn();
  }

  renderPreviewVisibility() {
    const mode = String(this.state.previewMode || "wysiwyg");
    const pendingSelection = this.pendingEditorSelection;
    this.pendingEditorSelection = null;
    this.hideSelectionAiAction();
    const split = this.els.markdownSplit;
    if (split) {
      split.classList.remove("editor-mode-wysiwyg", "editor-mode-source");
      split.classList.add(mode === "source" ? "editor-mode-source" : "editor-mode-wysiwyg");
    }
    const showPreviewPanel = false;
    this.els.previewPanel?.classList.toggle("hidden", !showPreviewPanel);
    this.els.modeEdit?.classList.toggle("active", mode === "source");
    this.updateModeToggleButton(mode);
    this.els.modeSplit?.classList.add("hidden");
    if (this.richEditor && this.markdownEditor) {
      const textareaValue =
        this.els.body && typeof this.els.body.value === "string"
          ? this.els.body.value
          : null;
      const sourceEditorValue =
        this.markdownEditor && typeof this.markdownEditor.getValue === "function"
          ? this.markdownEditor.getValue()
          : null;
      const richEditorValue =
        this.richEditor && typeof this.richEditor.getValue === "function"
          ? this.richEditor.getValue()
          : null;
      const activeTab = typeof this.activeTab === "function" ? this.activeTab() : null;
      const normalizedTextarea = normalizedBodyTextForDirtyCheck(textareaValue ?? "");
      const normalizedSource = normalizedBodyTextForDirtyCheck(sourceEditorValue ?? "");
      const normalizedTabBody = normalizedBodyTextForDirtyCheck(activeTab?.body ?? "");
      const normalizedSavedBody = normalizedBodyTextForDirtyCheck(activeTab?.savedBody ?? "");
      const textareaHasCurrentDirtyBody =
        Boolean(activeTab?.dirty) &&
        textareaValue !== null &&
        normalizedTextarea === normalizedTabBody &&
        normalizedSource === normalizedSavedBody;
      const shouldKeepTextarea =
        textareaValue !== null &&
        (textareaValue === "" || textareaHasCurrentDirtyBody || sourceEditorValue === null || normalizedTextarea === normalizedSource);
      const content = this.isSourceMode() && sourceEditorValue !== null
        ? (textareaHasCurrentDirtyBody ? textareaValue : sourceEditorValue)
        : this.isStructuredWorkspaceActive()
          ? (textareaValue ?? "")
          : shouldKeepTextarea
            ? textareaValue
            : sourceEditorValue ?? richEditorValue ?? textareaValue ?? "";
      const normalizedPendingSelection = this.normalizedSelectionRangeForValue(content, pendingSelection);
      this.setEditorValue(content);
      if (this.isWysiwygMode()) this.refreshRichAssetBindings();
      if (!this.isStructuredWorkspaceActive()) {
        if (this.isSourceMode()) this.clearMarkdownSelectionOverride();
        else if (normalizedPendingSelection) this.setMarkdownSelectionOverride(normalizedPendingSelection.from, normalizedPendingSelection.to);
        if (this.isSourceMode()) this.markdownEditor.focus();
        else this.richEditor.focus();
        if (normalizedPendingSelection) {
          this.setEditorSelectionRange(normalizedPendingSelection.from, normalizedPendingSelection.to);
        }
      }
    }
    this.renderLiteratureWorkspace();
    this.renderContextualToolbarState();
  }

  updateModeToggleButton(mode = "wysiwyg") {
    const button = this.els.modeEdit;
    if (!button) return;
    const workspaceModeLabel = this.isLiteratureWorkspaceActive(this.activeNote()) ? "结构化模式" : "笔记模式";
    if (mode === "source") {
      button.title = `切换到${workspaceModeLabel} Ctrl/Cmd+1`;
      button.dataset.tip = `切换到${workspaceModeLabel} Ctrl/Cmd+1`;
      button.setAttribute("aria-label", `切换到${workspaceModeLabel}`);
      button.innerHTML = `<svg class="tb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.25 3.2h11.5v9.6H2.25z" fill="none" stroke="currentColor" stroke-width="1.15"/><path d="M4.2 5.2h7.6M4.2 7.95h5.1M4.2 10.7h6.5" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/><path d="M11.3 9.05l1.15 1.15-2.15 2.15H9.15v-1.15z" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/></svg><span>${workspaceModeLabel}</span>`;
      return;
    }
    button.title = "切换到源码模式 Ctrl/Cmd+2";
    button.dataset.tip = "切换到源码模式 Ctrl/Cmd+2";
    button.setAttribute("aria-label", "切换到源码模式");
    button.innerHTML = `<svg class="tb-svg" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.2h10v9.6H3z" fill="none" stroke="currentColor" stroke-width="1.15"/><path d="M5 6.05l1.4 1.95L5 9.95M11 6.05L9.6 8 11 9.95M7.4 10.55l1.2-5.1" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/></svg><span>源码模式</span>`;
  }

  renderContextualToolbarState() {
    const active = this.detectActiveFormatting();
    const structured = this.isStructuredWorkspaceActive();
    const canUseRelationLink = this.isOriginalNote(this.activeNote());
    this.els.insertLink?.classList.toggle("hidden", !canUseRelationLink);
    this.els.distillSourceAi?.classList.add("hidden");
    if (this.els.distillSourceAi) {
      this.els.distillSourceAi.title = "创建永久笔记";
      this.els.distillSourceAi.dataset.tip = "创建永久笔记";
      this.els.distillSourceAi.setAttribute("aria-label", "创建永久笔记");
      const label = this.els.distillSourceAi.querySelector("span");
      if (label) label.textContent = "创建永久笔记";
    }
    if (!canUseRelationLink) this.closeLinkPicker();
    if (this.els.headingLevel) {
      const value = Number(active.headingLevel || 0);
      this.els.headingLevel.value = value ? String(value) : this.activeTab() ? "p" : "";
      this.els.headingLevel.disabled = structured;
      this.els.headingLevel.title = structured ? "结构化模式下请切到源码模式再调整标题层级" : "多级标题";
    }
    const buttonDefaults = [
      [this.els.insertImage, "插入图片"],
      [this.els.insertTag, "插入标签 #"],
    ];
    for (const [button, defaultTitle] of buttonDefaults) {
      if (!button) continue;
      button.disabled = structured;
      button.title = structured ? "结构化模式下请切到源码模式再使用这个编辑操作" : defaultTitle;
      button.dataset.tip = button.title;
    }
    this.els.toolbarCommandList?.querySelectorAll("[data-toolbar-command]").forEach((button) => {
      button.disabled = structured;
      button.title = structured ? "结构化模式下请切到源码模式再使用这个编辑操作" : String(button.dataset.tip || button.title || "");
    });
  }

  togglePreview(nextMode = null) {
    const current = String(this.state.previewMode || "wysiwyg");
    const fallbackOrder = ["wysiwyg", "source"];
    let resolved = String(nextMode || "").trim();
    if (!resolved) {
      const currentIndex = fallbackOrder.indexOf(current);
      resolved = fallbackOrder[(currentIndex + 1) % fallbackOrder.length] || "wysiwyg";
    }
    if (!["wysiwyg", "source"].includes(resolved)) resolved = "wysiwyg";
    if (resolved === current) {
      this.renderPreviewVisibility();
      return;
    }
    const latestValue = this.getEditorValue();
    this.pendingEditorSelection = this.isStructuredWorkspaceActive()
      ? null
      : this.normalizedSelectionRangeForValue(latestValue, this.editorSelection());
    this.state.forcedSourcePreviewNoteId = "";
    this.state.previewMode = resolved;
    this.setEditorValue(latestValue);
    this.renderPreviewVisibility();
  }

  async initRichEditor() {
    if (!this.els.wysiwygHost || this.richEditor) return;
    try {
      const { createWysiwygMarkdownEditor } = await import("/vendor/toastui-editor.bundle.js");
      this.richEditor = createWysiwygMarkdownEditor({
        parent: this.els.wysiwygHost,
        doc: this.els.body.value || "",
        initialMode: "wysiwyg",
        onChange: (value) => {
          if (this.suppressRichEditorChange || this.suppressEditorChange) return;
          const normalizedValue = normalizeWysiwygMarkdownValue(value).value;
          this.clearMarkdownSelectionOverride();
          this.els.body.value = normalizedValue;
          if (this.markdownEditor && this.markdownEditor.getValue() !== normalizedValue) {
            this.suppressSourceEditorChange = true;
            try {
              this.markdownEditor.setValue(normalizedValue);
            } finally {
              this.suppressSourceEditorChange = false;
            }
          }
          this.handleEditorInput();
          this.scheduleRichAssetRefresh();
        },
        onKeydown: (event) => this.handleEditorKeydown(event),
        onKeyup: () => {
          this.rememberEditorSelection();
          this.updateToolbarFormattingState();
        },
        onClickToken: (token) => this.handleTokenAction(token)
      });
      this.els.wysiwygHost.addEventListener(
        "mousedown",
        (event) => {
          this.clearMarkdownSelectionOverride();
          if (this.extractRichAssetFromEvent(event)) {
            event.preventDefault();
            return;
          }
          if (this.extractRichMissingAssetFromEvent(event)) {
            event.preventDefault();
            return;
          }
          if (this.extractRichExternalLinkFromEvent(event)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            return;
          }
          if (!this.extractRichTokenFromEvent(event)) return;
          event.preventDefault();
        },
        true
      );
      this.els.wysiwygHost.addEventListener("mouseup", () => {
        setTimeout(() => this.rememberEditorSelection(), 0);
      });
      this.els.wysiwygHost.addEventListener("keyup", () => {
        this.rememberEditorSelection();
      });
      this.els.wysiwygHost.addEventListener(
        "click",
        (event) => {
          const asset = this.extractRichAssetFromEvent(event);
          if (asset?.url) {
            event.preventDefault();
            event.stopPropagation();
            this.openAssetPreview(asset.url, asset.label);
            return;
          }
          const missingAsset = this.extractRichMissingAssetFromEvent(event);
          if (missingAsset?.path) {
            event.preventDefault();
            event.stopPropagation();
            this.onStatus(`附件路径不可预览：${missingAsset.path}`, "warn");
            return;
          }
          const externalLink = this.extractRichExternalLinkFromEvent(event);
          if (externalLink?.url) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            if (event.isTrusted) void this.openExternalUrl(externalLink.url);
            return;
          }
          const token = this.extractRichTokenFromEvent(event);
          if (!token) return;
          event.preventDefault();
          event.stopPropagation();
          this.handleTokenAction(token);
        },
        true
      );
      if (!this.richAssetObserver && typeof MutationObserver !== "undefined") {
        this.richAssetObserver = new MutationObserver(() => this.scheduleRichAssetRefresh());
        this.richAssetObserver.observe(this.els.wysiwygHost, {
          childList: true,
          subtree: true
        });
      }
      this.els.wysiwygHost.addEventListener("paste", (event) => {
        if (this.isSourceMode()) return;
        const files = [...(event.clipboardData?.files || [])].filter((file) => file.type);
        if (!files.length) return;
        event.preventDefault();
        void this.insertAssetFiles(files, { sourceLabel: "粘贴" });
      });
      this.els.wysiwygHost.addEventListener("dragover", (event) => {
        event.preventDefault();
        this.els.wysiwygHost?.classList.add("dragover");
      });
      this.els.wysiwygHost.addEventListener("dragleave", (event) => {
        if (event.relatedTarget && this.els.wysiwygHost?.contains(event.relatedTarget)) return;
        this.els.wysiwygHost?.classList.remove("dragover");
      });
      this.els.wysiwygHost.addEventListener("drop", (event) => {
        event.preventDefault();
        this.els.wysiwygHost?.classList.remove("dragover");
        const files = [...(event.dataTransfer?.files || [])];
        if (files.length) void this.insertAssetFiles(files, { sourceLabel: "拖入" });
      });
      this.setEditorValue(this.els.body.value || "");
      this.scheduleRichAssetRefresh();
    } catch (error) {
      this.onStatus(`所见即所得编辑器加载失败，暂时保留源代码模式：${String(error?.message || error)}`, "warn");
      this.state.previewMode = "source";
      this.renderPreviewVisibility();
    }
  }

  extractRichTokenFromEvent(event) {
    const target = event?.target?.closest?.("[data-wikilink],[data-tag-token]");
    if (!target) return "";
    if (target.dataset.wikilink) return `[[${target.dataset.wikilink}]]`;
    if (target.dataset.tagToken) return `#${target.dataset.tagToken}`;
    return "";
  }

  extractRichAssetFromEvent(event) {
    const target = event?.target?.closest?.("img[data-preview-asset-url], a[data-preview-asset-url]");
    if (!target?.dataset?.previewAssetUrl) return null;
    return {
      url: String(target.dataset.previewAssetUrl || "").trim(),
      label: String(target.dataset.previewAssetLabel || target.getAttribute?.("alt") || target.textContent || "").trim()
    };
  }

  extractRichMissingAssetFromEvent(event) {
    const target = event?.target?.closest?.("[data-preview-missing-asset]");
    const path = String(target?.dataset?.previewMissingAsset || "").trim();
    return path ? { path } : null;
  }

  scheduleRichAssetRefresh() {
    if (!this.els.wysiwygHost) return;
    if (this.richAssetRefreshTimer) return;
    const flush = () => {
      this.richAssetRefreshTimer = 0;
      this.refreshRichAssetBindings();
    };
    if (typeof requestAnimationFrame === "function") {
      this.richAssetRefreshTimer = requestAnimationFrame(flush);
      window.setTimeout(() => this.refreshRichAssetBindings(), 50);
      return;
    }
    this.richAssetRefreshTimer = window.setTimeout(flush, 0);
  }

  refreshRichAssetBindings() {
    const host = this.els.wysiwygHost;
    const noteMarkdownPath = this.activeNote()?.markdownPath || "";
    if (!host) return;

    host.querySelectorAll("img").forEach((node) => {
      const rawPath = String(node.dataset.assetSourcePath || node.getAttribute("src") || "").trim();
      if (!rawPath) return;
      const resolved = resolvePreviewableAsset(rawPath, noteMarkdownPath);
      const previewUrl = String(resolved.previewUrl || "").trim();
      if (!previewUrl) return;
      node.dataset.assetSourcePath = rawPath;
      node.dataset.previewAssetUrl = previewUrl;
      node.dataset.previewAssetLabel = String(node.getAttribute("alt") || attachmentLabelFromPath(rawPath)).trim() || "图片";
      if (node.getAttribute("src") !== previewUrl) node.setAttribute("src", previewUrl);
      node.setAttribute("loading", "lazy");
      node.setAttribute("decoding", "async");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.classList.add("wysiwyg-inline-image", "wysiwyg-inline-asset");
    });

    host.querySelectorAll("a[href]").forEach((node) => {
      const rawPath = String(node.dataset.assetSourcePath || node.getAttribute("href") || "").trim();
      if (!rawPath) return;
      if (/^(#|mailto:|tel:|javascript:)/i.test(rawPath)) return;
      const resolved = resolvePreviewableAsset(rawPath, noteMarkdownPath);
      if (!resolved.isVaultAsset) {
        if (isExternalLinkUrl(rawPath)) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
          if (node.dataset.externalClickBound !== "true") {
            node.dataset.externalClickBound = "true";
            node.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                if (event.isTrusted) void this.openExternalUrl(String(node.getAttribute("href") || rawPath).trim());
              },
              true
            );
          }
        } else {
          node.dataset.previewMissingAsset = rawPath;
          node.setAttribute("href", "#");
          node.setAttribute("role", "button");
          node.classList.add("wysiwyg-inline-attachment", "wysiwyg-inline-asset");
        }
        return;
      }
      const previewUrl = String(resolved.previewUrl || "").trim();
      if (!previewUrl) return;
      node.dataset.assetSourcePath = rawPath;
      node.dataset.previewAssetUrl = previewUrl;
      node.dataset.previewAssetLabel = String(node.textContent || attachmentLabelFromPath(rawPath)).trim() || "附件";
      node.setAttribute("href", previewUrl);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
      node.classList.add("wysiwyg-inline-attachment", "wysiwyg-inline-asset");
    });
  }

  async initMarkdownEditor() {
    if (!this.els.editorHost || this.markdownEditor) return;
    try {
      const { createMarkdownEditor } = await import("/vendor/codemirror-editor.bundle.js");
      this.markdownEditor = createMarkdownEditor({
        parent: this.els.editorHost,
        doc: this.els.body.value || "",
        onChange: (value) => {
          if (this.suppressSourceEditorChange || this.suppressEditorChange) return;
          this.els.body.value = value;
          if (!this.isSourceMode() && this.richEditor && this.richEditor.getValue() !== value) {
            this.suppressRichEditorChange = true;
            try {
              this.richEditor.setValue(value);
            } finally {
              this.suppressRichEditorChange = false;
            }
          }
          this.handleEditorInput();
        }
      });
      this.markdownEditor.indentSelection = (step = 1) => {
        this.indentSelection(step);
      };
      this.els.editorHost.addEventListener("click", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        const position = this.markdownEditor?.view?.posAtCoords?.({ x: event.clientX, y: event.clientY });
        if (typeof position !== "number") return;
        const token = tokenAtCursor(this.getEditorValue(), position);
        this.handleTokenAction(token);
      });
      this.markdownEditor?.view?.contentDOM?.addEventListener(
        "keydown",
        (event) => {
          if (String(event.key || "") !== "Tab" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          this.indentSelection(event.shiftKey ? -1 : 1);
        },
        true
      );
      this.els.editorHost.addEventListener("keydown", (event) => this.handleEditorKeydown(event), true);
      this.els.editorHost.addEventListener("keyup", () => this.updateToolbarFormattingState());
      this.els.editorHost.addEventListener("mouseup", () => this.updateToolbarFormattingState());
      this.els.editorHost.classList.add("ready");
      this.setEditorValue(this.els.body.value || "");
      this.updateToolbarFormattingState();
    } catch (error) {
      this.onStatus(`源代码编辑器加载失败，已降级为基础 textarea：${String(error?.message || error)}`, "warn");
      this.els.body.classList.remove("editor-sync-field");
    }
  }

  getEditorValue() {
    if (this.isLiteratureWorkspaceActive()) {
      return composeLiteratureWorkspace(this.literatureFieldsFromInputs(), { sectionLabels: this.rememberedLiteratureSectionLabels() });
    }
    if (this.isStructuredWorkspaceActive()) {
      return String(this.els.body.value || "").replace(/\r\n/g, "\n");
    }
    const editor = this.markdownEditor && typeof this.markdownEditor.getValue === "function"
      ? this.markdownEditor
      : this.currentEditor();
    if (editor?.getValue) {
      const editorValue = String(editor.getValue() || "").replace(/\r\n/g, "\n");
      const hasTextareaValue = this.els.body && typeof this.els.body.value === "string";
      const textareaValue = hasTextareaValue ? String(this.els.body.value || "").replace(/\r\n/g, "\n") : "";
      const tab = this.activeTab();
      if (
        hasTextareaValue &&
        textareaValue !== editorValue &&
        normalizedBodyTextForDirtyCheck(textareaValue) === normalizedBodyTextForDirtyCheck(tab?.body || "")
      ) {
        return textareaValue;
      }
      if (
        tab?.dirty &&
        hasTextareaValue &&
        textareaValue !== editorValue &&
        normalizedBodyTextForDirtyCheck(editorValue) === normalizedBodyTextForDirtyCheck(tab.savedBody) &&
        normalizedBodyTextForDirtyCheck(textareaValue) === normalizedBodyTextForDirtyCheck(tab.body)
      ) {
        return textareaValue;
      }
      return editorValue;
    }
    return this.els.body.value;
  }

  setEditorValue(value) {
    const text = String(value || "");
    this.setUnderlyingEditorValue(text);
    const tab = this.activeTab();
    if (tab) {
      tab.body = text;
      tab.title = titleFromBody(text);
      this.syncTabDirtyState(tab);
    }
    this.syncLiteratureWorkspaceFromBody(text);
  }

  revealActiveTabBodyAtStart() {
    const tab = this.activeTab();
    const text = String(tab?.body || this.getEditorValue() || "");
    this.setUnderlyingEditorValue(text);
    if (this.richEditor?.editor && typeof this.richEditor.editor.setMarkdown === "function") {
      this.suppressEditorChange = true;
      try {
        this.suppressRichEditorChange = true;
        this.richEditor.editor.setMarkdown(text, false);
      } finally {
        this.suppressRichEditorChange = false;
        this.suppressEditorChange = false;
      }
    }
    this.resetEditorViewportToStart();
  }

  normalizePermanentBodyForSave(body = "") {
    const raw = String(body || "").replace(/\r\n/g, "\n");
    const parsed = parsePermanentWorkspace(raw);
    if (!parsed.structured) return raw;
    return composePermanentWorkspace(parsed, {
      preface: parsed.preface,
      sectionLayout: parsed.sectionLayout,
      repeatedKnownSections: parsed.repeatedKnownSections,
      extraSections: parsed.extraSections
    });
  }

  editorSelection() {
    if (this.isStructuredWorkspaceActive()) {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
        return {
          from: active.selectionStart || 0,
          to: active.selectionEnd || 0
        };
      }
      return { from: 0, to: 0 };
    }
    if (this.isWysiwygMode() && this.markdownSelectionOverride) {
      return this.markdownSelectionOverride;
    }
    if (this.isWysiwygMode()) {
      const wysiwygSelection = this.wysiwygMarkdownSelection();
      if (wysiwygSelection) return wysiwygSelection;
      const remembered = this.rememberedEditorSelection();
      if (remembered) return remembered;
      const valueLength = this.getEditorValue().length;
      return { from: valueLength, to: valueLength };
    }
    const editor = this.currentEditor();
    if (editor?.selection) return editor.selection();
    return { from: this.els.body.selectionStart || 0, to: this.els.body.selectionEnd || 0 };
  }

  focusEditor() {
    if (this.isLiteratureWorkspaceActive()) {
      this.els.literatureParaphrase?.focus();
      return;
    }
    const editor = this.currentEditor();
    if (editor?.focus) editor.focus();
    else this.els.body.focus();
  }

  normalizedSelectionRange(range) {
    if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
    const from = Math.max(0, Number(range.from) || 0);
    const to = Math.max(from, Number(range.to) || 0);
    return { from, to };
  }

  normalizedSelectionRangeForValue(value, range) {
    const normalized = this.normalizedSelectionRange(range);
    if (!normalized) return null;
    const limit = Math.max(0, String(value || "").length);
    const from = Math.max(0, Math.min(limit, normalized.from));
    const to = Math.max(from, Math.min(limit, normalized.to));
    return { from, to };
  }

  wysiwygMarkdownSelection() {
    if (!this.richEditor?.selection) return null;
    const richValue = String(this.richEditor.getValue?.() || "");
    const selection = this.richEditor.selection();
    const from = Number(selection?.from);
    const to = Number(selection?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    if (from < 0 || to < 0 || from > richValue.length || to > richValue.length) return null;
    const normalized = normalizeWysiwygMarkdownValue(richValue, [from, to]);
    return this.normalizedSelectionRangeForValue(this.getEditorValue(), {
      from: normalized.offsets[0],
      to: normalized.offsets[1]
    });
  }

  wysiwygRawOffsetFromMarkdownOffset(offset = 0) {
    const richValue = String(this.richEditor?.getValue?.() || "");
    const normalizedValue = this.getEditorValue();
    const target = Math.max(0, Math.min(normalizedValue.length, Number(offset) || 0));
    let low = 0;
    let high = richValue.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const normalizedPrefixLength = normalizeWysiwygMarkdownValue(richValue.slice(0, mid)).value.length;
      if (normalizedPrefixLength < target) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  rememberEditorSelection(range = null) {
    if (this.isStructuredWorkspaceActive()) return null;
    const explicitSelection = range || (this.isWysiwygMode() ? this.markdownSelectionOverride : null);
    const selection = this.normalizedSelectionRangeForValue(
      this.getEditorValue(),
      explicitSelection || (this.isWysiwygMode() ? this.wysiwygMarkdownSelection() : this.editorSelection())
    );
    if (selection) this.lastEditorSelection = selection;
    return selection;
  }

  rememberedEditorSelection() {
    return this.normalizedSelectionRangeForValue(this.getEditorValue(), this.lastEditorSelection);
  }

  setEditorSelectionRange(from, to) {
    if (this.isLiteratureWorkspaceActive()) {
      const target = this.els.literatureParaphrase || this.els.literatureOriginal || this.els.literatureTitle;
      target?.focus();
      target?.setSelectionRange?.(from, to);
      return;
    }
    const normalized = this.normalizedSelectionRangeForValue(this.getEditorValue(), { from, to });
    const start = normalized?.from ?? 0;
    const end = normalized?.to ?? start;
    this.focusEditor();
    if (this.isWysiwygMode() && this.richEditor?.setSelectionRange) {
      const rawStart = this.wysiwygRawOffsetFromMarkdownOffset(start);
      const rawEnd = this.wysiwygRawOffsetFromMarkdownOffset(end);
      try {
        this.richEditor.setSelectionRange(rawStart, rawEnd);
      } catch {
        this.richEditor.focus?.();
      }
      this.setMarkdownSelectionOverride(start, end);
      this.lastEditorSelection = { from: start, to: end };
      return;
    }
    const editor = this.currentEditor();
    if (editor?.setSelectionRange) {
      try {
        editor.setSelectionRange(start, end);
      } catch {
        editor.focus?.();
      }
      return;
    }
    this.els.body.setSelectionRange(start, end);
  }

  moveVisibleCaretToBlockStart() {
    return false;
  }

  moveCaretToBodyStart() {
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    if (!value.startsWith("# ")) return false;
    const paragraphBreak = value.indexOf("\n\n");
    if (paragraphBreak >= 0) {
      this.setEditorSelectionRange(paragraphBreak + 2, paragraphBreak + 2);
      return true;
    }
    const lineEnd = value.indexOf("\n");
    if (lineEnd >= 0) {
      this.setEditorSelectionRange(lineEnd + 1, lineEnd + 1);
      return true;
    }
    return false;
  }

  moveCaretToInsertedStructure(kind) {
    const { from, to } = this.currentBlockRange();
    const blockText = String(this.getEditorValue() || "").slice(from, to);
    if (kind === "h2" && blockText.startsWith("## ")) {
      this.setEditorSelectionRange(from + 3, to);
      return true;
    }
    if (kind === "quote" && blockText.startsWith("> ")) {
      this.setEditorSelectionRange(from + 2, to);
      return true;
    }
    if (kind === "ul" && blockText.startsWith("- ")) {
      this.setEditorSelectionRange(from + 2, to);
      return true;
    }
    if (kind === "code" && blockText.startsWith("```")) {
      const firstLineEnd = blockText.indexOf("\n");
      const codeEnd = blockText.lastIndexOf("\n```");
      if (firstLineEnd >= 0 && codeEnd > firstLineEnd) {
        this.setEditorSelectionRange(from + firstLineEnd + 1, from + codeEnd);
        return true;
      }
    }
    if (kind === "table" && blockText.trimStart().startsWith("|")) {
      const visibleStart = blockText.indexOf("| ");
      const visibleEnd = blockText.indexOf(" |", Math.max(0, visibleStart + 2));
      if (visibleStart >= 0 && visibleEnd > visibleStart) {
        this.setEditorSelectionRange(from + visibleStart + 2, from + visibleEnd);
        return true;
      }
    }
    return false;
  }

  placeholderTitleRange(text) {
    const value = String(text || "");
    if (!value.startsWith("# ")) return null;
    const lineEnd = value.indexOf("\n");
    const end = lineEnd >= 0 ? lineEnd : value.length;
    const title = normalizedNoteTitleText(value.slice(2, end));
    if (title !== UNTITLED_NOTE_TITLE) return null;
    return { from: 2, to: end };
  }

  placeholderTitleSelectionRange() {
    return this.placeholderTitleRange(this.getEditorValue());
  }

  firstHeadingEntryContext() {
    const value = this.getEditorValue();
    if (!String(value || "").startsWith("# ")) return null;
    const lineEnd = value.indexOf("\n");
    const end = lineEnd >= 0 ? lineEnd : value.length;
    const selection = this.editorSelection();
    if (selection.from !== selection.to) return null;
    if (selection.from < 2 || selection.from > end) return null;
    return {
      value,
      headingEnd: end,
      cursor: selection.from
    };
  }

  isEditingTitleLine() {
    return Boolean(this.firstHeadingEntryContext());
  }

  maybeSaveOnTitleBlur() {
    const tab = this.updateActiveTabFromEditor();
    if (!tab) return;
    const note = this.activeNote();
    if (!note) return;
    if (normalizedNoteTitleText(tab.title) === normalizedNoteTitleText(tab.savedTitle)) return;
    if (Date.now() - this.lastTitleInputAt > 8000) return;
    const now = Date.now();
    if (now - this.lastTitleBlurSaveAt < 450) return;
    this.lastTitleBlurSaveAt = now;

    note.title = tab.title;
    note.body = tab.body;
    note.updatedAt = new Date().toISOString();
    this.renderTabs();
    void this.saveActiveNote({ autoSave: true, trigger: "title-blur", skipOriginalityCheck: true });
  }

  enterBodyFromTitle() {
    const context = this.firstHeadingEntryContext();
    if (!context) return false;
    const { value, headingEnd } = context;
    const replaceHeadingBreak = (from, to, text, selectionStart) => {
      const options = {
        selectionStart,
        selectionEnd: selectionStart
      };
      if (this.isWysiwygMode()) return this.replaceMarkdownWhileInWysiwyg(from, to, text, options);
      this.replaceEditorRange(from, to, text, options);
      return true;
    };
    const afterHeading = value.slice(headingEnd);
    if (afterHeading.startsWith("\n\n")) {
      this.setEditorSelectionRange(headingEnd + 2, headingEnd + 2);
      return true;
    }
    if (afterHeading.startsWith("\n")) {
      return replaceHeadingBreak(headingEnd, headingEnd + 1, "\n\n", headingEnd + 2);
    }
    return replaceHeadingBreak(headingEnd, headingEnd, "\n\n", headingEnd + 2);
  }

  extractRichExternalLinkFromEvent(event) {
    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    const target =
      event?.target?.closest?.("a[href]") ||
      path.find((item) => item?.matches?.("a[href]")) ||
      path.find((item) => item?.closest?.("a[href]"))?.closest?.("a[href]");
    if (!target || target.dataset?.previewAssetUrl) return null;
    const url = String(target.getAttribute("href") || "").trim();
    if (!isExternalLinkUrl(url)) return null;
    return { url };
  }

  async openExternalUrl(url = "") {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return false;
    try {
      if (this.onOpenExternalUrl) {
        const result = await this.onOpenExternalUrl(cleanUrl);
        if (result !== false) {
          this.onStatus("已在外部浏览器打开链接", "ok");
          return true;
        }
      }
      const opened = window.open(cleanUrl, "_blank", "noopener,noreferrer");
      if (opened) {
        this.onStatus("已在新窗口打开链接", "ok");
        return true;
      }
    } catch (error) {
      this.onStatus(`打开链接失败：${String(error?.message || error)}`, "bad");
      return false;
    }
    this.onStatus("没有成功打开外部链接", "warn");
    return false;
  }

  applyPendingEditorFocus() {
    const mode = this.pendingEditorFocus;
    this.pendingEditorFocus = null;
    if (!mode) return;
    if (this.isLiteratureWorkspaceActive()) {
      if (mode === "select-placeholder-title") {
        const titleInput = this.els.literatureTitle;
        titleInput?.focus();
        titleInput?.select?.();
        return;
      }
      this.els.literatureParaphrase?.focus();
      return;
    }
    const applyPlaceholderSelection = () => {
      const markdownRange = this.placeholderTitleSelectionRange();
      if (!markdownRange) return false;
      this.setMarkdownSelectionOverride(markdownRange.from, markdownRange.to);
      if (this.isWysiwygMode() && this.els.wysiwygHost) {
        const heading = this.els.wysiwygHost.querySelector(".toastui-editor-contents h1");
        const titleNode = heading?.firstChild;
        const titleText = String(heading?.textContent || "").trim();
        if (!titleNode || !titleText || normalizedNoteTitleText(titleText) !== UNTITLED_NOTE_TITLE) return false;
        this.richEditor?.focus?.();
        const selection = window.getSelection?.();
        if (!selection) return false;
        const range = document.createRange();
        range.setStart(titleNode, 0);
        range.setEnd(titleNode, titleText.length);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
      this.setEditorSelectionRange(markdownRange.from, markdownRange.to);
      return true;
    };
    const apply = () => {
      if (mode === "select-placeholder-title") {
        if (applyPlaceholderSelection()) {
          if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
            window.setTimeout(() => {
              applyPlaceholderSelection();
            }, 32);
            window.setTimeout(() => {
              applyPlaceholderSelection();
            }, 96);
          }
          return;
        }
      }
      this.focusEditor();
    };
    const scheduleApply = (attempt = 0) => {
      const run = () => {
        if (mode !== "select-placeholder-title") {
          apply();
          return;
        }
        if (applyPlaceholderSelection()) {
          if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
            window.setTimeout(() => {
              applyPlaceholderSelection();
            }, 32);
            window.setTimeout(() => {
              applyPlaceholderSelection();
            }, 96);
          }
          return;
        }
        if (attempt >= 7) {
          this.focusEditor();
          return;
        }
        scheduleApply(attempt + 1);
      };
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
        return;
      }
      setTimeout(run, 16);
    };
    scheduleApply();
  }

  insertAtCursor(text) {
    if (this.isWysiwygMode() && this.richEditor?.insertText) {
      this.richEditor.insertText(String(text || ""));
      this.els.body.value = this.richEditor.getValue();
      this.handleEditorInput();
      return;
    }
    const { from, to } = this.editorSelection();
    this.replaceEditorRange(from, to, text, { selectionStart: from + String(text || "").length });
  }

  wrapSelection(prefix, suffix = "") {
    if (this.isWysiwygMode() && this.richEditor) {
      if (prefix === "**" && suffix === "**") {
        this.richEditor.exec("bold");
        return;
      }
      if (prefix === "*" && suffix === "*") {
        this.richEditor.exec("italic");
        return;
      }
    }
    const value = this.getEditorValue();
    const { from, to } = this.editorSelection();
    let start = from;
    let end = to;
    if (start === end && prefix && suffix) {
      const tokenRange = this.currentWordRange(value, start);
      if (tokenRange) {
        start = tokenRange.from;
        end = tokenRange.to;
      }
    }
    const sel = value.slice(start, end);
    if (!sel && prefix && suffix) {
      const next = `${prefix}${suffix}`;
      this.replaceEditorRange(start, end, next, {
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length
      });
      return;
    }
    const next = `${prefix}${sel}${suffix}`;
    this.replaceEditorRange(start, end, next, {
      selectionStart: start + prefix.length,
      selectionEnd: start + prefix.length + sel.length
    });
  }

  currentWordRange(value, cursor) {
    const text = String(value || "");
    const index = Math.max(0, Math.min(Number(cursor) || 0, text.length));
    if (!text) return null;
    const isTokenChar = (char) => /[\p{L}\p{N}_\-\u4e00-\u9fff]/u.test(char || "");
    let from = index;
    let to = index;
    while (from > 0 && isTokenChar(text[from - 1])) from -= 1;
    while (to < text.length && isTokenChar(text[to])) to += 1;
    if (from === to) return null;
    return { from, to };
  }

  replaceEditorRange(from, to, text, options = {}) {
    const insert = String(text || "");
    const selectionStart = Number.isFinite(options.selectionStart) ? Number(options.selectionStart) : from + insert.length;
    const selectionEnd = Number.isFinite(options.selectionEnd) ? Number(options.selectionEnd) : selectionStart;
    const editor = this.currentEditor();
    if (editor?.replaceRange) {
      editor.replaceRange(from, to, insert);
      this.els.body.value = editor.getValue();
      if (editor !== this.richEditor || this.isSourceMode()) {
        try {
          editor.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          editor.focus?.();
        }
      }
      const syncValue = editor.getValue();
      if (editor !== this.markdownEditor && this.markdownEditor && this.markdownEditor.getValue() !== syncValue) {
        this.suppressSourceEditorChange = true;
        try {
          this.markdownEditor.setValue(syncValue);
        } finally {
          this.suppressSourceEditorChange = false;
        }
      }
      if (editor !== this.richEditor && !this.isSourceMode() && this.richEditor && this.richEditor.getValue() !== syncValue) {
        this.suppressRichEditorChange = true;
        try {
          this.richEditor.setValue(syncValue);
        } finally {
          this.suppressRichEditorChange = false;
        }
      }
      this.handleEditorInput();
      return;
    }
    this.els.body.setRangeText(insert, from, to, "end");
    this.els.body.focus();
    this.els.body.setSelectionRange(selectionStart, selectionEnd);
    this.handleEditorInput();
  }

  replaceMarkdownWhileInWysiwyg(from, to, text, options = {}) {
    if (!this.isWysiwygMode() || !this.markdownEditor?.replaceRange) return false;
    const insert = String(text || "");
    const selectionStart = Number.isFinite(options.selectionStart) ? Number(options.selectionStart) : from + insert.length;
    const selectionEnd = Number.isFinite(options.selectionEnd) ? Number(options.selectionEnd) : selectionStart;
    this.markdownEditor.replaceRange(from, to, insert);
    const syncValue = this.markdownEditor.getValue();
    this.els.body.value = syncValue;
    if (this.richEditor && this.richEditor.getValue() !== syncValue) {
      this.suppressRichEditorChange = true;
      try {
        this.richEditor.setValue(syncValue);
      } finally {
        this.suppressRichEditorChange = false;
      }
    }
    this.setMarkdownSelectionOverride(selectionStart, selectionEnd);
    this.richEditor?.focus?.();
    this.handleEditorInput();
    return true;
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const [, base64 = ""] = result.split(",", 2);
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`读取文件失败：${file?.name || "unknown"}`));
      reader.readAsDataURL(file);
    });
  }

  assetMarkdownSnippet(asset = {}) {
    return assetMarkdownSnippet(asset);
  }

  normalizeAssetInsertText(assets = [], options = {}) {
    const snippets = assets.map((item) => this.assetMarkdownSnippet(item)).filter(Boolean);
    if (!snippets.length) return "";
    const selection = options.selection || this.editorSelection();
    const { from, to } = selection;
    const value = typeof options.value === "string" ? options.value : this.getEditorValue();
    const beforeChar = from > 0 ? value[from - 1] : "";
    const afterChar = to < value.length ? value[to] : "";
    const prefix = beforeChar && beforeChar !== "\n" ? "\n\n" : beforeChar === "\n" ? "\n" : "";
    const suffix = afterChar && afterChar !== "\n" ? "\n\n" : afterChar === "\n" ? "\n" : "";
    return `${prefix}${snippets.join("\n\n")}${suffix}`;
  }

  stableEditorSelectionForAsyncInsert() {
    const value = this.getEditorValue();
    const fallback = { from: value.length, to: value.length };
    try {
      const selection = this.editorSelection();
      const from = Math.max(0, Math.min(value.length, Number(selection?.from ?? fallback.from) || 0));
      const to = Math.max(from, Math.min(value.length, Number(selection?.to ?? from) || from));
      return { value, selection: { from, to } };
    } catch {
      return { value, selection: fallback };
    }
  }

  async insertAssetFiles(filesLike, { sourceLabel = "插入" } = {}) {
    const note = this.activeNote();
    if (!note) {
      this.onStatus("请先打开一个笔记", "warn");
      return;
    }
    const incomingFiles = [...(filesLike || [])].filter(Boolean);
    if (!incomingFiles.length) return;
    const files = incomingFiles.filter(isAllowedAttachmentFile);
    const skipped = incomingFiles.length - files.length;
    if (!files.length) {
      this.onStatus("附件只支持图片、PDF、Markdown、TXT、CSV、JSON 和日志文本", "warn");
      return;
    }
    const insertion = this.stableEditorSelectionForAsyncInsert();
    this.onStatus(`${sourceLabel}文件处理中...`, "ok");
    try {
      const uploaded = [];
      for (const file of files) {
        const contentBase64 = await this.fileToBase64(file);
        const item = await uploadNoteAsset(note.id, {
          fileName: file.name,
          mimeType: file.type || "",
          contentBase64,
          kind: isImageFile(file) ? "image" : "file"
        });
        if (item) uploaded.push(item);
      }
      if (!uploaded.length) throw new Error("未能写入任何附件");
      const currentValue = this.getEditorValue();
      const from = Math.max(0, Math.min(currentValue.length, insertion.selection.from));
      const to = Math.max(from, Math.min(currentValue.length, insertion.selection.to));
      const insertText = this.normalizeAssetInsertText(uploaded, {
        selection: { from, to },
        value: currentValue
      });
      const nextCursor = from + insertText.length;
      if (this.isWysiwygMode() && this.markdownEditor?.replaceRange) {
        this.markdownEditor.replaceRange(from, to, insertText);
        const syncValue = this.markdownEditor.getValue();
        this.els.body.value = syncValue;
        if (this.richEditor && this.richEditor.getValue() !== syncValue) {
          this.suppressRichEditorChange = true;
          try {
            this.richEditor.setValue(syncValue);
          } finally {
            this.suppressRichEditorChange = false;
          }
        }
        this.setMarkdownSelectionOverride(nextCursor, nextCursor);
        this.richEditor?.focus?.();
        this.handleEditorInput();
        this.scheduleRichAssetRefresh();
      } else {
        this.replaceEditorRange(from, to, insertText, {
          selectionStart: nextCursor,
          selectionEnd: nextCursor
        });
      }
      const imageCount = uploaded.filter((item) => item.assetKind === "image").length;
      const fileCount = uploaded.length - imageCount;
      const detail = [];
      if (imageCount) detail.push(`${imageCount} 张图片`);
      if (fileCount) detail.push(`${fileCount} 个附件`);
      this.onStatus(`已插入${detail.join("、")}${skipped ? `，已跳过 ${skipped} 个不支持的文件` : ""}`, skipped ? "warn" : "ok");
    } catch (error) {
      this.onStatus(`插入附件失败：${String(error?.message || error)}`, "bad");
    } finally {
      if (this.els.assetImageInput?.value) this.els.assetImageInput.value = "";
      if (this.els.assetFileInput?.value) this.els.assetFileInput.value = "";
      this.els.editorHost?.classList.remove("dragover");
    }
  }

  titleBlockBoundary(value = this.getEditorValue()) {
    const text = String(value || "").replace(/\r\n/g, "\n");
    if (!text.startsWith("# ")) return null;
    const titleEnd = text.indexOf("\n\n");
    if (titleEnd >= 0) return { from: 0, to: titleEnd };
    const lineEnd = text.indexOf("\n");
    return { from: 0, to: lineEnd >= 0 ? lineEnd : text.length };
  }

  currentBlockRange() {
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    const { from, to } = this.editorSelection();
    const anchor = Math.max(0, Math.min(from, to));
    const seekStart = Math.max(0, anchor - 2);
    let blockStart = value.lastIndexOf("\n\n", seekStart);
    blockStart = blockStart < 0 ? 0 : blockStart + 2;
    let blockEnd = value.indexOf("\n\n", Math.max(anchor, to));
    blockEnd = blockEnd < 0 ? value.length : blockEnd;
    return {
      from: blockStart,
      to: blockEnd,
      text: value.slice(blockStart, blockEnd),
      value
    };
  }

  stripStructuralMarkdown(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.replace(/^\s*(#{1,6}\s+|>\s+|-+\s+|\d+[.)]\s+|```+\s*)/, ""))
      .join("\n");
  }

  defaultStructuredInsert(kind) {
    if (kind === "code") {
      return {
        text: "```\n代码块\n```",
        selectionStart: 4,
        selectionEnd: 7
      };
    }
    if (kind === "table") {
      const text = "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |";
      return {
        text,
        selectionStart: 2,
        selectionEnd: 5
      };
    }
    if (kind === "hr") {
      return {
        text: "---",
        selectionStart: 3,
        selectionEnd: 3
      };
    }
    return null;
  }

  tableBlockFromText(seed = "") {
    const source = String(seed || "").replace(/\r\n/g, "\n").trim();
    if (!source) return "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |";

    const rows = source
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length >= 2 && isMarkdownTableRow(rows[0]) && isMarkdownTableSeparator(rows[1])) {
      const parsedRows = [parseMarkdownTableRow(rows[0]), ...rows.slice(2).filter((line) => isMarkdownTableRow(line)).map((line) => parseMarkdownTableRow(line))];
      const width = Math.max(2, ...parsedRows.map((row) => row.length));
      return [formatMarkdownTableRow(parsedRows[0], width), formatMarkdownTableSeparator(width), ...parsedRows.slice(1).map((row) => formatMarkdownTableRow(row, width))].join("\n");
    }

    const firstRow = rows.find((line) => isMarkdownTableRow(line));
    if (firstRow) {
      const parsed = rows.filter((line) => isMarkdownTableRow(line)).map((line) => parseMarkdownTableRow(line));
      const width = Math.max(2, ...parsed.map((row) => row.length));
      const header = parsed[0];
      const body = parsed.slice(1);
      return [formatMarkdownTableRow(header, width), formatMarkdownTableSeparator(width), ...(body.length ? body : [Array.from({ length: width }, (_, index) => (index === 0 ? "内容" : ""))]).map((row) => formatMarkdownTableRow(row, width))].join("\n");
    }

    const summary = this.stripStructuralMarkdown(source).split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] || "内容";
    return `| 主题 | 说明 |\n| --- | --- |\n| ${summary.replace(/\|/g, " ")} | 补充说明 |`;
  }

  formatCurrentBlock(kind) {
    const headingMatch = /^h([1-6])$/.exec(String(kind || ""));
    const headingLevel = headingMatch ? Number(headingMatch[1]) : 0;
    const active = this.detectActiveFormatting();
    if (this.isWysiwygMode() && this.richEditor) {
      if (headingLevel) {
        this.suppressInlinePickersOnce();
        this.richEditor.exec("heading", { level: headingLevel });
        return;
      }
      if (kind === "quote") {
        if (active.quote) {
          this.clearCurrentBlockStructure();
          return;
        }
        this.richEditor.exec("blockQuote");
        return;
      }
      if (kind === "ul") {
        if (active.ul) {
          this.clearCurrentBlockStructure();
          return;
        }
        this.richEditor.exec("bulletList");
        return;
      }
      if (kind === "checklist") {
        if (active.checklist) {
          this.clearCurrentBlockStructure();
          return;
        }
        this.richEditor.exec("taskList");
        return;
      }
      if (kind === "code") {
        this.richEditor.exec("codeBlock");
        return;
      }
      if (kind === "table") {
        this.richEditor.exec("table");
        return;
      }
      if (kind === "hr") {
        this.richEditor.exec("hr");
        return;
      }
    }
    const block = this.currentBlockRange();
    const titleBoundary = this.titleBlockBoundary(block.value);
    const selection = this.editorSelection();
    const selectionInTitle = Boolean(titleBoundary && selection.from <= titleBoundary.to);
    const hasExplicitSelection = selection.from !== selection.to;
    const blockHasContent = Boolean(block.text.trim());

    if (selectionInTitle) {
      const insertPos = titleBoundary ? titleBoundary.to : 0;
      const insertMap = {
        h1: { text: "\n\n# 标题", selectFrom: "\n\n# ".length, selectLength: "标题".length },
        h2: { text: "\n\n## 小标题", selectFrom: "\n\n## ".length, selectLength: "小标题".length },
        h3: { text: "\n\n### 小标题", selectFrom: "\n\n### ".length, selectLength: "小标题".length },
        h4: { text: "\n\n#### 小标题", selectFrom: "\n\n#### ".length, selectLength: "小标题".length },
        h5: { text: "\n\n##### 小标题", selectFrom: "\n\n##### ".length, selectLength: "小标题".length },
        h6: { text: "\n\n###### 小标题", selectFrom: "\n\n###### ".length, selectLength: "小标题".length },
        quote: { text: "\n\n> 引用内容", selectFrom: "\n\n> ".length, selectLength: "引用内容".length },
        ul: { text: "\n\n- 列表项", selectFrom: "\n\n- ".length, selectLength: "列表项".length },
        checklist: { text: "\n\n- [ ] 待办项", selectFrom: "\n\n- [ ] ".length, selectLength: "待办项".length },
        code: { text: "\n\n```\n代码块\n```\n\n", selectFrom: "\n\n```\n".length, selectLength: "代码块".length },
        table: { text: "\n\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n\n", selectFrom: "\n\n| ".length, selectLength: "列 1".length },
        hr: { text: "\n\n---\n\n", selectFrom: "\n\n---\n\n".length, selectLength: 0 }
      };
      const insert = insertMap[kind];
      if (!insert) return;
      if (headingLevel) this.suppressInlinePickersOnce();
      this.replaceEditorRange(insertPos, insertPos, insert.text, {
        selectionStart: insertPos + insert.selectFrom,
        selectionEnd: insertPos + insert.selectFrom + insert.selectLength
      });
      return;
    }

    if (!hasExplicitSelection && blockHasContent && ["code", "table", "hr"].includes(kind) && !active[kind]) {
      const insert = this.defaultStructuredInsert(kind);
      if (!insert) return;
      const prefix = block.to > 0 && !block.value.slice(Math.max(0, block.to - 2), block.to).includes("\n\n") ? "\n\n" : block.to === 0 ? "" : "";
      const suffix = "\n\n";
      const insertText = `${prefix}${insert.text}${suffix}`;
      const anchorBase = block.to + prefix.length;
      this.replaceEditorRange(block.to, block.to, insertText, {
        selectionStart: anchorBase + insert.selectionStart,
        selectionEnd: anchorBase + insert.selectionEnd
      });
      return;
    }

    const raw = block.text.trim() || (headingLevel ? "小标题" : kind === "quote" ? "引用内容" : "列表项");
    if (kind === "checklist") {
      const checklistSeed = block.text.trim() || "待办项";
      const lines = this.stripStructuralMarkdown(checklistSeed)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
      const next = (lines.length ? lines : ["待办项"]).map((line) => `- [ ] ${line}`).join("\n");
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from + 6,
        selectionEnd: block.from + next.length
      });
      return;
    }
    if (kind === "code") {
      const seed = block.text.trim() || "代码块";
      const content = seed.replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "") || "代码块";
      const inferredLanguage = inferCodeLanguage(content);
      const fence = inferredLanguage && inferredLanguage !== "text" ? `\`\`\`${inferredLanguage}` : "```";
      const next = `${fence}\n${content}\n\`\`\``;
      const selectionOffset = fence.length + 1;
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from + selectionOffset,
        selectionEnd: block.from + selectionOffset + content.length
      });
      return;
    }
    if (kind === "table") {
      const next = this.tableBlockFromText(block.text);
      const cellStart = next.indexOf("| ");
      const cellEnd = next.indexOf(" |", Math.max(0, cellStart + 2));
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from + (cellStart >= 0 ? cellStart + 2 : 0),
        selectionEnd: block.from + (cellEnd > cellStart ? cellEnd : next.length)
      });
      return;
    }
    if (kind === "hr") {
      const next = "---";
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from + next.length,
        selectionEnd: block.from + next.length
      });
      return;
    }
    const clean = this.stripStructuralMarkdown(raw).trim() || raw.trim();
    if (kind === "quote" && active.quote) {
      const next = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean).join("\n") || "正文";
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from,
        selectionEnd: block.from + next.length
      });
      return;
    }
    if (kind === "ul" && active.ul) {
      const next = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean).join("\n") || "正文";
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from,
        selectionEnd: block.from + next.length
      });
      return;
    }
    if (kind === "checklist" && active.checklist) {
      const next = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean).join("\n") || "正文";
      this.replaceEditorRange(block.from, block.to, next, {
        selectionStart: block.from,
        selectionEnd: block.from + next.length
      });
      return;
    }
    let next = raw;
    if (headingLevel) next = `${"#".repeat(headingLevel)} ${clean.replace(/\s*\n+\s*/g, " ").trim()}`;
    if (kind === "quote") next = clean.split(/\n+/).map((line) => `> ${line.trim()}`).join("\n");
    if (kind === "ul") next = clean.split(/\n+/).map((line) => `- ${line.trim()}`).join("\n");
    const selectionStart = headingLevel ? block.from + headingLevel + 1 : block.from;
    const selectionEnd = block.from + next.length;
    if (headingLevel) this.suppressInlinePickersOnce();
    this.replaceEditorRange(block.from, block.to, next, {
      selectionStart,
      selectionEnd
    });
  }

  clearCurrentHeading() {
    const block = this.currentBlockRange();
    const text = String(block?.text || "");
    const match = text.match(/^(\s*)#{1,6}\s+/);
    if (!match) return;
    const next = `${match[1] || ""}${text.slice(match[0].length)}`;
    const selection = this.editorSelection();
    const removed = match[0].length - (match[1] || "").length;
    const nextStart = Math.max(block.from, selection.from - removed);
    const nextEnd = Math.max(nextStart, selection.to - removed);
    if (this.isWysiwygMode() && this.markdownEditor?.replaceRange) {
      this.suppressInlinePickersOnce();
      this.markdownEditor.replaceRange(block.from, block.to, next);
      const syncValue = this.markdownEditor.getValue();
      this.els.body.value = syncValue;
      if (this.richEditor && this.richEditor.getValue() !== syncValue) {
        this.suppressRichEditorChange = true;
        try {
          this.richEditor.setValue(syncValue);
        } finally {
          this.suppressRichEditorChange = false;
        }
      }
      this.richEditor?.setSelectionRange?.(nextStart, nextEnd);
      this.handleEditorInput();
      return;
    }
    this.suppressInlinePickersOnce();
    this.replaceEditorRange(block.from, block.to, next, {
      selectionStart: nextStart,
      selectionEnd: nextEnd
    });
  }

  clearCurrentBlockStructure(fallback = "正文") {
    const block = this.currentBlockRange();
    const text = String(block?.text || "");
    const clean = this.stripStructuralMarkdown(text)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n") || fallback;
    const selection = this.editorSelection();
    const nextStart = Math.max(block.from, Math.min(block.from + clean.length, selection.from));
    const nextEnd = Math.max(nextStart, Math.min(block.from + clean.length, selection.to));
    if (this.isWysiwygMode() && this.markdownEditor?.replaceRange) {
      this.suppressInlinePickersOnce();
      this.markdownEditor.replaceRange(block.from, block.to, clean);
      const syncValue = this.markdownEditor.getValue();
      this.els.body.value = syncValue;
      if (this.richEditor && this.richEditor.getValue() !== syncValue) {
        this.suppressRichEditorChange = true;
        try {
          this.richEditor.setValue(syncValue);
        } finally {
          this.suppressRichEditorChange = false;
        }
      }
      this.richEditor?.setSelectionRange?.(nextStart, nextEnd);
      this.handleEditorInput();
      return;
    }
    this.suppressInlinePickersOnce();
    this.replaceEditorRange(block.from, block.to, clean, {
      selectionStart: block.from,
      selectionEnd: block.from + clean.length
    });
  }

  indentSelection(step = 1) {
    if (this.isWysiwygMode() && this.richEditor) {
      this.richEditor.exec(step < 0 ? "outdent" : "indent");
      return;
    }
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    const selection = this.editorSelection();
    const from = Math.max(0, Math.min(selection.from, selection.to));
    const to = Math.max(selection.from, selection.to);
    const lineStart = value.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
    let lineEnd = value.indexOf("\n", to);
    if (lineEnd < 0) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const isOutdent = step < 0;
    const nextLines = lines.map((line) => {
      if (isOutdent) {
        if (line.startsWith("  ")) return line.slice(2);
        if (line.startsWith("\t")) return line.slice(1);
        return line;
      }
      return `  ${line}`;
    });
    const nextText = nextLines.join("\n");
    const delta = nextText.length - block.length;
    const adjustedStart = isOutdent ? Math.max(lineStart, from - 2) : from + 2;
    const adjustedEnd = isOutdent ? Math.max(adjustedStart, to + delta) : to + (2 * lines.length);
    const nextValue = `${value.slice(0, lineStart)}${nextText}${value.slice(lineEnd)}`;
    this.els.body.value = nextValue;
    if (this.markdownEditor && this.markdownEditor.getValue() !== nextValue) {
      this.suppressEditorChange = true;
      this.suppressSourceEditorChange = true;
      try {
        this.markdownEditor.setValue(nextValue);
      } finally {
        this.suppressSourceEditorChange = false;
        this.suppressEditorChange = false;
      }
    }
    this.markdownEditor?.setSelectionRange?.(adjustedStart, adjustedEnd);
    this.handleEditorInput();
  }

  detectActiveFormatting() {
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    const selection = this.editorSelection();
    const anchor = Math.max(0, Math.min(selection.from, selection.to));
    const block = this.currentBlockRange();
    const text = String(block?.text || "").trimStart();
    const inTitle = Boolean(this.titleBlockBoundary(value) && anchor <= this.titleBlockBoundary(value).to);
    const tableLines = String(block?.text || "").replace(/\r\n/g, "\n").split("\n");
    const headingLevel = inTitle ? 0 : Number((/^#{1,6}(?=\s)/.exec(text)?.[0] || "").length || 0);
    return {
      headingLevel,
      h1: headingLevel === 1,
      h2: headingLevel === 2,
      h3: headingLevel === 3,
      h4: headingLevel === 4,
      h5: headingLevel === 5,
      h6: headingLevel === 6,
      quote: !inTitle && /^>\s+/.test(text),
      ul: !inTitle && /^-\s+/.test(text) && !/^-\s\[(?: |x|X)\]\s/.test(text),
      checklist: !inTitle && /^-\s\[(?: |x|X)\]\s/.test(text),
      code: !inTitle && /^```/.test(text),
      table: !inTitle && isMarkdownTableStart(tableLines, 0),
      hr: !inTitle && isHorizontalRuleLine(text)
    };
  }

  currentLineContext() {
    const selection = this.editorSelection();
    if (selection.from !== selection.to) return null;
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    const cursor = selection.from;
    const lineStart = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
    let lineEnd = value.indexOf("\n", cursor);
    if (lineEnd < 0) lineEnd = value.length;
    return {
      value,
      cursor,
      lineStart,
      lineEnd,
      lineText: value.slice(lineStart, lineEnd)
    };
  }

  handleStructuredEnter() {
    const context = this.currentLineContext();
    if (!context) return false;
    const { cursor, lineStart, lineEnd, lineText } = context;
    if (cursor !== lineEnd) return false;

    const checklistMatch = lineText.match(/^(\s*[-*+]\s)\[(?: |x|X)\]\s?(.*)$/);
    if (checklistMatch) {
      const [, bulletPrefix, body] = checklistMatch;
      if (!String(body || "").trim()) {
        this.replaceEditorRange(lineStart, lineEnd, "", {
          selectionStart: lineStart,
          selectionEnd: lineStart
        });
        return true;
      }
      this.replaceEditorRange(cursor, cursor, `\n${bulletPrefix}[ ] `, {
        selectionStart: cursor + bulletPrefix.length + 6,
        selectionEnd: cursor + bulletPrefix.length + 6
      });
      return true;
    }

    const orderedMatch = lineText.match(/^(\s*)(\d+)([.)])\s(.*)$/);
    if (orderedMatch) {
      const [, indent, number, marker, body] = orderedMatch;
      if (!String(body || "").trim()) {
        this.replaceEditorRange(lineStart, lineEnd, "", {
          selectionStart: lineStart,
          selectionEnd: lineStart
        });
        return true;
      }
      const nextNumber = Number(number) + 1;
      const prefix = `${indent}${nextNumber}${marker} `;
      this.replaceEditorRange(cursor, cursor, `\n${prefix}`, {
        selectionStart: cursor + 1 + prefix.length,
        selectionEnd: cursor + 1 + prefix.length
      });
      return true;
    }

    const bulletMatch = lineText.match(/^(\s*[-*+]\s)(.*)$/);
    if (bulletMatch) {
      const [, prefix, body] = bulletMatch;
      if (!String(body || "").trim()) {
        this.replaceEditorRange(lineStart, lineEnd, "", {
          selectionStart: lineStart,
          selectionEnd: lineStart
        });
        return true;
      }
      this.replaceEditorRange(cursor, cursor, `\n${prefix}`, {
        selectionStart: cursor + 1 + prefix.length,
        selectionEnd: cursor + 1 + prefix.length
      });
      return true;
    }

    const quoteMatch = lineText.match(/^(\s*>\s?)(.*)$/);
    if (quoteMatch) {
      const [, prefix, body] = quoteMatch;
      if (!String(body || "").trim()) {
        this.replaceEditorRange(lineStart, lineEnd, "", {
          selectionStart: lineStart,
          selectionEnd: lineStart
        });
        return true;
      }
      this.replaceEditorRange(cursor, cursor, `\n${prefix}`, {
        selectionStart: cursor + 1 + prefix.length,
        selectionEnd: cursor + 1 + prefix.length
      });
      return true;
    }

    return false;
  }

  handlePlainParagraphEnter() {
    if (!this.isWysiwygMode()) return false;
    const selection = this.editorSelection();
    if (selection.from !== selection.to) return false;
    const value = String(this.getEditorValue() || "").replace(/\r\n/g, "\n");
    if (!value.endsWith("\n\n") || selection.from < value.length - 1) return false;
    const hasBodyParagraph = value
      .slice(0, -2)
      .split("\n")
      .map((line) => line.trim())
      .some((line) => line && !/^#{1,6}\s/.test(line) && line !== "<br>");
    if (!hasBodyParagraph) return false;
    const insert = "<br>\n\n";
    return this.replaceMarkdownWhileInWysiwyg(value.length, value.length, insert, {
      selectionStart: value.length + insert.length,
      selectionEnd: value.length + insert.length
    });
  }

  handleStructuredBackspace() {
    const context = this.currentLineContext();
    if (!context) return false;
    const { cursor, lineStart, lineEnd, lineText } = context;
    if (cursor !== lineEnd || cursor !== lineStart + lineText.length) return false;

    const checklistMatch = lineText.match(/^(\s*[-*+]\s)\[(?: |x|X)\]\s?$/);
    if (checklistMatch) {
      this.replaceEditorRange(lineStart, lineEnd, "", {
        selectionStart: lineStart,
        selectionEnd: lineStart
      });
      return true;
    }

    const orderedMatch = lineText.match(/^(\s*)(\d+)([.)])\s$/);
    if (orderedMatch) {
      this.replaceEditorRange(lineStart, lineEnd, "", {
        selectionStart: lineStart,
        selectionEnd: lineStart
      });
      return true;
    }

    const bulletMatch = lineText.match(/^(\s*[-*+]\s)$/);
    if (bulletMatch) {
      this.replaceEditorRange(lineStart, lineEnd, "", {
        selectionStart: lineStart,
        selectionEnd: lineStart
      });
      return true;
    }

    const quoteMatch = lineText.match(/^(\s*>\s?)$/);
    if (quoteMatch) {
      this.replaceEditorRange(lineStart, lineEnd, "", {
        selectionStart: lineStart,
        selectionEnd: lineStart
      });
      return true;
    }

    return false;
  }

  updateToolbarFormattingState() {
    const active = this.detectActiveFormatting();
    document.querySelectorAll(".tb[data-md]").forEach((btn) => {
      const type = btn.dataset.md;
      if (!type || !(type in active)) return;
      btn.classList.toggle("active", Boolean(active[type]));
    });
    this.renderContextualToolbarState();
    this.updateSelectionAiAction();
  }

  scopedLinkCandidates() {
    const note = this.activeNote();
    if (!note) return [];
    const rootId = rootBoxIdFromFolder(this.state, note.folderId);
    return this.state.notes.filter(
      (n) => rootBoxIdFromFolder(this.state, n.folderId) === rootId && n.id !== note.id && this.isOriginalNote(n)
    );
  }

  linkResolutionCandidates(options = {}) {
    let fallbackActiveNote = null;
    if (!Object.prototype.hasOwnProperty.call(options, "excludeNoteId") && typeof this.activeNote === "function") {
      try {
        fallbackActiveNote = this.activeNote();
      } catch {}
    }
    const excludeNoteId = Object.prototype.hasOwnProperty.call(options, "excludeNoteId")
      ? String(options.excludeNoteId || "").trim()
      : String(fallbackActiveNote?.id || "").trim();
    return (Array.isArray(this.state?.notes) ? this.state.notes : []).filter((note) => !excludeNoteId || String(note?.id || "") !== excludeNoteId);
  }

  folderLabel(folderId) {
    const folder = this.state.folders.find((f) => f.id === folderId);
    if (!folder) return "未知目录";
    const names = [folder.name];
    let cursor = folder;
    while (cursor?.parentId) {
      cursor = this.state.folders.find((f) => f.id === cursor.parentId) || null;
      if (cursor) names.unshift(cursor.name);
    }
    return names.join(" / ");
  }

  knownFolderLabel(folderId) {
    const folder = this.state.folders.find((f) => f.id === folderId);
    if (!folder) return "";
    const names = [folder.name];
    let cursor = folder;
    while (cursor?.parentId) {
      cursor = this.state.folders.find((f) => f.id === cursor.parentId) || null;
      if (cursor) names.unshift(cursor.name);
    }
    return names.join(" / ");
  }

  relatedNoteMeta(note, { includeFolder = true } = {}) {
    const typeLabel = noteTypeText(note?.noteType || typeFromFolder(this.state, note?.folderId || ""));
    const folderText = includeFolder ? this.knownFolderLabel(note?.folderId || "") : "";
    return [typeLabel, folderText].filter(Boolean).join(" · ");
  }

  tagMatchBadges(note, primaryTag = "", limit = 3) {
    const tags = Array.isArray(note?.tags) && note.tags.length ? note.tags : parseTags(String(note?.body || ""));
    const primary = normalizeClickedTag(primaryTag);
    const ordered = [
      ...(primary ? [primary] : []),
      ...tags.filter((tag) => tag !== primary)
    ].slice(0, limit);
    return ordered;
  }

  compactFolderLabel(folderId) {
    return this.folderLabel(folderId).replace(/\s*\/\s*/g, "/");
  }

  linkCandidateDisplayTitle(note) {
    const targetTitle = String(note?.title || note?.id || "未命名笔记").trim() || "未命名笔记";
    const activeNote = this.activeNote();
    if (!activeNote?.folderId || !note?.folderId || activeNote.folderId === note.folderId) return targetTitle;
    return `${this.compactFolderLabel(note.folderId)}/${targetTitle}`;
  }

  resolveLinkToken(token, scopedNotes = this.linkResolutionCandidates()) {
    const raw = wikilinkTargetFromRaw(token);
    if (!raw) return null;

    const byId = scopedNotes.find((n) => normalizeText(n.id) === normalizeText(raw));
    if (byId) return { note: byId, ambiguous: false, mode: "id" };

    const pathCandidates = markdownReferencePathCandidates(raw);
    for (const candidatePath of pathCandidates) {
      const byPath = scopedNotes.filter((n) => noteMatchesMarkdownReferencePath(n, candidatePath));
      if (byPath.length === 1) return { note: byPath[0], ambiguous: false, mode: "path" };
      if (byPath.length > 1) return { note: byPath[0], ambiguous: true, mode: "path" };
    }

    const exactTitle = scopedNotes.filter((n) => normalizeText(n.title) === normalizeText(raw));
    if (exactTitle.length === 1) return { note: exactTitle[0], ambiguous: false, mode: "title" };
    if (exactTitle.length > 1) return { note: exactTitle[0], ambiguous: true, mode: "title" };

    const fuzzy = scopedNotes.find(
      (n) => normalizeText(n.title).includes(normalizeText(raw)) || normalizeText(n.id).includes(normalizeText(raw))
    );
    if (fuzzy) return { note: fuzzy, ambiguous: false, mode: "fuzzy" };
    return null;
  }

  hasResolvedLinkToNote(noteId, body = this.getEditorValue(), scopedNotes = this.scopedLinkCandidates()) {
    const targetId = String(noteId || "").trim();
    if (!targetId) return false;
    return parseLinks(body).some((token) => {
      const resolved = this.resolveLinkToken(token, scopedNotes);
      return resolved?.ambiguous !== true && resolved?.note?.id === targetId;
    });
  }

  upsertApiNotes(items = []) {
    for (const item of items) {
      const existing = this.state.notes.find((n) => n.id === item.id);
      if (existing) {
        existing.title = item.title || existing.title;
        existing.folderId = item.directoryId || item.folderId || existing.folderId;
        existing.noteType = item.noteType || existing.noteType;
        existing.markdownPath = item.markdownPath || existing.markdownPath;
        if (Object.prototype.hasOwnProperty.call(item, "thinkingStatus")) {
          existing.thinkingStatus = item.thinkingStatus || null;
        }
        if (Object.prototype.hasOwnProperty.call(item, "thesis")) {
          existing.thesis = item.thesis || "";
        }
        if (Object.prototype.hasOwnProperty.call(item, "threeLineSummary")) {
          existing.threeLineSummary = Array.isArray(item.threeLineSummary) ? item.threeLineSummary : [];
        }
        if (Object.prototype.hasOwnProperty.call(item, "distillationStatus")) {
          existing.distillationStatus = item.distillationStatus || "";
        }
        if (Object.prototype.hasOwnProperty.call(item, "startingQuestion")) {
          existing.startingQuestion = item.startingQuestion || "";
        }
        if (Object.prototype.hasOwnProperty.call(item, "viewpointHistory")) {
          existing.viewpointHistory = Array.isArray(item.viewpointHistory) ? item.viewpointHistory : [];
        }
        if (Object.prototype.hasOwnProperty.call(item, "pendingViewpointRevision")) {
          existing.pendingViewpointRevision = item.pendingViewpointRevision || null;
        }
        if (typeof item.body === "string") {
          existing.body = item.body;
          existing.tags = parseTags(item.body);
          existing.links = parseLinks(item.body);
          existing.bodyLoaded = true;
        }
        existing.updatedAt = item.updatedAt || existing.updatedAt;
        continue;
      }
      const body = typeof item.body === "string" ? item.body : `# ${item.title || "未命名笔记"}\n`;
      this.state.notes.push({
        id: item.id,
        title: item.title || "未命名笔记",
        folderId: item.directoryId || item.folderId,
        noteType: item.noteType || "original",
        markdownPath: item.markdownPath || "",
        thesis: item.thesis || "",
        threeLineSummary: Array.isArray(item.threeLineSummary) ? item.threeLineSummary : [],
        distillationStatus: item.distillationStatus || "",
        startingQuestion: item.startingQuestion || "",
        viewpointHistory: Array.isArray(item.viewpointHistory) ? item.viewpointHistory : [],
        pendingViewpointRevision: item.pendingViewpointRevision || null,
        thinkingStatus: item.thinkingStatus || null,
        body,
        tags: parseTags(body),
        links: parseLinks(body),
        bodyLoaded: typeof item.body === "string",
        updatedAt: item.updatedAt || new Date().toISOString()
      });
    }
  }

  async fetchNoteForResolution(noteId) {
    return fetchNote(noteId);
  }

  detectInlineLinkContext() {
    const selection = this.editorSelection();
    if (selection.from !== selection.to) return null;
    const text = this.getEditorValue();
    const cursor = selection.from || 0;
    const tryCursor = (candidateCursor) => {
      const left = text.slice(0, candidateCursor);
      const asciiStart = left.lastIndexOf("[[");
      const fullWidthStart = left.lastIndexOf("【【");
      const start = Math.max(asciiStart, fullWidthStart);
      if (start < 0) return null;
      const lastClose = Math.max(left.lastIndexOf("]]"), left.lastIndexOf("】】"));
      if (lastClose > start) return null;
      const query = left.slice(start + 2);
      if (query.includes("\n")) return null;
      return { start, end: candidateCursor, query };
    };
    const direct = tryCursor(cursor);
    if (direct) return direct;
    if (this.isWysiwygMode() && cursor < text.length) return tryCursor(cursor + 1);
    return null;
  }

  detectInlineTagContext() {
    const selection = this.editorSelection();
    if (selection.from !== selection.to) return null;
    const text = this.getEditorValue();
    const cursor = selection.from || 0;
    const tryCursor = (candidateCursor) => {
      const left = text.slice(0, candidateCursor);
      const match = left.match(/(^|[\s([{'"“‘>，。；：!?！？、])#([^\s#\]\[(){}"'“”‘’.,，。！？!?;:：]*)$/u);
      if (!match) return null;
      const hashOffset = match[0].lastIndexOf("#");
      const start = left.length - (match[0].length - hashOffset);
      const query = match[2] || "";
      return { start, end: candidateCursor, query };
    };
    const direct = tryCursor(cursor);
    if (direct) return direct;
    if (this.isWysiwygMode() && cursor < text.length) return tryCursor(cursor + 1);
    return null;
  }

  suppressInlinePickersOnce() {
    this.skipInlinePickersOnce = true;
  }

  editorRelationLink() {
    if (!this.editorRelationLinkController) this.editorRelationLinkController = new EditorRelationLinkController(this);
    return this.editorRelationLinkController;
  }

  semanticRelations() {
    if (!this.editorSemanticRelationsController) this.editorSemanticRelationsController = new EditorSemanticRelationsController(this);
    return this.editorSemanticRelationsController;
  }

  permanentNoteDistillation() {
    if (!this.permanentNoteDistillationController) this.permanentNoteDistillationController = new PermanentNoteDistillationController(this);
    return this.permanentNoteDistillationController;
  }

  permanentNoteWorkspace() {
    if (!this.permanentNoteWorkspaceController) this.permanentNoteWorkspaceController = new PermanentNoteWorkspaceController(this);
    return this.permanentNoteWorkspaceController;
  }

  renderLinkCandidates(query = "", preferredId = "") {
    this.editorRelationLink().renderCandidates(query, preferredId);
  }

  updateLinkPickerConfirmButton() {
    this.editorRelationLink().updateConfirmButton();
  }

  selectedLinkCandidate() {
    return this.editorRelationLink().selectedCandidate();
  }

  currentLinkRelationInput() {
    return this.editorRelationLink().currentRelationInput();
  }

  focusManualLinkReasonInput() {
    this.editorRelationLink().focusReasonInput();
  }

  linkCandidatePreviewText(note) {
    return this.editorRelationLink().candidatePreviewText(note);
  }

  linkCandidateLocationText(note) {
    return `${noteTypeText(this.resolvedNoteType(note) || typeFromFolder(this.state, note?.folderId || ""))} · ${this.folderLabel(note?.folderId || "")}`;
  }

  syncRelationNetworkConnected(...noteIds) {
    const ids = noteIds.map((item) => String(item || "").trim()).filter(Boolean);
    if (!ids.length) return;
    const connectedIds = this.state.graphConnectedNoteIds instanceof Set ? this.state.graphConnectedNoteIds : new Set();
    this.state.graphConnectedNoteIds = connectedIds;
    for (const id of ids) {
      connectedIds.add(id);
      const note = this.state.notes.find((item) => item.id === id);
      if (note) note.relationNetworkStatus = "connected";
    }
  }

  applyRelationNetworkStatus(noteId, nextStatus) {
    const cleanNoteId = String(noteId || "").trim();
    const status = String(nextStatus || "").trim().toLowerCase();
    if (!cleanNoteId || (status !== "connected" && status !== "isolated")) return;
    const connectedIds = this.state.graphConnectedNoteIds instanceof Set ? this.state.graphConnectedNoteIds : new Set();
    this.state.graphConnectedNoteIds = connectedIds;
    if (status === "connected") connectedIds.add(cleanNoteId);
    else connectedIds.delete(cleanNoteId);
    const note = this.state.notes.find((item) => item.id === cleanNoteId);
    if (note) note.relationNetworkStatus = status;
  }

  applyRelationNetworkStatusesFromRelations(noteId, relations = null) {
    const hasVisibleRelation = relationNetworkVisibleRelationCount(relations) > 0;
    this.applyRelationNetworkStatus(noteId, hasVisibleRelation ? "connected" : "isolated");
    if (!hasVisibleRelation) return;
    relationNetworkVisibleRelationNoteIds(relations, noteId).forEach((id) => {
      this.applyRelationNetworkStatus(id, "connected");
    });
  }

  applyRelationNetworkStatusFromLocalSignals(note, signals = null) {
    const noteId = String(note?.id || "").trim();
    if (!noteId) return false;
    const linkedIds = [
      ...(Array.isArray(signals?.forward) ? signals.forward : []),
      ...(Array.isArray(signals?.backward) ? signals.backward : [])
    ]
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);
    if (!linkedIds.length) return false;
    const connectedIds = this.state.graphConnectedNoteIds instanceof Set ? this.state.graphConnectedNoteIds : new Set();
    const beforeChanged = [noteId, ...linkedIds].some((id) => {
      const item = this.state.notes.find((candidate) => candidate.id === id);
      return !connectedIds.has(id) || String(item?.relationNetworkStatus || "").trim().toLowerCase() !== "connected";
    });
    this.syncRelationNetworkConnected(noteId, ...linkedIds);
    return beforeChanged;
  }

  async refreshRelationNetworkStatuses(...noteIds) {
    const ids = [...new Set(noteIds.map((item) => String(item || "").trim()).filter(Boolean))];
    if (!ids.length) return;
    let thinkingStatusChanged = false;
    await Promise.all(
      ids.map(async (noteId) => {
        try {
          const [relations, refreshedNote] = await Promise.all([
            fetchNoteRelations(noteId),
            fetchNote(noteId)
          ]);
          this.applyRelationNetworkStatusesFromRelations(noteId, relations);
          const note = this.state.notes.find((item) => item.id === noteId);
          if (note && refreshedNote && Object.prototype.hasOwnProperty.call(refreshedNote, "thinkingStatus")) {
            const previousStatus = JSON.stringify(note.thinkingStatus || null);
            note.thinkingStatus = refreshedNote.thinkingStatus || null;
            if (JSON.stringify(note.thinkingStatus) !== previousStatus) thinkingStatusChanged = true;
          }
        } catch {}
      })
    );
    if (thinkingStatusChanged) {
      this.renderThinkingStatus();
      this.renderAll?.();
    }
  }

  hideSaveAiSuggestion() {
    if (typeof document === "undefined") return;
    const root = document.getElementById("saveAiSuggestion");
    if (!root) return;
    root.classList.add("hidden");
    root.dataset.action = "";
    root.dataset.noteId = "";
  }

  setLinkInsertSubmitting(nextSubmitting) {
    this.editorRelationLink().setSubmitting(nextSubmitting);
  }

  scrollActiveLinkCandidateIntoView() {
    this.editorRelationLink().scrollActiveCandidateIntoView();
  }

  openLinkPicker(initialQuery = "", options = {}) {
    this.editorRelationLink().open(initialQuery, options);
  }

  resetToolbarTransientButtons() {
    [this.els.insertLink, this.els.insertTag, this.els.insertImage].forEach((button) => {
      if (!button) return;
      button.classList.remove("active");
      button.blur?.();
    });
  }

  closeLinkPicker() {
    this.editorRelationLink().close();
  }

  positionInlineLinkPicker() {
    this.editorRelationLink().positionInline();
  }

  manualLinkInsertOutcome(bodyAlreadyLinked, reusedRelation) {
    return this.editorRelationLink().insertOutcome(bodyAlreadyLinked, reusedRelation);
  }

  manualLinkInsertFeedback(target, outcome) {
    return this.editorRelationLink().insertFeedback(target, outcome);
  }

  async insertSelectedLinkNote(noteId) {
    return this.editorRelationLink().insertSelected(noteId);
  }

  moveLinkCandidate(step) {
    this.editorRelationLink().moveCandidate(step);
  }

  async confirmSelectedLinkCandidate() {
    return this.editorRelationLink().confirmSelectedCandidate();
  }

  activeRootDirectoryId() {
    const note = this.activeNote();
    if (!note) return "";
    return rootBoxIdFromFolder(this.state, note.folderId);
  }

  async fetchTagCandidates(query = "") {
    const result = await listTags({
      rootDirectoryId: this.activeRootDirectoryId(),
      query,
      limit: 24
    });
    return Array.isArray(result.items) ? result.items : [];
  }

  renderTagCandidates(list = [], preferredName = "") {
    const sorted = [...list].sort((a, b) => {
      const query = this.els.tagSearchInput?.value || "";
      const rankDiff = tagCandidateRank(a, query) - tagCandidateRank(b, query);
      if (rankDiff) return rankDiff;
      const countDiff = Number(b?.noteCount || 0) - Number(a?.noteCount || 0);
      if (countDiff) return countDiff;
      return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-CN");
    });
    this.currentTagCandidates = sorted;
    this.currentTagIndex = 0;
    if (preferredName) {
      const idx = sorted.findIndex((item) => String(item?.name || "") === preferredName);
      if (idx >= 0) this.currentTagIndex = idx;
    }
    const query = this.els.tagSearchInput?.value || "";
    this.els.tagSearchList.innerHTML = sorted.length
      ? renderPickerSections(
          sorted.map((item, idx) => ({ item, idx })),
          ({ item }) => tagCandidateGroupLabel(item, query),
          ({ item, idx }) => {
            const badge = tagCandidateBadge(item, query);
            return `<button class="link-picker-item ${idx === this.currentTagIndex ? "active" : ""}" data-tag-name="${escapeHtml(
              item.name
            )}" data-tag-index="${idx}" aria-selected="${idx === this.currentTagIndex ? "true" : "false"}"><span class="picker-headline"><strong>#${highlightMatch(
              item.name,
              query
            )}</strong>${badge ? `<span class="picker-badge">${escapeHtml(badge)}</span>` : ""}</span><span class="picker-meta">${Number(
              item.noteCount || 0
            )} 条笔记</span></button>`;
          }
        )
      : `<div class="picker-empty"><div style="margin-bottom:8px;">无匹配标签。</div><button class="link-picker-item active" type="button" data-insert-current-tag="1">直接插入 #${escapeHtml(query || "新标签")}</button></div>`;
    this.scrollActiveTagCandidateIntoView();
  }

  scrollActiveTagCandidateIntoView() {
    const active = this.els.tagSearchList.querySelector(".link-picker-item.active");
    if (!active) return;
    active.scrollIntoView({ block: "nearest" });
  }

  async openTagPicker(initialQuery = "", options = {}) {
    this.closeLinkPicker();
    const inlineMode = Boolean(options.inlineContext);
    const anchorAtCursor = Boolean(options.anchorAtCursor);
    const focusInput = Boolean(options.focusInput);
    this.els.tagPicker.classList.remove("floating");
    this.els.tagPicker.classList.toggle("inline-picker", inlineMode);
    this.els.tagPicker.style.left = "";
    this.els.tagPicker.style.top = "";
    this.els.tagPicker.style.width = "";
    this.els.tagPicker.style.maxHeight = "";
    this.els.tagPicker.classList.remove("hidden");
    this.els.tagSearchInput.value = initialQuery;
    this.currentTagContext = options.inlineContext || null;
    this.lastInlinePickerAnchor = this.currentTagContext?.end || 0;
    const list = await this.fetchTagCandidates(initialQuery);
    this.renderTagCandidates(list, options.preferredName || "");
    this.els.insertTag?.classList.add("active");
    if (inlineMode) {
      this.positionInlineTagPicker();
      if (focusInput) {
        this.els.tagSearchInput.focus();
        this.els.tagSearchInput.select();
      } else {
        this.focusEditor();
      }
      return;
    }
    if (anchorAtCursor) {
      this.positionFloatingPicker(this.els.tagPicker, Math.min(320, Math.max(260, Math.floor(window.innerWidth * 0.26))));
    }
    this.els.tagSearchInput.focus();
    this.els.tagSearchInput.select();
  }

  closeTagPicker() {
    this.els.tagPicker.classList.add("hidden");
    this.els.tagPicker.classList.remove("floating");
    this.els.tagPicker.classList.remove("inline-picker");
    this.els.tagPicker.style.left = "";
    this.els.tagPicker.style.top = "";
    this.els.tagPicker.style.width = "";
    this.els.tagPicker.style.maxHeight = "";
    this.currentTagContext = null;
    this.resetToolbarTransientButtons();
  }

  positionInlineTagPicker() {
    if (!this.currentTagContext) return;
    this.positionFloatingPicker(this.els.tagPicker, Math.min(320, Math.max(260, Math.floor(window.innerWidth * 0.26))));
  }

  positionFloatingPicker(panel, width, options = {}) {
    if (!panel) return;
    panel.classList.add("floating");
    panel.style.width = `${Math.min(width, Math.max(180, window.innerWidth - 24))}px`;
    panel.style.maxHeight = "";

    const rect = options.anchorRect || options.anchorElement?.getBoundingClientRect?.() || this.currentSelectionRect();
    const viewport = window.visualViewport || null;
    const viewportLeft = Number(viewport?.offsetLeft || 0);
    const viewportTop = Number(viewport?.offsetTop || 0);
    const viewportWidth = Number(viewport?.width || window.innerWidth || 1024);
    const viewportHeight = Number(viewport?.height || window.innerHeight || 768);
    const gutter = 12;
    const gap = 8;
    const resolvedWidth = Math.min(width, Math.max(180, viewportWidth - gutter * 2));
    let left = viewportLeft + 180;
    let top = viewportTop + 90;
    if (rect) {
      const offsetX = Number(options.offsetX || 0);
      left = (options.centerX ? viewportLeft + (viewportWidth - resolvedWidth) / 2 : rect.left) + offsetX;
      const naturalHeight = Math.min(panel.scrollHeight || 360, Math.max(140, viewportHeight - gutter * 2));
      const viewportBottom = viewportTop + viewportHeight - gutter;
      const belowTop = rect.bottom + gap;
      const belowSpace = viewportBottom - belowTop;
      const aboveSpace = rect.top - gap - (viewportTop + gutter);
      const openAbove = belowSpace < Math.min(naturalHeight, 180) && aboveSpace > belowSpace;
      const availableHeight = Math.max(
        120,
        Math.min(naturalHeight, openAbove ? aboveSpace : belowSpace, viewportHeight - gutter * 2)
      );
      top = openAbove ? rect.top - gap - availableHeight : belowTop;
      if (!openAbove && top + availableHeight > viewportBottom) top = viewportBottom - availableHeight;
      panel.style.maxHeight = `${Math.floor(availableHeight)}px`;
    }

    const maxLeft = Math.max(viewportLeft + gutter, viewportLeft + viewportWidth - resolvedWidth - gutter);
    const clampedLeft = Math.max(viewportLeft + gutter, Math.min(left, maxLeft));
    const explicitMaxHeight = Number.parseFloat(panel.style.maxHeight);
    const panelHeight = Math.min(
      panel.scrollHeight || 360,
      Number.isFinite(explicitMaxHeight) ? explicitMaxHeight : viewportHeight - gutter * 2,
      viewportHeight - gutter * 2
    );
    const maxTop = Math.max(viewportTop + gutter, viewportTop + viewportHeight - panelHeight - gutter);
    const clampedTop = Math.max(viewportTop + gutter, Math.min(top, maxTop));
    panel.style.width = `${resolvedWidth}px`;
    panel.style.left = `${Math.round(clampedLeft)}px`;
    panel.style.top = `${Math.round(clampedTop)}px`;
    if (!panel.style.maxHeight) panel.style.maxHeight = `${Math.floor(Math.max(120, viewportTop + viewportHeight - clampedTop - gutter))}px`;
  }

  insertSelectedTag(tagName = "") {
    const normalized = normalizeClickedTag(tagName);
    if (!normalized) return;
    const insertText = `#${normalized}`;
    if (this.currentTagContext) {
      const { start, end } = this.currentTagContext;
      if (this.isWysiwygMode()) {
        this.replaceMarkdownWhileInWysiwyg(start, end, insertText);
      } else {
        this.replaceEditorRange(start, end, insertText);
      }
    } else {
      this.insertAtCursor(insertText);
    }
    this.closeTagPicker();
    this.focusEditor();
    this.onStatus(`已插入标签：#${normalized}`, "ok");
  }

  async moveTagCandidate(step) {
    if (!this.currentTagCandidates.length) return;
    const max = this.currentTagCandidates.length;
    this.currentTagIndex = (this.currentTagIndex + step + max) % max;
    const preferredName = this.currentTagCandidates[this.currentTagIndex]?.name || "";
    const list = await this.fetchTagCandidates(this.els.tagSearchInput.value);
    this.renderTagCandidates(list, preferredName);
    if (this.currentTagContext) this.positionInlineTagPicker();
  }

  relationEndpoint(link, direction) {
    return this.semanticRelations().relationEndpoint(link, direction);
  }

  setRelationFollowupSuggestion(suggestion = null) {
    this.relationFollowupSuggestion = suggestion?.noteId && suggestion?.relationId ? suggestion : null;
  }

  clearRelationFollowupSuggestion() {
    this.relationFollowupSuggestion = null;
  }

  renderRelationFollowupSuggestion(noteId = "") {
    return this.semanticRelations().renderRelationFollowupSuggestion(noteId);
  }

  renderSemanticRelationItem(link, direction) {
    return this.semanticRelations().renderSemanticRelationItem(link, direction);
  }

  renderSemanticRelationsLoadingSection(noteId) {
    return this.semanticRelations().renderSemanticRelationsLoadingSection(noteId);
  }

  renderInlineDraftRelationSection(note, tab) {
    return this.semanticRelations().renderInlineDraftRelationSection(note, tab);
  }

  relationCreateDefaultType(note = this.activeNote()) {
    return this.semanticRelations().relationCreateDefaultType(note);
  }

  sortRelationTargetCandidates(candidates = [], note = this.activeNote()) {
    return this.semanticRelations().sortRelationTargetCandidates(candidates, note);
  }

  renderRelationTargetOptions(candidates = [], selectedId = "") {
    return this.semanticRelations().renderRelationTargetOptions(candidates, selectedId);
  }

  renderRelationTargetChoices(candidates = [], selectedId = "", query = "", activeId = "") {
    return this.semanticRelations().renderRelationTargetChoices(candidates, selectedId, query, activeId);
  }

  renderCreateRelationFormSection(noteId, prefill = {}) {
    return this.semanticRelations().renderCreateRelationFormSection(noteId, prefill);
  }

  renderRelationTypeOptions(selectedType = "") {
    return this.semanticRelations().renderRelationTypeOptions(selectedType);
  }

  renderRelationStatusOptions(selectedStatus = "confirmed") {
    return this.semanticRelations().renderRelationStatusOptions(selectedStatus);
  }

  renderEditRelationFormSection(noteId, link, context = {}) {
    return this.semanticRelations().renderEditRelationFormSection(noteId, link, context);
  }

  renderSemanticRelationsSection(relations, noteId) {
    return this.semanticRelations().renderSemanticRelationsSection(relations, noteId);
  }

  setRelationPanelState(mode = "list", options = {}) {
    this.semanticRelations().setPanelState(mode, options);
  }

  resetRelationPanelState(noteId = "") {
    this.semanticRelations().resetPanelState(noteId);
  }

  currentRelationPanelState(noteId = "") {
    return this.semanticRelations().currentPanelState(noteId);
  }

  permanentRelationWorkspaceAiCandidates(noteId = this.activeNote()?.id || "") {
    const cleanNoteId = String(noteId || "").trim();
    return normalizePermanentRelationAiCandidates(this.noteAiAnalysisByNoteId.get(cleanNoteId) || null, cleanNoteId);
  }

  permanentRelationWorkspaceSourceNote() {
    const stateNoteId = String(this.permanentRelationWorkspaceState?.sourceNoteId || this.permanentRelationWorkspaceState?.noteId || "").trim();
    return (stateNoteId ? this.state.notes.find((item) => item?.id === stateNoteId) : null) || this.activeNote();
  }

  renderPermanentRelationWorkspaceOverlay(note = this.permanentRelationWorkspaceSourceNote()) {
    if (!note?.id) return "";
    const state = normalizePermanentRelationWorkspaceState(this.permanentRelationWorkspaceState, note.id);
    const relations = this.isActiveNoteId(note.id) ? this.currentSemanticRelations : null;
    return renderPermanentRelationComposer({
      note,
      state,
      relations,
      aiCandidates: this.permanentRelationWorkspaceAiCandidates(note.id),
      notes: this.state.notes,
      deps: this.permanentRelationWorkspaceDeps()
    });
  }

  permanentRelationWorkspaceElement() {
    if (typeof document === "undefined") return null;
    return document.querySelector("[data-permanent-relation-workspace]");
  }

  permanentRelationWorkspaceDeps() {
    return {
      folderLabel: (folderId) => this.folderLabel(folderId),
      typeFromFolder: (folderId) => typeFromFolder(this.state, folderId)
    };
  }

  permanentRelationWorkspaceSelectedTargetForPreview() {
    const targetId = String(this.permanentRelationWorkspaceState.selectedTargetNoteId || "").trim();
    if (!targetId) return null;
    const stateNoteId = String(this.permanentRelationWorkspaceState.sourceNoteId || this.permanentRelationWorkspaceState.noteId || "").trim();
    const note = (stateNoteId ? this.state.notes.find((item) => item?.id === stateNoteId) : null) || this.activeNote();
    return this.state.notes.find((item) => item?.id === targetId) ||
      this.permanentRelationWorkspaceState.manualTargets.find((item) => item?.id === targetId) ||
      this.permanentRelationWorkspaceAiCandidates(note?.id || "").find((item) => item?.targetNoteId === targetId) ||
      null;
  }

  syncPermanentRelationManualResults() {
    const results = this.permanentRelationWorkspaceElement()?.querySelector?.("[data-permanent-relation-manual-results]");
    if (!results) return false;
    const html = renderPermanentRelationManualTargets({
      state: this.permanentRelationWorkspaceState,
      deps: this.permanentRelationWorkspaceDeps()
    });
    results.innerHTML = html;
    results.hidden = !html.trim();
    return true;
  }

  bindPermanentRelationWorkspaceOverlayEvents(overlay) {
    if (!overlay) return;
    overlay.onclick = (event) => {
      routeEditorRelationClick(this, event);
    };
    overlay.oninput = (event) => {
      routeEditorRelationInput(this, event);
    };
    overlay.onchange = (event) => {
      routeEditorRelationInput(this, event);
    };
    overlay.onsubmit = (event) => {
      routeEditorRelationSubmit(this, event);
    };
  }

  syncPermanentRelationWorkspaceOverlay() {
    if (typeof document === "undefined") return false;
    const note = this.permanentRelationWorkspaceSourceNote();
    const existing = this.permanentRelationWorkspaceElement();
    const html = note?.id ? this.renderPermanentRelationWorkspaceOverlay(note) : "";
    if (!html) {
      existing?.remove?.();
      return false;
    }
    if (existing) existing.outerHTML = html;
    else document.body?.insertAdjacentHTML?.("beforeend", html);
    this.bindPermanentRelationWorkspaceOverlayEvents(this.permanentRelationWorkspaceElement());
    return true;
  }

  permanentSidebarController() {
    if (!this.permanentNoteSidebarController) {
      this.permanentNoteSidebarController = new PermanentNoteSidebarController(this);
    }
    return this.permanentNoteSidebarController;
  }

  permanentRelationComposer() {
    return this.permanentRelationComposerController;
  }

  openPermanentRelationWorkspace(options = {}) {
    return this.permanentSidebarController().openRelationWorkspace(options);
  }

  closePermanentRelationWorkspace() {
    return this.permanentSidebarController().closeRelationWorkspace();
  }

  patchPermanentRelationWorkspaceState(patch = {}) {
    return this.permanentRelationComposer().patchState(patch);
  }

  choosePermanentRelationManualTarget(targetNoteId = "") {
    return this.permanentRelationComposer().chooseManualTarget(targetNoteId);
  }

  async refreshPermanentRelationManualSearch(query = "") {
    return this.permanentRelationComposer().refreshManualSearch(query);
  }

  queuePermanentRelationManualSearch(input) {
    return this.permanentRelationComposer().queueManualSearch(input);
  }

  updatePermanentRelationWorkspaceField(field = "", value = "") {
    return this.permanentRelationComposer().updateField(field, value);
  }

  async handlePermanentRelationWorkspaceSubmit(form = null) {
    return this.permanentRelationComposer().submit(form);
  }

  continuePermanentRelationWorkspace() {
    return this.permanentSidebarController().continueRelationWorkspace();
  }

  renderSemanticRelationsErrorSection(noteId, error) {
    return this.semanticRelations().renderSemanticRelationsErrorSection(noteId, error);
  }

  renderCurrentRelationSection(noteId, { relations, relationState, error } = {}) {
    return this.semanticRelations().renderCurrentRelationSection(noteId, { relations, relationState, error });
  }

  renderEditorRelatedNotesPanel(note = this.activeNote(), tab = this.activeTab(), options = {}) {
    if (!note?.id || !tab) return "";
    const { forward, backward } = this.buildLocalRelationSignals(note, tab);
    return renderEditorRelatedNotesPanel({
      note,
      noteId: note.id,
      relations: options.relations ?? this.currentSemanticRelations,
      relationState: options.relationState || this.semanticRelationsState,
      forward,
      backward,
      notes: this.state.notes || []
    });
  }

  renderEditorBodyRelationActions(note = this.activeNote(), tab = this.activeTab(), options = {}) {
    if (!note?.id || !tab) return "";
    const { forward, backward } = this.buildLocalRelationSignals(note, tab);
    return renderEditorBodyRelationActions({
      note,
      noteId: note.id,
      relations: options.relations ?? this.currentSemanticRelations,
      relationState: options.relationState || this.semanticRelationsState,
      forward,
      backward,
      notes: this.state.notes || []
    });
  }

  refreshEditorBodyRelationActions(note = this.activeNote(), tab = this.activeTab(), options = {}) {
    const mount = this.els.editorBodyRelationActions;
    if (!mount) return;
    closeEditorRelatedPopovers(document);
    const html = note?.id && tab ? this.renderEditorBodyRelationActions(note, tab, options) : "";
    mount.innerHTML = html;
    mount.hidden = !html.trim();
  }

  refreshEditorRelatedNotesPanel(note = this.activeNote(), tab = this.activeTab(), options = {}) {
    const panel = this.els.result?.querySelector?.("[data-editor-related-notes-panel]");
    if (!panel || !note?.id || !tab || panel.getAttribute("data-note-id") !== note.id) return;
    closeEditorRelatedPopovers(this.els.result || document);
    panel.outerHTML = this.renderEditorRelatedNotesPanel(note, tab, options);
  }

  async refreshSemanticRelations(noteId, requestSerial) {
    try {
      const relations = await fetchNoteRelations(noteId);
      if (requestSerial !== this.relationsRequestSerial || this.activeNote()?.id !== noteId) return;
      this.currentSemanticRelations = relations;
      this.semanticRelationsState = "loaded";
      this.applyRelationNetworkStatusesFromRelations(noteId, relations);
      const note = this.activeNote();
      const tab = this.activeTab();
      if (note?.id === noteId && tab) {
        const { forward, backward, tagRelated } = this.buildLocalRelationSignals(note, tab);
        const localStatusChanged = this.applyRelationNetworkStatusFromLocalSignals(note, { forward, backward, tagRelated });
        const overview = this.buildMainPathOverviewV2({ forward, backward, tagRelated, relations, relationState: "loaded" });
        this.refreshPermanentWorkspaceSnapshot(note, tab, overview);
        this.notifyWorkflowReminder({ kind: "relation-network", note, overview });
        this.refreshInspectorStatusSummary(note, tab);
        this.refreshInspectorLinkSummaryNote();
        this.syncPermanentRelationWorkspaceOverlay();
        if (localStatusChanged) this.renderAll?.();
        this.refreshEditorRelatedNotesPanel(note, tab, {
          relations,
          relationState: "loaded"
        });
        this.refreshEditorBodyRelationActions(note, tab, {
          relations,
          relationState: "loaded"
        });
      }
      this.renderPreview();
      const section = this.els.result?.querySelector?.("[data-note-relations-section]");
      if (section && section.getAttribute("data-note-id") === noteId && !this.shouldPreserveRelationSection(section)) {
        section.outerHTML = this.renderCurrentRelationSection(noteId, {
          relations,
          relationState: "loaded"
        });
      }

      if (this.els.editorRelationsBelow) {
        this.els.editorRelationsBelow.innerHTML = "";
        this.els.editorRelationsBelow.classList.add("hidden");
      }
    } catch (error) {
      if (requestSerial !== this.relationsRequestSerial || this.activeNote()?.id !== noteId) return;
      this.currentSemanticRelations = null;
      this.semanticRelationsState = "error";
      const note = this.activeNote();
      const tab = this.activeTab();
      if (note?.id === noteId && tab) {
        const { forward, backward, tagRelated } = this.buildLocalRelationSignals(note, tab);
        const localStatusChanged = this.applyRelationNetworkStatusFromLocalSignals(note, { forward, backward, tagRelated });
        const overview = this.buildMainPathOverviewV2({ forward, backward, tagRelated, relations: null, relationState: "error" });
        this.refreshPermanentWorkspaceSnapshot(note, tab, overview);
        this.refreshInspectorStatusSummary(note, tab);
        this.refreshInspectorLinkSummaryNote();
        this.syncPermanentRelationWorkspaceOverlay();
        if (localStatusChanged) this.renderAll?.();
        this.refreshEditorRelatedNotesPanel(note, tab, {
          relations: null,
          relationState: "error"
        });
        this.refreshEditorBodyRelationActions(note, tab, {
          relations: null,
          relationState: "error"
        });
      }
      this.renderPreview();
      const section = this.els.result?.querySelector?.("[data-note-relations-section]");
      if (section && section.getAttribute("data-note-id") === noteId && !this.shouldPreserveRelationSection(section)) {
        section.outerHTML = this.renderCurrentRelationSection(noteId, {
          relations: null,
          relationState: "error",
          error
        });
      }

      if (this.els.editorRelationsBelow) {
        this.els.editorRelationsBelow.innerHTML = "";
        this.els.editorRelationsBelow.classList.add("hidden");
      }
    }
  }

  findSemanticRelation(relationId) {
    return this.semanticRelations().findRelation(relationId);
  }

  openCreateRelationForm(options = {}) {
    return this.semanticRelations().openCreateForm(options);
  }

  currentExplicitRelationCount() {
    return this.semanticRelations().currentExplicitRelationCount();
  }

  openEditRelationForm(relationId, options = {}) {
    return this.semanticRelations().openEditForm(relationId, options);
  }

  normalizeTemplateDraftValue(value = "") {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .trim();
  }

  templateDraftHasConflict(currentValue = "", activeDraft = "", nextDraft = "") {
    const cleanCurrent = this.normalizeTemplateDraftValue(currentValue);
    if (!cleanCurrent) return false;
    const cleanActive = this.normalizeTemplateDraftValue(activeDraft);
    const cleanNext = this.normalizeTemplateDraftValue(nextDraft);
    return cleanCurrent !== cleanActive && cleanCurrent !== cleanNext;
  }

  appendTemplateDraft(currentValue = "", nextDraft = "", label = "", title = "备选模板") {
    const base = String(currentValue || "").trimEnd();
    const draft = String(nextDraft || "").trim();
    if (!draft) return base;
    if (!base) return draft;
    if (this.normalizeTemplateDraftValue(base).includes(this.normalizeTemplateDraftValue(draft))) return base;
    const cleanLabel = String(label || "").trim();
    return `${base}\n\n---\n${title}${cleanLabel ? `（${cleanLabel}）` : ""}\n${draft}`;
  }

  toggleTemplateVariantButtons(buttons = [], activeButton = null) {
    buttons.forEach((item) => {
      const active = item === activeButton;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  clearTemplateMergeChoice(choiceBox) {
    if (!choiceBox) return;
    choiceBox.hidden = true;
    choiceBox.innerHTML = "";
    [
      "pendingVariantKey",
      "pendingVariantLabel",
      "pendingRationaleDraft",
      "pendingInsightQuestionDraft",
      "pendingBoundaryDraft"
    ].forEach((key) => {
      delete choiceBox.dataset[key];
    });
  }

  showRelationTemplateMergeChoice(picker, button) {
    const choiceBox = picker?.querySelector?.("[data-relation-template-merge-choice]");
    if (!choiceBox || !button) return;
    const label = String(button.textContent || "").trim();
    choiceBox.dataset.pendingVariantKey = String(button.dataset.relationTemplateVariant || "").trim();
    choiceBox.dataset.pendingVariantLabel = label;
    choiceBox.dataset.pendingRationaleDraft = String(button.dataset.rationaleDraft || "");
    choiceBox.dataset.pendingInsightQuestionDraft = String(button.dataset.insightQuestionDraft || "");
    choiceBox.hidden = false;
    choiceBox.innerHTML = `
      <p>你已经改过当前草稿了。切到“${escapeHtml(label)}”时，要直接替换，还是先追加成备选？</p>
      <div class="semantic-template-merge-actions">
        <button class="mini-btn primary" type="button" data-relation-template-merge-action="replace">替换当前草稿</button>
        <button class="mini-btn" type="button" data-relation-template-merge-action="append">追加为备选</button>
        <button class="mini-btn is-ghost" type="button" data-relation-template-merge-action="cancel">先不切</button>
      </div>
    `;
  }

  commitRelationTemplateVariant(choiceBox, action = "replace") {
    if (!choiceBox) return;
    if (action === "cancel") {
      this.clearTemplateMergeChoice(choiceBox);
      return;
    }
    const picker = choiceBox.closest("[data-relation-template-picker]");
    const form = picker?.closest?.("[data-create-relation-form], [data-edit-relation-form]");
    if (!picker || !form) return;
    const cleanKey = String(choiceBox.dataset.pendingVariantKey || "").trim();
    const label = String(choiceBox.dataset.pendingVariantLabel || "").trim();
    const rationaleDraft = String(choiceBox.dataset.pendingRationaleDraft || "");
    const insightDraft = String(choiceBox.dataset.pendingInsightQuestionDraft || "");
    const targetButton =
      Array.from(picker.querySelectorAll("[data-relation-template-variant]")).find(
        (item) => String(item.dataset.relationTemplateVariant || "").trim() === cleanKey
      ) || picker.querySelector("[data-relation-template-variant]");
    if (!targetButton) {
      this.clearTemplateMergeChoice(choiceBox);
      return;
    }
    const rationale = form.querySelector('textarea[name="rationale"]');
    const insight = form.querySelector('textarea[name="insightQuestion"]');
    if (action === "append") {
      if (rationale) rationale.value = this.appendTemplateDraft(rationale.value, rationaleDraft, label, "备选关系说明");
      if (insight) insight.value = this.appendTemplateDraft(insight.value, insightDraft, label, "备选追问");
    } else {
      if (rationale) rationale.value = rationaleDraft;
      if (insight) insight.value = insightDraft;
    }
    this.toggleTemplateVariantButtons(form.querySelectorAll("[data-relation-template-variant]"), targetButton);
    const noteId = String(form.dataset.noteId || this.activeNote()?.id || "").trim();
    if (noteId && this.relationPanelState.noteId === noteId) {
      this.relationPanelState.selectedTemplateVariant = cleanKey;
      this.relationPanelState.rationaleDraft = rationale?.value || "";
      this.relationPanelState.insightQuestionDraft = insight?.value || "";
    }
    this.writeTemplateVariantPreference("relation", cleanKey);
    this.clearTemplateMergeChoice(choiceBox);
    this.refreshRelationQualityMeter(form);
    rationale?.focus?.();
  }

  applyRelationTemplateVariant(button) {
    const cleanKey = String(button?.dataset?.relationTemplateVariant || "").trim();
    if (!cleanKey) return;
    const form = button.closest("[data-create-relation-form], [data-edit-relation-form]");
    if (!form) return;
    const picker = button.closest("[data-relation-template-picker]");
    const activeButton = form.querySelector("[data-relation-template-variant].is-active");
    if (activeButton === button) {
      this.clearTemplateMergeChoice(picker?.querySelector?.("[data-relation-template-merge-choice]"));
      return;
    }
    const rationale = form.querySelector('textarea[name="rationale"]');
    const insight = form.querySelector('textarea[name="insightQuestion"]');
    const shouldConfirm =
      this.templateDraftHasConflict(rationale?.value || "", activeButton?.dataset?.rationaleDraft || "", button.dataset.rationaleDraft || "") ||
      this.templateDraftHasConflict(insight?.value || "", activeButton?.dataset?.insightQuestionDraft || "", button.dataset.insightQuestionDraft || "");
    if (shouldConfirm) {
      this.showRelationTemplateMergeChoice(picker, button);
      return;
    }
    if (rationale) rationale.value = String(button.dataset.rationaleDraft || "");
    if (insight) insight.value = String(button.dataset.insightQuestionDraft || "");
    this.toggleTemplateVariantButtons(form.querySelectorAll("[data-relation-template-variant]"), button);
    const noteId = String(form.dataset.noteId || this.activeNote()?.id || "").trim();
    if (noteId && this.relationPanelState.noteId === noteId) {
      this.relationPanelState.selectedTemplateVariant = cleanKey;
      this.relationPanelState.rationaleDraft = rationale?.value || "";
      this.relationPanelState.insightQuestionDraft = insight?.value || "";
    }
    this.writeTemplateVariantPreference("relation", cleanKey);
    this.clearTemplateMergeChoice(picker?.querySelector?.("[data-relation-template-merge-choice]"));
    this.refreshRelationQualityMeter(form);
    rationale?.focus?.();
  }

  relationTargetSearchRootId(note = this.activeNote()) {
    return this.semanticRelations().relationTargetSearchRootId(note);
  }

  relatedPermanentNoteIds(note = this.activeNote(), limit = 40) {
    if (!note?.id) return [];
    const rootId = rootBoxIdFromFolder(this.state, note.folderId);
    return this.state.notes
      .filter((item) => {
        if (!item?.id || item.id === note.id) return false;
        const noteType = this.resolvedNoteType(item);
        if (noteType !== "permanent" && noteType !== "original") return false;
        return rootBoxIdFromFolder(this.state, item.folderId) === rootId;
      })
      .slice(0, Math.max(0, Number(limit || 40) || 40))
      .map((item) => item.id);
  }

  isActiveNoteId(noteId = "") {
    const cleanNoteId = String(noteId || "").trim();
    return Boolean(cleanNoteId && this.activeNote()?.id === cleanNoteId);
  }

  async runPermanentNoteAnalysis() {
    const note = this.activeNote();
    const tab = this.activeTab();
    const noteId = String(note?.id || "").trim();
    if (!noteId || !tab) return;
    const noteType = this.resolvedNoteType(note);
    if (noteType !== "permanent" && noteType !== "original") {
      this.onStatus("AI 分析目前只面向永久笔记。", "warn");
      return;
    }
    if (tab.dirty) {
      this.onStatus("正在先同步当前笔记，再运行本地 AI 分析...", "warn");
      const saved = await this.saveActiveNote({ trigger: "ai-analysis" });
      if (saved === false || (saved && typeof saved === "object" && saved.ok === false)) return;
      if (!this.isActiveNoteId(noteId)) return;
    }
    this.setInspectorVisible(true);
    this.activatePermanentWorkspaceTab("viewpoint");
    this.renderRelated();
    this.onStatus("正在让 AI 帮你看这条笔记，结果可能需要等一下。", "warn");
    const ready = await this.onStateChange("ensure-ai-ready-for-feature", {
      feature: "note_analysis",
      noteId,
      returnContext: { view: "note", noteId }
    });
    if (ready?.ready === false) {
      this.rememberPendingContextualAiAction("note_analysis", { noteId });
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        noteId,
        loading: false,
        error: "",
        items: []
      };
      if (
        this.permanentRelationWorkspaceState.open &&
        this.permanentRelationWorkspaceState.noteId === noteId &&
        this.permanentRelationWorkspaceState.mode === "ai"
      ) {
        this.closePermanentRelationWorkspace();
      }
      this.renderEmbeddedAiWorkspaceMount(noteId);
      return;
    }
    this.clearPendingContextualAiAction("note_analysis", noteId);
    const timerHost = this.windowRef || (typeof window !== "undefined" ? window : null);
    const clearAiRecommendationTimer = () => {
      timerHost?.clearTimeout?.(this.permanentRelationAiRecommendationTimer);
      this.permanentRelationAiRecommendationTimer = null;
    };
    clearAiRecommendationTimer();
    let result = null;
    try {
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        noteId,
        loading: true,
        error: "",
        items: []
      };
      this.renderEmbeddedAiWorkspaceMount(noteId);
      if (
        this.permanentRelationWorkspaceState.open &&
        this.permanentRelationWorkspaceState.noteId === noteId &&
        this.permanentRelationWorkspaceState.mode === "ai"
      ) {
        this.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
          ...this.permanentRelationWorkspaceState,
          error: "",
          notice: ""
        }, noteId);
        this.syncPermanentRelationWorkspaceOverlay();
        this.permanentRelationAiRecommendationTimer = timerHost?.setTimeout?.(() => {
          if (
            this.permanentRelationWorkspaceState.open &&
            this.permanentRelationWorkspaceState.noteId === noteId &&
            this.permanentRelationWorkspaceState.mode === "ai" &&
            !this.permanentRelationWorkspaceAiCandidates(noteId).length
          ) {
            this.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
              ...this.permanentRelationWorkspaceState,
              error: "",
              notice: "暂时还没有找到可推荐的关联，可以先改用搜索笔记。"
            }, noteId);
            this.syncPermanentRelationWorkspaceOverlay();
          }
        }, 18000) || null;
      }
      result = await this.onStateChange("run-note-ai-analysis", {
        noteId,
        relatedNoteIds: this.relatedPermanentNoteIds(note),
        persistArtifacts: true,
        openInbox: false
      });
    } catch (error) {
      clearAiRecommendationTimer();
      if (!this.isActiveNoteId(noteId)) return;
      const message = String(error?.message || error || "AI帮看失败");
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        noteId,
        loading: false,
        error: message,
        items: []
      };
      this.renderEmbeddedAiWorkspaceMount(noteId);
      if (
        this.permanentRelationWorkspaceState.open &&
        this.permanentRelationWorkspaceState.noteId === noteId &&
        this.permanentRelationWorkspaceState.mode === "ai"
      ) {
        this.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
          ...this.permanentRelationWorkspaceState,
          saveState: "idle",
          error: "推荐失败，可以改用搜索笔记。"
        }, noteId);
        this.syncPermanentRelationWorkspaceOverlay();
      }
      this.onStatus("AI帮看失败，请稍后重试", "warn");
      return;
    }
    if (!result) {
      clearAiRecommendationTimer();
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        noteId,
        loading: false,
        error: "AI 暂时没有给出建议，请稍后重试。",
        items: []
      };
      this.renderEmbeddedAiWorkspaceMount(noteId);
      if (
        this.permanentRelationWorkspaceState.open &&
        this.permanentRelationWorkspaceState.noteId === noteId &&
        this.permanentRelationWorkspaceState.mode === "ai"
      ) {
        this.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState({
          ...this.permanentRelationWorkspaceState,
          saveState: "idle",
          error: "",
          notice: "暂时没有可推荐的关联，可以改用搜索笔记。"
        }, noteId);
        this.syncPermanentRelationWorkspaceOverlay();
      }
      return;
    }
    this.noteAiAnalysisByNoteId.set(noteId, result);
    clearAiRecommendationTimer();
    if (!this.isActiveNoteId(noteId)) return;
    const { forward, backward, tagRelated } = this.buildLocalRelationSignals(note, tab);
    const overview = this.buildMainPathOverviewV2({
      forward,
      backward,
      tagRelated,
      relations: this.currentSemanticRelations,
      relationState: this.semanticRelationsState
    });
    this.refreshPermanentWorkspaceSnapshot(note, tab, overview);
    await this.refreshNoteAiSuggestions(noteId, { preserveActionFeedback: true });
    if (!this.isActiveNoteId(noteId)) return;
    if (this.permanentRelationWorkspaceState.open && this.permanentRelationWorkspaceState.noteId === noteId) {
      const candidates = this.permanentRelationWorkspaceAiCandidates(noteId);
      const nextWorkspaceState =
        this.permanentRelationWorkspaceState.mode === "ai"
          ? {
              ...this.permanentRelationWorkspaceState,
              mode: "ai",
              saveState: "idle",
              error: "",
              notice: candidates.length ? "" : "这条笔记暂时没有可推荐的关联，可以改用搜索笔记。"
            }
          : {
              ...this.permanentRelationWorkspaceState,
              mode: "manual",
              saveState: "idle",
              error: "",
              notice: ""
            };
      this.permanentRelationWorkspaceState = normalizePermanentRelationWorkspaceState(nextWorkspaceState, noteId);
      this.syncPermanentRelationWorkspaceOverlay();
    }
    this.onStatus("AI帮看已完成", "ok");
  }

  setSourceDistillAiState(nextState = null) {
    this.sourceDistillAiState = nextState;
    if (this.els?.result) this.renderRelated?.();
  }

  rememberPendingContextualAiAction(actionId = "", context = {}) {
    const noteId = String(context.noteId || "").trim();
    const cleanActionId = String(actionId || "").trim();
    if (!cleanActionId || !noteId) return null;
    this.pendingContextualAiAction = {
      actionId: cleanActionId,
      noteId
    };
    return this.pendingContextualAiAction;
  }

  clearPendingContextualAiAction(actionId = "", noteId = "") {
    const pending = this.pendingContextualAiAction;
    if (!pending) return false;
    const cleanActionId = String(actionId || "").trim();
    const cleanNoteId = String(noteId || "").trim();
    if (cleanActionId && pending.actionId !== cleanActionId) return false;
    if (cleanNoteId && pending.noteId !== cleanNoteId) return false;
    this.pendingContextualAiAction = null;
    return true;
  }

  async resumePendingContextualAiAction() {
    const pending = this.pendingContextualAiAction;
    if (!pending?.actionId || !pending?.noteId) return false;
    const note = (this.state.notes || []).find((item) => item.id === pending.noteId);
    if (!note) {
      this.pendingContextualAiAction = null;
      this.onStatus("刚才的笔记已不可用，已取消 AI 操作。", "warn");
      return false;
    }
    if (!this.isActiveNoteId(pending.noteId)) {
      const opened = this.onOpenNote?.(pending.noteId);
      if (opened === false) {
        this.pendingContextualAiAction = null;
        this.onStatus("没有找到刚才的笔记，已取消 AI 操作。", "warn");
        return false;
      }
    }
    if (pending.actionId === "distill_material") {
      this.pendingContextualAiAction = null;
      await this.runSourceDistillAction();
      return true;
    }
    if (pending.actionId === "note_analysis") {
      this.pendingContextualAiAction = null;
      await this.runPermanentNoteAnalysis();
      return true;
    }
    this.pendingContextualAiAction = null;
    return false;
  }

  sourceDistillContext(note, options = {}) {
    return {
      noteId: note?.id || "",
      sourceNoteId: note?.id || "",
      sourceType: this.resolvedNoteType(note),
      sourceTitle: note?.title || "",
      sourceBody: this.getEditorValue(),
      returnContext: { view: "editor", noteId: note?.id || "" },
      remoteConfirmed: options.remoteConfirmed === true
    };
  }

  sourceDistillDraftFromValues(values = []) {
    const draft = this.sourceDistillAiState?.result?.draft || {};
    const keys = ["title", "coreArgument", "content", "questions"].filter((key) => draft[key] !== undefined);
    const nextDraft = { ...draft };
    values.forEach((item) => {
      const key = item.field || keys[item.index];
      if (key) nextDraft[key] = item.value;
    });
    return nextDraft;
  }

  permanentDraftBodyFromSourceDistill(draft = {}) {
    const title = String(draft.title || "").trim() || "未命名永久笔记";
    const coreArgument = String(draft.coreArgument || "").trim();
    const content = String(draft.content || "").trim();
    const questions = String(draft.questions || "").trim();
    return [
      `# ${title}`,
      "",
      "## 核心观点",
      coreArgument,
      "",
      "## 说明",
      content,
      "",
      "## 待确认问题",
      questions
    ].join("\n").trim();
  }

  async createPermanentNoteFromSourceDistill(values = []) {
    const note = this.activeNote();
    if (!note || !this.isOriginalRecordableSource(note)) return false;
    const draft = this.sourceDistillDraftFromValues(values);
    const directoryId = await this.pickPermanentDirectoryForNote(note);
    if (!directoryId) return false;
    const created = await this.onStateChange("record-original-from-note", {
      sourceNoteId: note.id,
      sourceType: this.resolvedNoteType(note),
      sourceTitle: note.title,
      sourceBody: this.getEditorValue(),
      draftTitle: draft.title || note.title,
      draftBody: this.permanentDraftBodyFromSourceDistill(draft),
      directoryId
    });
    if (!created) {
      this.setSourceDistillAiState({
        ...(this.sourceDistillAiState || {}),
        status: CONTEXTUAL_AI_ACTION_STATUS.failed,
        error: "永久笔记创建失败，请重试。"
      });
      return false;
    }
    this.setSourceDistillAiState({
      ...(this.sourceDistillAiState || {}),
      status: CONTEXTUAL_AI_ACTION_STATUS.adopted
    });
    return true;
  }

  async runSourceDistillAction(options = {}) {
    const note = this.activeNote();
    if (!note || !this.isOriginalRecordableSource(note)) {
      this.onStatus("随笔笔记和文献笔记才能提炼", "warn");
      return false;
    }
    const ready = await this.onStateChange("ensure-ai-ready-for-feature", {
      feature: "distill_material",
      returnContext: { view: "editor", noteId: note.id }
    });
    if (ready?.ready === false) {
      this.rememberPendingContextualAiAction("distill_material", { noteId: note.id });
      return false;
    }
    this.clearPendingContextualAiAction("distill_material", note.id);
    if (ready?.mode === "remote" && options.remoteConfirmed !== true) {
      this.setSourceDistillAiState({
        actionId: "distill_material",
        noteId: note.id,
        status: CONTEXTUAL_AI_ACTION_STATUS.needs_remote_confirmation,
        result: null,
        error: "",
        returnContext: { view: "editor", noteId: note.id }
      });
      return false;
    }
    this.setSourceDistillAiState({
      actionId: "distill_material",
      noteId: note.id,
      status: CONTEXTUAL_AI_ACTION_STATUS.running,
      result: null,
      error: "",
      returnContext: { view: "editor", noteId: note.id }
    });
    try {
      const result = await this.onStateChange("run-source-distill-ai", this.sourceDistillContext(note, options));
      if (!result) throw new Error("没有生成可用草稿");
      this.setSourceDistillAiState({
        actionId: "distill_material",
        noteId: note.id,
        status: CONTEXTUAL_AI_ACTION_STATUS.awaiting_confirmation,
        result,
        error: "",
        returnContext: { view: "editor", noteId: note.id }
      });
    } catch (error) {
      this.setSourceDistillAiState({
        actionId: "distill_material",
        noteId: note.id,
        status: CONTEXTUAL_AI_ACTION_STATUS.failed,
        result: null,
        error: String(error?.message || error || "提炼失败"),
        returnContext: { view: "editor", noteId: note.id }
      });
    }
    return true;
  }

  legacyPermanentNoteMainPathSummary(note, overview = {}) {
    const thesis = String(note?.thesis || "").trim();
    const confirmed = String(note?.distillationStatus || "").trim().toLowerCase() === "confirmed";
    const relationState = String(overview.relationState || "loaded").trim();
    const explicitRelationCount = Number(overview.explicitRelationCount || 0);
    const wikilinkCount = Number(overview.wikilinkCount || 0);
    const connectedCount = Math.max(explicitRelationCount, wikilinkCount);

    if (!thesis) {
      return {
        nextStep: "先写一句判断",
        summary: "这条永久笔记还没有稳定的判断句，先把它从材料变成可复用的观点。"
      };
    }
    if (!confirmed) {
      return {
        nextStep: "确认观点",
        summary: "观点已经成形，下一步是明确确认它，避免它一直停在半成品状态。"
      };
    }
    if (relationState === "loading") {
      return {
        nextStep: "等关系加载完成",
        summary: "显示关系还在读取中，先不要把当前计数当成最终结果。"
      };
    }
    if (relationState === "error") {
      return {
        nextStep: "手动补关系或稍后重试",
        summary: "显示关系暂时读取失败，如果你知道这条笔记应该有连接，可以先手动补建或稍后重试。"
      };
    }
    if (connectedCount === 0) {
      return {
        nextStep: "关联笔记，不要让它孤立",
        summary: "这条笔记已经能成立，但还没有真正进入图谱。下一步先关联一条有理由的永久笔记。"
      };
    }
    return {
      nextStep: "进入主题或写作准备",
      summary: "这条笔记已经具备判断和连接，可以继续创建主题索引笔记，或作为相关笔记开始写作。"
    };
  }

  legacyNoteThemeSignalSummary(note, overview = {}) {
    const relationState = String(overview.relationState || "loaded").trim();
    const explicitRelationCount = Number(overview.explicitRelationCount || 0);
    const wikilinkCount = Number(overview.wikilinkCount || 0);
    const tagRelatedCount = Number(overview.tagRelatedCount || 0);
    const themeSignalCount = Number(overview.themeSignalCount || 0);

    if (relationState === "loading") {
      return {
        status: "读取中",
        hint: "显示关系还在读取中，可能相关的内容先不做最终判断。",
        badge: null,
        badgeLabel: "读取中"
      };
    }
    if (relationState === "error") {
      return {
        status: "读取失败",
        hint: "显示关系暂时读取不到，如果本来应该有可能相关的内容，可以先手动补关系或稍后重试。",
        badge: null,
        badgeLabel: "读取失败"
      };
    }

    if (explicitRelationCount > 0) {
      return {
        status: `已连入 ${themeSignalCount || explicitRelationCount}`,
        hint: "已经出现带理由的连接，可以开始判断它在服务哪个主题。",
        badge: themeSignalCount || explicitRelationCount,
        badgeLabel: String(themeSignalCount || explicitRelationCount)
      };
    }
    if (wikilinkCount > 0 && tagRelatedCount === 0) {
      return {
        status: `已连入 ${themeSignalCount || wikilinkCount}`,
        hint: "正文链接已经形成真实连接，可以开始判断它在服务哪个主题。",
        badge: themeSignalCount || wikilinkCount,
        badgeLabel: String(themeSignalCount || wikilinkCount)
      };
    }
    if (tagRelatedCount > 0 && wikilinkCount === 0) {
      return {
        status: `相近笔记 ${themeSignalCount || tagRelatedCount}`,
        hint: "目前只是看起来接近，还需要补一条有理由的关系。",
        badge: themeSignalCount || tagRelatedCount,
        badgeLabel: String(themeSignalCount || tagRelatedCount)
      };
    }
    if (wikilinkCount > 0 || tagRelatedCount > 0) {
      return {
        status: `可能相关 ${themeSignalCount || wikilinkCount + tagRelatedCount}`,
        hint:
          wikilinkCount > 0 && tagRelatedCount > 0
            ? "已经看得到几条可能关系。先挑最关键的一条，把为什么相关写清楚。"
            : "已经有可能相关的内容，但还需要把“为什么相关”说清楚。",
        badge: themeSignalCount || wikilinkCount + tagRelatedCount,
        badgeLabel: String(themeSignalCount || wikilinkCount + tagRelatedCount)
      };
    }
    return {
      status: "待聚合",
      hint: "先让它和其他笔记形成真实连接，再谈主题入口。",
      badge: 0,
      badgeLabel: "0"
    };
  }

  legacyRenderPermanentNoteMainPathSection(note, overview = {}) {
    const noteType = this.resolvedNoteType(note);
    if (!note?.id || (noteType !== "permanent" && noteType !== "original")) return "";
    const thesis = String(note.thesis || "").trim();
    const confirmed = String(note.distillationStatus || "").trim().toLowerCase() === "confirmed";
    const relationState = String(overview.relationState || "loaded").trim();
    const explicitRelationCount = Number(overview.explicitRelationCount || 0);
    const wikilinkCount = Number(overview.wikilinkCount || 0);
    const themeInfo = this.legacyNoteThemeSignalSummary(note, overview);
    const { nextStep, summary: noteSummary } = this.legacyPermanentNoteMainPathSummary(note, overview);
    const relationCountLabel =
      relationState === "loading"
        ? "读取中"
        : relationState === "error"
          ? "读取失败"
           : String(Math.max(explicitRelationCount, wikilinkCount));
    const primaryAction =
      !thesis || !confirmed
        ? "distillation"
        : relationState === "loading" || relationState === "error" || Math.max(explicitRelationCount, wikilinkCount) === 0
          ? "relations"
          : "writing";
    const steps = [
      {
        label: "提炼观点",
        status: !thesis ? "待开始" : confirmed ? "已确认" : "待确认",
        hint: !thesis ? "先写一句判断" : confirmed ? "继续往关系和主题走" : "确认这条观点",
        action: "distillation",
        actionLabel: "继续提纯"
      },
      {
        label: "整理关系",
        status: Math.max(explicitRelationCount, wikilinkCount)
          ? `已建 ${Math.max(explicitRelationCount, wikilinkCount)}`
          : "待建立",
        hint: Math.max(explicitRelationCount, wikilinkCount) ? "已经形成真实关系" : "先连出第一条关系",
        action: "relations",
        actionLabel: "处理关系"
      },
      {
        label: "可写主题",
        status: themeInfo.status,
        hint: themeInfo.hint,
        action: "graph",
        actionLabel: "看图谱"
      },
      {
        label: "进入写作",
        status: confirmed ? "可以进入写作" : "未就绪",
        hint: confirmed ? "可作为相关笔记继续推进" : "先确认观点，再进入写作",
        action: "writing",
        actionLabel: "进入写作"
      }
    ];

    return `
      <section class="inspector-section semantic-relations-section" data-note-main-path-section data-note-id="${escapeHtml(note.id)}">
        <div class="inspector-section-head">
          <div>
            <div class="inspector-section-title">建议下一步</div>
            <div class="inspector-section-note">${escapeHtml(noteSummary)}</div>
          </div>
          <span class="inspector-chip">${escapeHtml(nextStep)}</span>
        </div>
        <div class="semantic-relation-status">
          <span class="inspector-chip">判断 ${escapeHtml(thesis ? "已有" : "缺失")}</span>
          <span class="inspector-chip">关系 ${Math.max(explicitRelationCount, wikilinkCount)}</span>
          <span class="inspector-chip">可能相关 ${themeInfo.badge}</span>
        </div>
        <div class="semantic-relation-groups">
          ${steps
            .map(
              (step) => `
                <div class="semantic-relation-group">
                  <div class="semantic-relation-group-head">
                    <strong>${escapeHtml(step.label)}</strong>
                    <span>${escapeHtml(step.status)}${step.action === primaryAction ? " · 当前重点" : ""}</span>
                  </div>
                  <div class="related-empty">${escapeHtml(step.hint)}</div>
                  <div class="semantic-relation-actions">
                    <button class="mini-btn ${step.action === primaryAction ? "primary" : "is-ghost"}" type="button" data-note-main-route-action="${escapeHtml(step.action)}">${escapeHtml(step.actionLabel)}</button>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  buildLocalRelationSignals(note, tab) {
    if (!note?.id || !tab) return { forward: [], backward: [], tagRelated: [] };
    const links = parseLinks(tab.body || "");
    const tags = parseTags(tab.body || "");
    const rootId = rootBoxIdFromFolder(this.state, note.folderId);
    const scoped = this.state.notes.filter((n) => rootBoxIdFromFolder(this.state, n.folderId) === rootId && n.id !== note.id);
    const linkCandidates = this.linkResolutionCandidates({ excludeNoteId: note.id });
    const backlinkCandidates = this.state.notes;
    const resolvedForwardIds = new Set(
      links
        .map((token) => this.resolveLinkToken(token, linkCandidates))
        .filter((x) => x?.ambiguous !== true && x?.note?.id)
        .map((x) => x.note.id)
    );
    const forward = linkCandidates.filter((n) => resolvedForwardIds.has(n.id));
    const backward = linkCandidates.filter((n) => {
      const refs = parseLinks(n.body || "");
      return refs.some((token) => {
        const resolved = this.resolveLinkToken(token, backlinkCandidates);
        return resolved?.ambiguous !== true && resolved?.note?.id === note.id;
      });
    });
    const tagRelated = tags.length
      ? scoped
          .filter((n) => {
            const noteTags = Array.isArray(n.tags) && n.tags.length ? n.tags : parseTags(String(n.body || ""));
            return noteTags.some((tg) => tags.includes(tg));
          })
          .slice(0, 20)
      : [];
    return { forward, backward, tagRelated };
  }

  buildMainPathOverviewV2({ forward = [], backward = [], tagRelated = [], relations = null, relationState = "loaded" } = {}) {
    return permanentNoteSidebarOverview({
      forward,
      backward,
      tagRelated,
      relations,
      relationState
    });
  }

  permanentNoteMainPathSummaryV2(note, overview = {}) {
    const viewpoint = permanentNoteViewpointState(note);
    const thesis = viewpoint.thesis;
    const confirmed = viewpoint.confirmed;
    const writingInfo = this.noteWritingReadinessV2(note, overview);
    const writingContinuation = this.noteWritingContinuationV2(note, overview);
    const relation = permanentNoteRelationState(overview);
    const relationState = relation.relationState;
    const explicitRelationCount = Number(relation.explicitRelationCount || 0);
    const thinExplicitRelationCount = relation.thinExplicitRelationCount;
    const wikilinkCount = Number(overview.wikilinkCount || 0);
    const connectedCount = explicitRelationCount;

    if (!thesis) {
      return {
        nextStep: "先写一句判断",
        summary: "先把这条笔记写成一句可复用的判断。"
      };
    }
    if (!confirmed) {
      return {
        nextStep: "确认观点",
        summary: "观点已经成形，但还没进入 confirmed。"
      };
    }
    if (relationState === "loading") {
      return {
        nextStep: "等关系加载完成",
        summary: "关系还在读取，等结果稳定后再判断下一步。"
      };
    }
    if (relationState === "error") {
      return {
        nextStep: "手动补关系或稍后重试",
        summary: "关系读取失败，先手动补关系或稍后重试。"
      };
    }
    if (connectedCount > 0 && thinExplicitRelationCount > 0) {
      return {
        nextStep: "补关系说明",
        summary: `已经有 ${explicitRelationCount} 条关系，但其中还有 ${thinExplicitRelationCount} 条理由偏薄。先把“为什么相关”写具体，再继续推进主题或写作。`
      };
    }
    if (connectedCount === 0) {
      if (wikilinkCount > 0 && Number(overview.tagRelatedCount || 0) > 0) {
        return {
          nextStep: "补关系说明",
          summary: "已经看得到几条可能关系。先挑一条最关键的，把“为什么相关”写清楚。"
        };
      }
      if (wikilinkCount > 0) {
        return {
          nextStep: "补关系说明",
          summary: "已经看得到一条可能关系，下一步把“为什么相关”写清楚。"
        };
      }
      if (Number(overview.tagRelatedCount || 0) > 0) {
        return {
          nextStep: "别只停在标签重合",
          summary: "现在还只有标签上的接近，先挑一条最关键的关系写清楚，不要把标签重合直接当成网络连接。"
        };
      }
      return {
        nextStep: "关联笔记，不要让它孤立",
        summary: "这条笔记还没真正进入图谱，先关联一条有理由的永久笔记。"
      };
    }
    if (writingInfo.level === "project_ready") {
      if (writingContinuation?.projectId) {
        return {
          nextStep: writingContinuation.status,
          summary: writingContinuation.hint
        };
      }
      return {
        nextStep: "先确定可写主题",
        summary: "这条笔记已经适合进入写作；先确定题目和读者，再继续生成文章提纲。"
      };
    }
    if (writingInfo.level === "strong_model_ready") {
      if (writingContinuation?.projectId) {
        return {
          nextStep: writingContinuation.status,
          summary: writingContinuation.hint
        };
      }
      return {
        nextStep: "先确定可写主题",
        summary: "这条笔记已经具备 AI 写作检查前的材料质量；先确定题目和读者，再做写作检查。"
      };
    }
    if (writingInfo.level === "basket_ready") {
      return {
        nextStep: "补边界/反例",
        summary: "关系已经接上，但还缺适用边界或反例；先补这一格，再决定是否进入写作中心。"
      };
    }
    return {
      nextStep: writingInfo.status,
      summary: writingInfo.hint
    };
  }

  permanentNoteDistillationStepV2(note, overview = {}, writingInfo = null) {
    const viewpoint = permanentNoteViewpointState(note);
    const thesis = viewpoint.thesis;
    const confirmed = viewpoint.confirmed;
    const relation = permanentNoteRelationState(overview);
    const relationState = relation.relationState;
    const explicitRelationCount = Number(relation.explicitRelationCount || 0);
    const readiness = writingInfo || this.noteWritingReadinessV2(note, overview);

    if (!thesis) {
      return {
        status: "待开始",
        hint: "先写一句判断。",
        actionLabel: "继续提纯",
        focusTarget: "thesis"
      };
    }
    if (!confirmed) {
      return {
        status: "待确认",
        hint: "把这条观点确认下来。",
        actionLabel: "继续提纯",
        focusTarget: "thesis"
      };
    }
    if (relationState === "loaded" && explicitRelationCount > 0 && readiness.level === "basket_ready") {
      return {
        status: "待补边界",
        hint: "关系已经接上，但还缺适用边界或反例。",
        actionLabel: "补边界/反例",
        focusTarget: "boundary"
      };
    }
    return {
      status: "已确认",
      hint: "可以往关系和主题推进。",
      actionLabel: "继续提纯",
      focusTarget: "thesis"
    };
  }

  permanentNoteWritingStepV2(note, overview = {}, writingInfo = null) {
    const readiness = writingInfo || this.noteWritingReadinessV2(note, overview);
    const writingContinuation = this.noteWritingContinuationV2(note, overview);
    const routeMode =
      readiness.level === "project_ready" || readiness.level === "strong_model_ready"
        ? "project"
        : readiness.level === "needs_distillation"
          ? "distillation"
          : readiness.level === "blocked_authorship" || readiness.level === "blocked_draft"
            ? "requirements"
            : "basket";

    if (routeMode === "project") {
      if (writingContinuation?.projectId) {
        return {
          status: writingContinuation.status,
          hint: writingContinuation.hint,
          actionLabel: writingContinuation.actionLabel,
          routeMode
        };
      }
      return {
        status: "先确定可写主题",
        hint:
          readiness.level === "strong_model_ready"
            ? "这条笔记已经具备 AI 写作检查前的材料质量；先确定题目和读者，再做写作检查。"
            : "这条笔记已经适合进入写作；先确定题目和读者，再继续生成文章提纲。",
        actionLabel: "确定可写主题",
        routeMode
      };
    }

    if (routeMode === "distillation") {
      return {
        status: readiness.status,
        hint: readiness.hint,
        actionLabel: readiness.actionLabel || "先确认观点/三句话",
        routeMode
      };
    }

    if (routeMode === "requirements") {
      return {
        status: readiness.status,
        hint: readiness.hint,
        actionLabel: readiness.actionLabel || readiness.status || "先完成写作要求",
        routeMode
      };
    }

    if (routeMode === "basket" && writingContinuation?.projectId) {
      return {
        status: writingContinuation.status,
        hint: writingContinuation.hint,
        actionLabel: writingContinuation.actionLabel,
        routeMode
      };
    }

    return {
      status: readiness.status,
      hint: readiness.hint,
      actionLabel: readiness.actionLabel,
      routeMode
    };
  }

  noteThemeSignalSummaryV2(note, overview = {}) {
    const relationState = String(overview.relationState || "loaded").trim();
    const explicitRelationCount = Number(overview.explicitRelationCount || 0);
    const wikilinkCount = Number(overview.wikilinkCount || 0);
    const tagRelatedCount = Number(overview.tagRelatedCount || 0);
    const themeSignalCount = Number(overview.themeSignalCount || 0);

    if (relationState === "loading") {
      return {
        status: "读取中",
        hint: "关系仍在读取中，可能相关的内容先不做最终判断。",
        badge: null,
        badgeLabel: "读取中"
      };
    }
    if (relationState === "error") {
      return {
        status: "读取失败",
        hint: "关系暂时读不到；如果本来应该有相关内容，可以先手动补关系或稍后重试。",
        badge: null,
        badgeLabel: "读取失败"
      };
    }
    if (explicitRelationCount > 0) {
      return {
        status: `已连入 ${themeSignalCount || explicitRelationCount}`,
        hint: "已经出现带理由的连接，可以开始判断它在服务哪个主题。",
        badge: themeSignalCount || explicitRelationCount,
        badgeLabel: String(themeSignalCount || explicitRelationCount)
      };
    }
    if (wikilinkCount > 0 && tagRelatedCount === 0) {
      return {
        status: `已有线索 ${themeSignalCount || wikilinkCount}`,
        hint: "已经看得到一条可能关系，下一步是把为什么相关写清楚。",
        badge: themeSignalCount || wikilinkCount,
        badgeLabel: String(themeSignalCount || wikilinkCount)
      };
    }
    if (tagRelatedCount > 0 && wikilinkCount === 0) {
      return {
        status: `相近笔记 ${themeSignalCount || tagRelatedCount}`,
        hint: "目前只是看起来接近，还需要补一条有理由的关系。",
        badge: themeSignalCount || tagRelatedCount,
        badgeLabel: String(themeSignalCount || tagRelatedCount)
      };
    }
      if (wikilinkCount > 0 || tagRelatedCount > 0) {
        return {
          status: `可能关系 ${themeSignalCount || wikilinkCount + tagRelatedCount}`,
          hint: "已经看得到几条可能关系。先挑最关键的一条，把为什么相关写清楚。",
          badge: themeSignalCount || wikilinkCount + tagRelatedCount,
          badgeLabel: String(themeSignalCount || wikilinkCount + tagRelatedCount)
        };
      }
    return {
      status: "待聚合",
      hint: "先让它和其他笔记形成真实连接，再谈主题入口。",
      badge: 0,
      badgeLabel: "0"
    };
  }

  noteWritingReadinessV2(note, overview = {}) {
    return deriveNoteWritingReadiness(note, overview);
  }

  noteWritingContinuationV2(note, overview = {}) {
    if (overview?.writingContinuation?.projectId) return overview.writingContinuation;
    return this.resolveNoteWritingContinuation?.(note, overview) || null;
  }

  renderPermanentNoteMainPathSectionV2(note, overview = {}) {
    const noteType = this.resolvedNoteType(note);
    if (!note?.id || (noteType !== "permanent" && noteType !== "original")) return "";
    const architecture = permanentNoteWorkspaceArchitecture({
      note,
      relationState: overview.relationState,
      explicitRelationCount: overview.explicitRelationCount,
      thinExplicitRelationCount: overview.thinExplicitRelationCount,
      wikilinkCount: overview.wikilinkCount,
      tagRelatedCount: overview.tagRelatedCount
    });
    const themeInfo = this.noteThemeSignalSummaryV2(note, overview);
    const writingInfo = this.noteWritingReadinessV2(note, overview);
    const distillationInfo = this.permanentNoteDistillationStepV2(note, overview, writingInfo);
    const writingStep = this.permanentNoteWritingStepV2(note, overview, writingInfo);
    const mainPathSummary = this.permanentNoteMainPathSummaryV2(note, overview);
    const model = buildPermanentNoteMainPathActionModel({
      note,
      overview,
      architecture,
      themeInfo,
      distillationInfo,
      writingStep,
      mainPathSummary
    });
    return renderPermanentNoteActionPanel(model);
  }

  legacyBuildMainPathOverview({ forward = [], backward = [], tagRelated = [], relations = null } = {}) {
    const outgoing = Array.isArray(relations?.outgoingLinks)
      ? relations.outgoingLinks.filter((link) => !isHiddenRelation(link) && !isMarkdownWikilinkRelation(link))
      : [];
    const backlinks = Array.isArray(relations?.backlinks)
      ? relations.backlinks.filter((link) => !isHiddenRelation(link) && !isMarkdownWikilinkRelation(link))
      : [];
    return {
      explicitRelationCount: outgoing.length + backlinks.length,
      wikilinkCount: forward.length + backward.length,
      tagRelatedCount: tagRelated.length,
      themeSignalCount: new Set([
        ...forward.map((item) => item.id),
        ...backward.map((item) => item.id),
        ...tagRelated.map((item) => item.id)
      ]).size
    };
  }

  refreshMainPathSection(note, overview = {}) {
    if (!note?.id) return;
    const section = this.els.result?.querySelector?.("[data-note-main-path-section]");
    if (!section || section.getAttribute("data-note-id") !== note.id) return;
    section.outerHTML = this.renderPermanentNoteMainPathSectionV2(note, overview);
  }

  renderInspectorLinkSummaryNote() {
    return `
      <div class="inspector-section-note" data-inspector-link-summary-note>
        ${
          this.semanticRelationsState === "error"
            ? "关系读取失败了；这些可能关系先只作参考，稍后重试后再确认。"
            : this.semanticRelationsState === "loading"
              ? "正在读取关系；先不要把可能关系当成已经确认。"
              : "这里按顺序处理：先看建议下一步，再补清楚关系理由。"
        }
      </div>
    `;
  }

  renderInspectorStatusSummary(note, { forward = [], backward = [], tagRelated = [] } = {}) {
    const relationCount = Number(this.currentExplicitRelationCount() || 0);
    return renderPermanentNoteStatusSummary({
      note,
      relationState: this.semanticRelationsState,
      relationCount
    });
  }

  refreshInspectorStatusSummary(note, tab = this.activeTab()) {
    if (!note?.id || !tab) return;
    const mount = this.els.result?.querySelector?.("[data-inspector-status-summary]");
    if (!mount) return;
    const { forward, backward, tagRelated } = this.buildLocalRelationSignals(note, tab);
    mount.outerHTML = this.renderInspectorStatusSummary(note, { forward, backward, tagRelated });
  }

  refreshInspectorLinkSummaryNote() {
    const mount = this.els.result?.querySelector?.("[data-inspector-link-summary-note]");
    if (!mount) return;
    mount.outerHTML = this.renderInspectorLinkSummaryNote();
  }

  shouldPreserveRelationSection(section) {
    if (!section) return false;
    if (section.querySelector?.("[data-create-relation-form], [data-edit-relation-form]")) return true;
    const active = section.ownerDocument?.activeElement;
    if (!active || !section.contains(active)) return false;
    return Boolean(active.closest?.("input, textarea, select, [contenteditable='true']"));
  }

  refreshPermanentWorkspaceSnapshot(note, tab = this.activeTab(), overview = null) {
    return this.permanentNoteWorkspace().refreshSnapshot(note, tab, overview);
  }

  renderDeferredNoteWorkspace(note, tab) {
    return this.permanentNoteWorkspace().renderDeferredWorkspace(note, tab);
  }

  renderPermanentNoteRelationAssistSection(note, overview = {}) {
    if (!note?.id) return "";
    return renderPermanentNoteRelationAssistSectionView({
      note,
      explicitRelationCount: this.currentExplicitRelationCount(),
      wikilinkCount: Number(overview.wikilinkCount || 0),
      tagRelatedCount: Number(overview.tagRelatedCount || 0),
      analysis: this.noteAiAnalysisByNoteId.get(note.id) || null
    });
  }

  renderPermanentNoteWritingPrepSection(note) {
    if (!note?.id) return "";
    const thesis = String(note.thesis || "").trim();
    const boundary = String(note.boundaryOrCounterpoint || note.boundary_or_counterpoint || "").trim();
    const confirmed = String(note.distillationStatus || "").trim() === "confirmed";
    const explicitRelationCount = this.currentExplicitRelationCount();
    const hasRelation = Number(explicitRelationCount || 0) > 0;
    const checks = [
      ["一句话判断", Boolean(thesis), "补判断"],
      ["至少一条关系", hasRelation, "去关联"],
      ["边界或反方", Boolean(boundary), "补边界"]
    ];
    const ready = confirmed && hasRelation && Boolean(boundary);
    const primaryAction = !confirmed ? "distillation" : !hasRelation ? "relations" : "writing";
    const primaryLabel = !confirmed ? "先确认观点" : !hasRelation ? "先补一条关系" : "进入写作";
    const focusTarget = !confirmed && thesis ? "confirm" : !boundary && confirmed ? "boundary" : "";
    return `
      <section class="permanent-workspace-card writing-prep-panel">
        <div class="semantic-relation-group-head">
          <strong>写作前检查</strong>
          <span>${escapeHtml(ready ? "已准备好" : "还差一步")}</span>
        </div>
        <p class="related-empty">${escapeHtml(
          ready
            ? "这条笔记已经有观点、关系和边界，可以作为相关笔记继续组织文章。"
            : "先把观点和关系补稳，再进入写作；这样写作时不会只拿到一条孤立材料。"
        )}</p>
        <div class="permanent-workspace-checks">
          ${checks
            .map(
              ([label, ok, actionLabel]) => `
                <div class="permanent-workspace-check ${ok ? "is-done" : ""}">
                  <span>${escapeHtml(ok ? "完成" : "待补")}</span>
                  <strong>${escapeHtml(label)}</strong>
                  ${ok ? "" : `<small>${escapeHtml(actionLabel)}</small>`}
                </div>
              `
            )
            .join("")}
        </div>
        <div class="semantic-relation-actions">
          <button class="mini-btn primary" type="button" data-note-main-route-action="${escapeHtml(primaryAction)}"${focusTarget ? ` data-note-main-route-focus="${escapeHtml(focusTarget)}"` : ""}>${escapeHtml(primaryLabel)}</button>
        </div>
      </section>
    `;
  }

  setDistillationPrefill(noteId = "", options = {}) {
    return this.permanentNoteDistillation().setPrefill(noteId, options);
  }

  currentDistillationPrefill(noteId = "") {
    return this.permanentNoteDistillation().currentPrefill(noteId);
  }

  activatePermanentWorkspaceTab(tab = "viewpoint") {
    return this.permanentNoteWorkspace().activateTab(tab);
  }

  showDistillationTemplateMergeChoice(picker, button) {
    return this.permanentNoteDistillation().showTemplateMergeChoice(picker, button);
  }

  commitDistillationTemplateVariant(choiceBox, action = "replace") {
    return this.permanentNoteDistillation().commitTemplateVariant(choiceBox, action);
  }

  applyDistillationTemplateVariant(button) {
    return this.permanentNoteDistillation().applyTemplateVariant(button);
  }

  noteNeedsRelationNetworkPrompt(note) {
    const explicitStatus = String(note?.relationNetworkStatus || note?.relation_network_status || "").trim().toLowerCase();
    if (explicitStatus === "isolated") return true;
    if (explicitStatus === "connected") return false;
    return this.currentExplicitRelationCount() === 0;
  }

  renderRelationNetworkPrompt(note) {
    if (!this.noteNeedsRelationNetworkPrompt(note)) return "";
    const title = String(note?.title || "这条永久笔记").trim() || "这条永久笔记";
    return `
      <div class="semantic-relation-group note-network-alert" data-note-network-alert="isolated">
        <div class="semantic-relation-group-head">
          <strong>待关联笔记</strong>
          <span>${escapeHtml(title)}</span>
        </div>
        <p class="related-empty">还没有和其他永久笔记建立关联。先找一条最相关的笔记，说明它们是支持、反驳、限定还是桥接；如果暂时独立，就把理由写在边界里。</p>
        <div class="semantic-relation-actions">
          <button class="mini-btn primary" type="button" data-note-main-route-action="relations">关联一条笔记</button>
          <button class="mini-btn" type="button" data-note-isolated-hold>记录暂时独立</button>
        </div>
      </div>
    `;
  }

  focusTemporaryIsolatedBoundary() {
    return this.permanentNoteDistillation().focusTemporaryIsolatedBoundary();
  }

  renderPermanentNoteDistillationSection(note) {
    return this.permanentNoteDistillation().renderSection(note);
  }

  renderNoteEmbeddedAiWorkspaceForNote(noteId = "") {
    return renderNoteEmbeddedAiWorkspace(this.noteAiSuggestionsStateForNote(noteId));
  }

  noteAiSuggestionsStateForNote(noteId = "") {
    const cleanNoteId = String(noteId || "").trim();
    if (cleanNoteId && this.noteAiSuggestionsState.noteId === cleanNoteId) return this.noteAiSuggestionsState;
    return {
      noteId: cleanNoteId,
      loading: false,
      error: "",
      items: [],
      actionLoading: false,
      actionSuggestionId: "",
      actionError: "",
      actionNotice: "",
      actionNoticeTone: "muted"
    };
  }

  noteAiSuggestionsSummaryLabel(noteId = "") {
    const state = this.noteAiSuggestionsStateForNote(noteId);
    if (state.loading) return "读取中";
    if (state.error) return "加载失败";
    if (!state.items.length) return "0 条";
    const pendingCount = state.items.filter((item) => String(item?.status || "").trim() === "suggested").length;
    return pendingCount ? `${pendingCount} 条待确认` : `${state.items.length} 条`;
  }

  currentNoteSuggestionReviewContent(note = this.activeNote(), suggestion = {}) {
    const form = this.els.result?.querySelector?.("[data-note-distillation-form]");
    if (form && note?.id) {
      const draft = distillationDraftFromForm(form, note);
      return noteSuggestionReviewContent(
        {
          ...note,
          thesis: draft.thesis,
          threeLineSummary: draft.threeLineSummary,
          boundaryOrCounterpoint: draft.boundaryOrCounterpoint
        },
        suggestion
      );
    }
    return noteSuggestionReviewContent(note, suggestion);
  }

  renderEmbeddedAiWorkspaceMount(noteId = "") {
    const cleanNoteId = String(noteId || "").trim();
    const mount = this.els.result?.querySelector?.("[data-note-embedded-ai-workspace]");
    if (!mount) return;
    if (String(mount.getAttribute("data-note-id") || "").trim() !== cleanNoteId) return;
    mount.innerHTML = renderNoteEmbeddedAiWorkspace(this.noteAiSuggestionsStateForNote(cleanNoteId));
    const count = Array.from(mount.closest?.("[data-note-distillation-section]")?.querySelectorAll?.("[data-note-ai-suggestions-count]") || []).find((item) => {
      const itemNoteId = String(item.getAttribute("data-note-id") || "").trim();
      return !itemNoteId || itemNoteId === cleanNoteId;
    });
    if (count) count.textContent = this.noteAiSuggestionsSummaryLabel(cleanNoteId);
  }

  async refreshNoteAiSuggestions(noteId = "", options = {}) {
    const cleanNoteId = String(noteId || "").trim();
    if (!cleanNoteId) return;
    const requestSerial = ++this.noteAiSuggestionsRequestSerial;
    const preserveActionFeedback = options?.preserveActionFeedback === true && this.noteAiSuggestionsState.noteId === cleanNoteId;
    const actionFeedback = preserveActionFeedback
      ? {
          actionLoading: false,
          actionSuggestionId: this.noteAiSuggestionsState.actionSuggestionId || "",
          actionError: this.noteAiSuggestionsState.actionError || "",
          actionNotice: this.noteAiSuggestionsState.actionNotice || "",
          actionNoticeTone: this.noteAiSuggestionsState.actionNoticeTone || "muted"
        }
      : {
          actionLoading: false,
          actionSuggestionId: "",
          actionError: "",
          actionNotice: "",
          actionNoticeTone: "muted"
        };
    this.noteAiSuggestionsState = {
      noteId: cleanNoteId,
      loading: true,
      error: "",
      items: [],
      ...actionFeedback
    };
    this.renderEmbeddedAiWorkspaceMount(cleanNoteId);
    try {
      const result = await fetchAiSuggestions({
        canonical: true,
        targetType: "permanent_note",
        targetId: cleanNoteId,
        limit: 20
      });
      if (requestSerial !== this.noteAiSuggestionsRequestSerial) return;
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsState,
        loading: false,
        items: Array.isArray(result?.items) ? result.items : [],
        ...actionFeedback
      };
    } catch (error) {
      if (requestSerial !== this.noteAiSuggestionsRequestSerial) return;
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsState,
        loading: false,
        error: String(error?.message || error),
        ...actionFeedback
      };
    }
    this.renderEmbeddedAiWorkspaceMount(cleanNoteId);
  }

  async applyNoteAiSuggestionAction(action = "", suggestionId = "", artifactId = "") {
    const note = this.activeNote();
    const noteId = String(note?.id || "").trim();
    const cleanAction = String(action || "").trim();
    const cleanSuggestionId = String(suggestionId || "").trim();
    let cleanArtifactId = String(artifactId || "").trim();
    if (!noteId || !cleanAction || !cleanSuggestionId) return;
    const currentState = this.noteAiSuggestionsStateForNote(noteId);
    const currentSuggestion = currentState.items.find((item) => String(item?.id || "").trim() === cleanSuggestionId);
    if (!currentSuggestion) {
      this.onStatus("没有找到这条 AI 建议，请先刷新。", "warn");
      return;
    }
    this.noteAiSuggestionsState = {
      ...currentState,
      actionLoading: true,
      actionSuggestionId: cleanSuggestionId,
      actionError: "",
      actionNotice: "",
      actionNoticeTone: "muted"
    };
    this.renderEmbeddedAiWorkspaceMount(noteId);
    try {
      let latest = null;
      if (!cleanArtifactId || cleanAction === "edited" || cleanAction === "confirmed") {
        latest = await fetchAiSuggestion(cleanSuggestionId, { canonical: true });
      }
      if (!cleanArtifactId) cleanArtifactId = String(latest?.sourceArtifactId || currentSuggestion?.sourceArtifactId || "").trim();
      if (cleanAction === "adopted_as_draft") {
        if (!cleanArtifactId) throw new Error("这条建议缺少来源内容，暂时不能采纳为草稿。");
        await adoptAiInboxFieldSuggestion(cleanArtifactId, { confirm: true, canonical: true });
        const refreshed = await fetchNote(noteId);
        if (refreshed) Object.assign(note, refreshed);
      } else {
        const payload = {
          canonical: true,
          status: cleanAction,
          actor: "user",
          userId: "local_user",
          action: cleanAction === "edited" ? "edit" : cleanAction === "confirmed" ? "confirm" : cleanAction === "rejected" ? "reject" : cleanAction
        };
        if (cleanAction === "edited" || cleanAction === "confirmed") {
          payload.content = this.currentNoteSuggestionReviewContent(note, latest || currentSuggestion);
        }
        if (cleanAction === "confirmed") payload.userConfirmed = true;
        await updateAiSuggestion(cleanSuggestionId, payload);
      }
      if (!this.isActiveNoteId(noteId)) return;
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        actionLoading: false,
        actionSuggestionId: cleanSuggestionId,
        actionError: "",
        actionNotice: cleanAction === "rejected" ? "这条建议已忽略。" : `这条建议已${cleanAction === "adopted_as_draft" ? "采纳为草稿" : aiSuggestionStatusLabel(cleanAction)}。`,
        actionNoticeTone: "ok"
      };
      await this.refreshNoteAiSuggestions(noteId, { preserveActionFeedback: true });
      if (!this.isActiveNoteId(noteId)) return;
      this.renderEmbeddedAiWorkspaceMount(noteId);
      this.onStatus(
        cleanAction === "confirmed"
          ? "AI 建议已完成人工确认"
          : cleanAction === "edited"
            ? "AI 建议已标记为人工编辑"
            : cleanAction === "rejected"
              ? "AI 建议已忽略"
              : "AI 建议已采纳为草稿",
        "ok"
      );
    } catch (error) {
      if (!this.isActiveNoteId(noteId)) return;
      this.noteAiSuggestionsState = {
        ...this.noteAiSuggestionsStateForNote(noteId),
        actionLoading: false,
        actionSuggestionId: cleanSuggestionId,
        actionError: String(error?.message || error)
      };
      this.renderEmbeddedAiWorkspaceMount(noteId);
      this.onStatus(`处理 AI 建议失败：${String(error?.message || error)}`, "warn");
    }
  }

  jumpToInspectorSection(sectionSelector, { focusSelector = "", focus = false } = {}) {
    const matched = document.querySelector(sectionSelector);
    const section = matched?.matches?.(".inspector-section") ? matched : matched?.closest?.(".inspector-section") || matched;
    if (!section) return;
    const foldedParent = section.closest?.("details");
    if (foldedParent && !foldedParent.open) foldedParent.open = true;
    section.scrollIntoView({ block: "start", behavior: "smooth" });
    section.classList.remove("is-jump-target");
    // Restart the highlight animation on repeated clicks.
    void section.offsetWidth;
    section.classList.add("is-jump-target");
    window.setTimeout(() => section.classList.remove("is-jump-target"), 1800);
    if (focus && focusSelector) {
      window.setTimeout(() => {
        const focusTarget = section.querySelector?.(focusSelector) || document.querySelector(focusSelector);
        focusTarget?.focus?.();
      }, 220);
    }
  }

  applySelectionDistillationDraft() {
    const note = this.activeNote();
    const noteType = this.resolvedNoteType(note);
    if (!note?.id || (noteType !== "permanent" && noteType !== "original")) {
      this.onStatus("提炼这段只支持永久笔记", "warn");
      this.hideSelectionAiAction();
      return false;
    }
    const selectedText = String(this.selectionAiActionState.selectedText || this.currentSelectedEditorText()).trim();
    const draft = selectionDistillationDraft(selectedText);
    if (!draft) {
      this.onStatus("先选中一段可提炼的正文", "warn");
      this.hideSelectionAiAction();
      return false;
    }

    this.hideSelectionAiAction();
    this.setInspectorVisible(true);
    this.renderRelated("提炼这段文字");

    window.setTimeout(() => {
      const form = this.els.result?.querySelector?.("[data-note-distillation-form]");
      if (!form) {
        this.onStatus("当前笔记还没有观点提纯区域", "warn");
        return;
      }
      const thesis = form.querySelector('textarea[name="thesis"]');
      const summaryTargets = [1, 2, 3]
        .map((idx) => form.querySelector(`textarea[name="summary${idx}"]`))
        .filter(Boolean);
      const target =
        thesis && !String(thesis.value || "").trim()
          ? thesis
          : summaryTargets.find((item) => !String(item.value || "").trim()) || summaryTargets[0] || thesis;
      if (!target) return;
      const targetName = String(target.getAttribute("name") || "thesis");
      target.value = draft;
      const optionalDetails = target.closest("details.viewpoint-optional-details");
      if (optionalDetails) optionalDetails.open = true;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      this.jumpToInspectorSection("[data-note-distillation-section]", {
        focus: true,
        focusSelector: `[data-note-distillation-form] textarea[name="${targetName}"]`
      });
      this.onStatus("已把选中文本带入当前观点补充区", "ok");
    }, 40);
    return true;
  }

  refreshDistillationQuality(form) {
    return this.permanentNoteDistillation().refreshQuality(form);
  }

  async handleDistillationForm(form) {
    return this.permanentNoteDistillation().handleForm(form);
  }

  async confirmDistillation() {
    return this.permanentNoteDistillation().confirm();
  }

  async refreshRelationTargetSearch(query = "") {
    return this.semanticRelations().refreshTargetSearch(query);
  }

  queueRelationTargetSearch(input) {
    this.semanticRelations().queueTargetSearch(input);
  }

  openRelationTargetList(form) {
    this.semanticRelations().openTargetList(form);
  }

  closeRelationTargetList(form) {
    this.semanticRelations().closeTargetList(form);
  }

  visibleRelationTargetChoices(form) {
    return this.semanticRelations().visibleTargetChoices(form);
  }

  moveRelationTargetChoice(form, step = 1) {
    this.semanticRelations().moveTargetChoice(form, step);
  }

  applyRelationTargetChoice(form, noteId = "", noteTitle = "", options = {}) {
    this.semanticRelations().applyTargetChoice(form, noteId, noteTitle, options);
  }

  refreshRelationQualityMeter(form) {
    this.semanticRelations().refreshQualityMeter(form);
  }

  async handleCreateRelationForm(form) {
    return this.semanticRelations().handleCreateForm(form);
  }

  async promoteInlineDraftRelation(indexValue = "") {
    return this.semanticRelations().promoteInlineDraft(indexValue);
  }

  async handleEditRelationForm(form) {
    return this.semanticRelations().handleEditForm(form);
  }

  async deleteSemanticRelation(relationId) {
    return this.semanticRelations().deleteRelation(relationId);
  }

  renderRelated(extraTitle = "") {
    const note = this.activeNote();
    const tab = this.activeTab();
    if (this.els.editorRelationsBelow) {
      this.els.editorRelationsBelow.innerHTML = "";
      this.els.editorRelationsBelow.classList.add("hidden");
    }
    if (!note || !tab) {
      this.relationsRequestSerial += 1;
      this.currentSemanticRelations = null;
      this.semanticRelationsState = "idle";
      this.resetRelationPanelState("");
      this.permanentRelationWorkspaceState = defaultPermanentRelationWorkspaceState("");
      this.permanentNoteWorkspace().reset("");
      this.syncPermanentRelationWorkspaceOverlay();
      this.els.result.innerHTML = `<div class="related-empty">打开笔记后可打磨。</div>`;
      return;
    }
    const relationRequestSerial = ++this.relationsRequestSerial;
    this.currentSemanticRelations = null;
    this.semanticRelationsState = "loading";

    const tags = parseTags(tab.body || "");
    const { forward, backward, tagRelated } = this.buildLocalRelationSignals(note, tab);
    const isPermanentNote = this.isOriginalNote(note);
    const isRecordableSource = this.isOriginalRecordableSource(note);
    const sidebarLayout = permanentNoteSidebarLayout({ isPermanentNote, isRecordableSource, tags });
    if (!isPermanentNote || (this.permanentRelationWorkspaceState.open && this.permanentRelationWorkspaceState.noteId && this.permanentRelationWorkspaceState.noteId !== note.id)) {
      this.permanentRelationWorkspaceState = defaultPermanentRelationWorkspaceState(isPermanentNote ? note.id : "");
      this.syncPermanentRelationWorkspaceOverlay();
    }
    if (!isPermanentNote) this.permanentNoteWorkspace().reset("");

    const renderNoteItem = (n, badgeText = "") => `
      <button class="related-item" data-preview-note="${n.id}">
        <span class="related-item-title">${escapeHtml(n.title)}</span>
        <span class="related-item-meta">${escapeHtml(noteTypeText(n.noteType || typeFromFolder(this.state, n.folderId)))} · ${escapeHtml(this.folderLabel(n.folderId))}</span>
        ${
          excerptFromBody(n.body || "", n.title)
            ? `<span class="related-item-preview">${escapeHtml(excerptFromBody(n.body || "", n.title))}</span>`
            : ""
        }
        <span class="related-item-badges">
          ${badgeText ? `<span class="related-item-badge">${escapeHtml(badgeText)}</span>` : ""}
          ${Array.isArray(n.tags) && n.tags.length ? `<span class="related-item-badge">#${escapeHtml(n.tags.slice(0, 2).join(" #"))}</span>` : ""}
        </span>
      </button>
    `;

    const block = (title, noteText, list, emptyText, badgeText = "") => `
      <section class="inspector-section">
        <div class="inspector-section-head">
          <div class="inspector-section-title">${title}</div>
          <div class="inspector-count">${list.length}</div>
        </div>
        ${noteText ? `<div class="inspector-section-note">${noteText}</div>` : ""}
        ${
          list.length
            ? `<div class="inspector-list">${list
                .map((n) => renderNoteItem(n, badgeText))
                .join("")}</div>`
            : `<div class="related-empty">${emptyText}</div>`
        }
      </section>
    `;

    const overviewMeta = isPermanentNote
      ? `${noteTypeText(this.resolvedNoteType(note))} · ${this.folderLabel(note.folderId)}`
      : `${noteTypeText(this.resolvedNoteType(note))} · ${this.folderLabel(note.folderId)}`;
    const overviewRows =
      sidebarLayout.showOverviewTags
        ? `
          <div class="inspector-overview-grid">
            <div class="inspector-overview-row">
              <span class="inspector-overview-label">标签</span>
              <span class="inspector-overview-value">${escapeHtml(tags.map((tag) => `#${tag}`).join(" "))}</span>
            </div>
          </div>
        `
        : "";

    const showInspectorOverview = !sidebarLayout.showDeferredWorkspace;
    this.els.result.innerHTML = `
      ${
        showInspectorOverview
          ? `<div class="inspector-overview">
              <div class="inspector-overview-head">
                <div class="inspector-overview-title">${escapeHtml(note.title)}</div>
                <div class="inspector-overview-meta">${escapeHtml(overviewMeta)}</div>
              </div>
              ${overviewRows}
            </div>`
          : ""
      }
      ${showInspectorOverview && sidebarLayout.showStatusSummary ? this.renderInspectorStatusSummary(note, { forward, backward, tagRelated }) : ""}
      ${
        sidebarLayout.showSourceGuidance
          ? `<div class="inspector-section-note" data-inspector-link-summary-note>当前编辑的是来源笔记。这里先完成永久笔记；正式打磨请在永久笔记里继续。</div>`
          : ""
      }
      <div class="inspector-sections">
        ${extraTitle ? `<section class="inspector-section"><div class="related-empty">${escapeHtml(extraTitle)}</div></section>` : ""}
        ${
          sidebarLayout.showDeferredWorkspace
            ? this.renderDeferredNoteWorkspace(note, tab)
            : sidebarLayout.showSourceFlow
              ? this.renderSourceNoteFlowSection(note)
              : ""
        }
      </div>
    `;
    this.refreshEditorBodyRelationActions(note, tab, {
      relationState: isPermanentNote ? "loading" : "idle",
      relations: null
    });
    if (isPermanentNote) {
      void this.refreshSemanticRelations(note.id, relationRequestSerial);
      void this.refreshNoteAiSuggestions(note.id);
      return;
    }
    this.semanticRelationsState = "idle";
    this.refreshEditorBodyRelationActions(null, null);
  }

  async handleTokenAction(token) {
    if (!token) return;

    if (token.startsWith("#")) {
      const tag = normalizeClickedTag(token);
      const note = this.activeNote();
      if (!note) return;
      const rootId = rootBoxIdFromFolder(this.state, note.folderId);
      this.setInspectorVisible(true);
      this.els.result.innerHTML = `<div class="related-empty">正在从 SQLite 检索 #${escapeHtml(tag)}...</div>`;
      let list = [];
      try {
        const result = await fetchNotesByTag(tag, { rootDirectoryId: rootId });
        this.upsertApiNotes(result.items);
        list = result.items.filter((item) => item.id !== note.id);
      } catch (error) {
        list = this.state.notes.filter(
          (n) => n.id !== note.id && rootBoxIdFromFolder(this.state, n.folderId) === rootId && (n.tags || []).includes(tag)
        );
        this.onStatus(`标签 API 不可用，已降级本地检索：${String(error?.message || error)}`, "warn");
      }
      const renderTagResult = (n) => {
        const excerpt = excerptFromBody(n.body || "", n.title);
        const meta = this.relatedNoteMeta(n, { includeFolder: false });
        const badges = this.tagMatchBadges(n, tag);
        return `
          <button class="related-item tag-related-item" data-preview-note="${escapeHtml(n.id)}">
            <span class="related-item-title">${escapeHtml(n.title || n.id || "未命名笔记")}</span>
            ${meta ? `<span class="related-item-meta">${escapeHtml(meta)}</span>` : ""}
            ${excerpt ? `<span class="related-item-preview">${escapeHtml(excerpt)}</span>` : ""}
            <span class="related-item-badges">
              ${badges.map((item) => `<span class="related-item-badge">#${escapeHtml(item)}</span>`).join("")}
            </span>
          </button>
        `;
      };
      this.els.result.innerHTML = `
        <div class="inspector-overview">
          <div class="inspector-overview-head">
            <div class="inspector-overview-title">同标签笔记：#${escapeHtml(tag)}</div>
            <div class="inspector-overview-meta">点击笔记查看内容，再决定是否补关系。</div>
          </div>
        </div>
        <div class="inspector-summary">
          <span class="inspector-chip">标签 #${escapeHtml(tag)}</span>
          <span class="inspector-chip">${list.length} 条</span>
        </div>
        ${
          list.length
            ? `<div class="inspector-sections"><section class="inspector-section"><div class="inspector-list">${list
                .map((n) => renderTagResult(n))
                .join("")}</div></section></div>`
            : `<div class="related-empty">当前目录下没有更多带 #${escapeHtml(tag)} 的笔记。</div>`
        }
      `;
      this.onStatus(`已从 SQLite 检索标签 #${tag}`, "ok");
      return;
    }

    const linkMatch = token.match(/^\[\[([^\]]+)\]\]$/);
    if (linkMatch) {
      const note = this.activeNote();
      if (!note) return;
      const tokenValue = linkMatch[1];
      const scoped = this.linkResolutionCandidates({ excludeNoteId: note.id });
      const resolved = await this.resolvePreviewLinkToken(tokenValue, scoped);
      if (resolved?.note) {
        this.setInspectorVisible(true);
        await this.showNotePreviewInInspector(resolved.note.id, {
          eyebrow: "正文链接",
          mode: "wikilink",
          ambiguous: resolved.ambiguous === true
        });
        this.onStatus(
          resolved.ambiguous ? `已打开链接笔记预览：${resolved.note.title}（存在重名，请核对）` : `已打开链接笔记预览：${resolved.note.title}`,
          resolved.ambiguous ? "warn" : "ok"
        );
      } else {
        this.onStatus(`未找到关联笔记：${tokenValue}`, "warn");
      }
    }
  }

  async loadNoteForPreview(noteId) {
    const cleanId = String(noteId || "").trim();
    if (!cleanId) return null;
    let note = this.state.notes.find((item) => item.id === cleanId) || null;
    if (note?.bodyLoaded && typeof note.body === "string") return note;
    try {
      const fetched = await fetchNote(cleanId);
      if (fetched) {
        this.upsertApiNotes([fetched]);
        note = this.state.notes.find((item) => item.id === cleanId) || note;
      }
    } catch (error) {
      this.onStatus(`预览笔记加载失败：${String(error?.message || error)}`, "warn");
    }
    return note;
  }

  async openLinkedPreviewNote(noteId) {
    const note = await this.loadNoteForPreview(noteId);
    if (!note?.id) {
      this.onStatus("没有找到这条关联笔记。", "warn");
      return;
    }
    const openedByHost =
      typeof this.onOpenNote === "function" ? await this.onOpenNote(note.id, { preferTitleSelection: false }) : false;
    if (openedByHost !== true) {
      this.openNoteTab(note.id, { preferTitleSelection: false });
      await this.onStateChange("switch-tab");
    }
    this.onStatus("已在新标签中编辑这条笔记", "ok");
  }

  async resolvePreviewLinkToken(tokenValue, scopedNotes = this.linkResolutionCandidates()) {
    const resolved = this.resolveLinkToken(tokenValue, scopedNotes);
    if (resolved?.note) return resolved;
    const query = wikilinkTargetFromRaw(tokenValue);
    if (!query) return null;
    try {
      const result = await searchNotes({ query, excludeNoteId: this.activeNote()?.id || "", limit: 8 });
      const items = Array.isArray(result?.items) ? result.items : [];
      if (items.length) {
        this.upsertApiNotes(items);
        const scoped = this.linkResolutionCandidates({ excludeNoteId: this.activeNote()?.id || "" });
        const byId = scoped.find((item) => normalizeText(item.id) === normalizeText(query));
        if (byId) return { note: byId, ambiguous: false, mode: "id" };
        for (const candidatePath of markdownReferencePathCandidates(query)) {
          const byPath = scoped.filter((item) => noteMatchesMarkdownReferencePath(item, candidatePath));
          if (byPath.length === 1) return { note: byPath[0], ambiguous: false, mode: "path" };
          if (byPath.length > 1) return { note: byPath[0], ambiguous: true, mode: "path" };
        }
        const exactTitle = items.filter((item) => normalizeText(item.title) === normalizeText(query));
        if (exactTitle.length === 1) return { note: exactTitle[0], ambiguous: false, mode: "search" };
        if (exactTitle.length > 1) return { note: exactTitle[0], ambiguous: true, mode: "search" };
      }
    } catch (error) {
      this.onStatus(`查找链接笔记失败：${String(error?.message || error)}`, "warn");
    }
    return null;
  }

  async showNotePreviewInInspector(noteId, options = {}) {
    const note = await this.loadNoteForPreview(noteId);
    if (!note) {
      this.els.result.innerHTML = `<div class="related-empty bad">没有找到这条笔记。</div>`;
      return;
    }
    const body = typeof note.body === "string" && note.body.trim() ? note.body : `# ${note.title || "未命名笔记"}\n`;
    this.setInspectorVisible(true);
    this.els.result.innerHTML = `
      <div class="note-peek-actions">
        <button class="mini-btn primary" type="button" data-open-linked-note="${escapeHtml(note.id)}">编辑笔记</button>
        <button class="mini-btn icon-btn is-ghost" type="button" data-close-note-peek aria-label="关闭">×</button>
      </div>
      <section class="inspector-section note-peek-section">
        <div class="markdown-preview note-peek-preview">
          ${renderMarkdownPreview(body, { noteMarkdownPath: note.markdownPath || "" })}
        </div>
      </section>
    `;
  }

  extractCoreClaimFromBody(body) {
    const lines = String(body || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .filter(Boolean);
    return lines.join(" ").slice(0, 4000);
  }

  resolvePlanFromWindow() {
    const raw = typeof window !== "undefined" ? window.__ORIGINALITY_PLAN__ : null;
    if (!raw || typeof raw !== "object") return {};
    return {
      warnThreshold: Number(raw.warnThreshold),
      blockThreshold: Number(raw.blockThreshold),
      requireCitationLocator: raw.requireCitationLocator,
      allowDraftOnWarning: raw.allowDraftOnWarning,
      blockOnBlocked: raw.blockOnBlocked
    };
  }

  dedupeLinkedLiterature(notes = []) {
    const dedupLiterature = [];
    const seen = new Set();
    for (const ln of notes) {
      if (!ln?.id || seen.has(ln.id)) continue;
      seen.add(ln.id);
      dedupLiterature.push(ln);
    }
    return dedupLiterature;
  }

  linkedLiteratureForOriginality(note, links = []) {
    const scoped = this.linkResolutionCandidates({ excludeNoteId: note?.id || "" });
    return this.dedupeLinkedLiterature(
      links
        .map((token) => this.resolveLinkToken(token, scoped))
        .filter((x) => x?.note && x.ambiguous !== true)
        .map((x) => x.note)
        .filter((x) => x && this.resolvedNoteType(x) === "literature")
    );
  }

  async hydrateNoteForResolution(note) {
    if (!note?.id) return note;
    if (typeof note.body === "string" && note.bodyLoaded !== false) return note;
    try {
      const full = await this.fetchNoteForResolution(note.id);
      if (!full) return note;
      this.upsertApiNotes([{ ...full, directoryId: full.directoryId || full.folderId }]);
      return this.state.notes.find((item) => item.id === note.id) || {
        ...note,
        ...full,
        folderId: full.directoryId || full.folderId || note.folderId,
        bodyLoaded: typeof full.body === "string"
      };
    } catch {
      return note;
    }
  }

  async linkedLiteratureForHydratedOriginality(note, links = []) {
    const scoped = this.linkResolutionCandidates({ excludeNoteId: note?.id || "" });
    const linkedLiterature = [];
    for (const token of links) {
      const resolved = this.resolveLinkToken(token, scoped);
      let target = resolved?.ambiguous === true ? null : resolved?.note || null;
      if (!target && looksLikeStableNoteId(token)) {
        try {
          const fetched = await this.fetchNoteForResolution(wikilinkTargetFromRaw(token));
          if (fetched) {
            this.upsertApiNotes([{ ...fetched, directoryId: fetched.directoryId || fetched.folderId }]);
            target = this.state.notes.find((item) => item.id === fetched.id) || {
              ...fetched,
              folderId: fetched.directoryId || fetched.folderId,
              bodyLoaded: typeof fetched.body === "string"
            };
          }
        } catch {
          target = null;
        }
      }
      const hydrated = target ? await this.hydrateNoteForResolution(target) : null;
      if (hydrated && this.resolvedNoteType(hydrated) === "literature") linkedLiterature.push(hydrated);
    }
    return this.dedupeLinkedLiterature(linkedLiterature);
  }

  originalityPayloadFromLiterature(note, currentBody, linkedLiterature = []) {
    const dedupLiterature = this.dedupeLinkedLiterature(linkedLiterature);
    const literature = dedupLiterature.map((ln) => ({
      source_id: `src_from_${ln.id}`,
      quote_text: normalizeFieldText(this.parseLiteratureBody(ln.body || "").originalText || ln.body || "")
    }));

    const citations = dedupLiterature.map((ln) => ({
      source_id: `src_from_${ln.id}`
    }));

    return {
      originalityPlan: this.resolvePlanFromWindow(),
      literature,
      permanent: [
        {
          id: note.id,
          core_claim: this.extractCoreClaimFromBody(currentBody),
          citations
        }
      ]
    };
  }

  buildOriginalityPayload(note) {
    const currentBody = this.getEditorValue() || note.body || "";
    const links = parseLinks(currentBody);
    return this.originalityPayloadFromLiterature(
      note,
      currentBody,
      this.linkedLiteratureForOriginality(note, links)
    );
  }

  async buildHydratedOriginalityPayload(note) {
    const currentBody = this.getEditorValue() || note.body || "";
    const links = parseLinks(currentBody);
    return this.originalityPayloadFromLiterature(
      note,
      currentBody,
      await this.linkedLiteratureForHydratedOriginality(note, links)
    );
  }

  async runOriginalityCheck(note, { forSave = false } = {}) {
    const payload = await this.buildHydratedOriginalityPayload(note);
    const result = await checkOriginality(payload);
    const evalItem = result?.originalityGuard?.evaluations?.[0] || null;
    if (!evalItem) {
      return {
        status: "warning",
        similarity: 0,
        reasons: ["missing_evaluation"],
        raw: result
      };
    }

    if (evalItem.status === "blocked") {
      const similarity = Math.round((Number(evalItem.similarity) || 0) * 100);
      const message = `这条永久笔记还太贴近材料原句（相似度 ${similarity}%），说明它还没有完全长成你自己的独立判断。请先改写成自己的判断，再保存。`;
      this.showOriginalityNotice("需要重写", "bad", message);
      this.onStatus(message, "bad");
      if (forSave) {
        this.setSaveUiState("blocked", reflectionQuestionsHint(message));
      }
      return { ...evalItem, raw: result };
    }

    if (evalItem.status === "warning") {
      return { ...evalItem, raw: result };
    }

    return { ...evalItem, raw: result };
  }

  showBottomNotice(title = "提醒", tone = "", message = "", options = {}) {
    const panel = this.els.originalityNotice;
    if (!panel) return;
    const resolvedTitle = String(title || "").trim() || "提醒";
    const resolvedMessage = String(message || "").trim();
    const dedupeKey = String(options?.dedupeKey || `${resolvedTitle}:${tone}:${resolvedMessage}`).trim();
    const autoHideMs = Number(options?.autoHideMs);
    const noticeHead = panel.querySelector(".floating-notice-head");
    if (dedupeKey && dedupeKey === this.lastBottomNoticeKey && !panel.classList.contains("hidden")) {
      if (this.bottomNoticeTimer) clearTimeout(this.bottomNoticeTimer);
      if (autoHideMs > 0) {
        this.bottomNoticeTimer = setTimeout(() => this.hideBottomNotice(), autoHideMs);
      }
      return;
    }
    this.lastBottomNoticeKey = dedupeKey;
    if (this.bottomNoticeTimer) clearTimeout(this.bottomNoticeTimer);
    this.els.originalityNoticeTitle && (this.els.originalityNoticeTitle.textContent = resolvedTitle);
    this.els.originalityNoticeBody && (this.els.originalityNoticeBody.textContent = resolvedMessage || resolvedTitle);
    if (noticeHead) noticeHead.hidden = !resolvedTitle;
    panel.classList.remove("hidden");
    panel.dataset.tone = String(tone || "");
    if (autoHideMs > 0) {
      this.bottomNoticeTimer = setTimeout(() => this.hideBottomNotice(), autoHideMs);
    }
  }

  showOriginalityNotice(title = "原创性提醒", tone = "", message = "") {
    if (!this.isOriginalNote()) {
      this.hideOriginalityNotice();
      return;
    }
    this.showBottomNotice(title, tone, message, {
      autoHideMs: 10000,
      dedupeKey: `originality:${title}:${tone}:${message}`
    });
  }

  hideBottomNotice() {
    if (this.bottomNoticeTimer) {
      clearTimeout(this.bottomNoticeTimer);
      this.bottomNoticeTimer = null;
    }
    this.lastBottomNoticeKey = "";
    this.els.originalityNotice?.classList.add("hidden");
  }

  hideOriginalityNotice() {
    this.hideBottomNotice();
  }
  bind() {
    this.els.tabs.addEventListener("click", async (e) => {
      const closeBtn = e.target.closest("button[data-close-tab]");
      if (closeBtn) {
        if (this.closeTab(closeBtn.dataset.closeTab)) {
          this.onStatus("已关闭标签页", "ok");
        }
        return;
      }

      const switchBtn = e.target.closest("button[data-switch-tab]");
      if (switchBtn) {
        const nextTabId = switchBtn.dataset.switchTab;
        if (nextTabId !== this.state.activeTabId) {
          await this.autoSaveActiveNote("switch-tab");
          this.closeTransientPanels({ closeInspector: true });
        }
        this.state.activeTabId = nextTabId;
        this.fillEditorFromTab();
        this.onStateChange("switch-tab");
        const menu = this.els.tabs.querySelector("[data-tab-menu]");
        if (menu) menu.classList.add("hidden");
        return;
      }

      const actBtn = e.target.closest("button[data-tabs-action]");
      if (actBtn) {
        const action = actBtn.dataset.tabsAction;
        if (action === "new") {
          this.onStateChange("create-note-in-selected-folder");
          return;
        }
        if (action === "toggle-menu") {
          const menu = this.els.tabs.querySelector("[data-tab-menu]");
          if (menu) menu.classList.toggle("hidden");
          return;
        }
        if (action === "close-all") {
          if (this.closeAllTabs()) {
            this.onStatus("已关闭全部标签页", "ok");
          }
          return;
        }
      }

      const tab = e.target.closest(".tab[data-tab]");
      if (!tab) return;
      if (tab.dataset.tab === "welcome") return;
      if (tab.dataset.tab !== this.state.activeTabId) {
        await this.autoSaveActiveNote("switch-tab");
        this.closeTransientPanels({ closeInspector: true });
      }
      this.state.activeTabId = tab.dataset.tab;
      this.fillEditorFromTab();
      this.onStateChange("switch-tab");
    });

    const setEmptyStartBusy = (busy) => {
      this.emptyStartActionPending = busy;
      this.els.emptyStart?.setAttribute("aria-busy", busy ? "true" : "false");
      this.els.emptyStart?.querySelectorAll?.("[data-empty-start-action]").forEach((button) => {
        button.disabled = busy;
      });
    };
    const setEmptyDemoConfirming = (confirming) => {
      this.emptyStartDemoConfirming = confirming;
      const confirmPanel = this.els.emptyStart?.querySelector?.("[data-empty-demo-confirm]");
      confirmPanel?.classList.toggle("hidden", !confirming);
      const primaryButton = this.els.emptyStart?.querySelector?.('[data-empty-start-action="seed-demo"]');
      primaryButton?.setAttribute("aria-expanded", confirming ? "true" : "false");
    };
    const setEmptyDemoStatus = (message = "", tone = "") => {
      const status = this.els.emptyStart?.querySelector?.("[data-empty-demo-status]");
      if (!status) return;
      status.textContent = message;
      status.classList.toggle("is-busy", tone === "busy");
      status.classList.toggle("is-ok", tone === "ok");
      status.classList.toggle("is-bad", tone === "bad");
    };
    const startEmptyAction = (event, action = "create-note") => {
      event.preventDefault();
      event.stopPropagation();
      if (action === "seed-demo-cancel") {
        setEmptyDemoConfirming(false);
        setEmptyDemoStatus("");
        return;
      }
      if (action === "seed-demo") {
        setEmptyDemoConfirming(true);
        setEmptyDemoStatus("确认后会立即开始导入。", "");
        this.onStatus?.("请确认是否导入示例库。", "");
        return;
      }
      if (action === "create-note") {
        this.requestCreateNoteFromEmptyState();
        return;
      }
      if (this.emptyStartActionPending) return;
      const reason = action === "seed-demo-confirm"
        ? "seed-smart-notes-demo"
        : action === "open-import"
          ? "open-import"
          : "";
      if (!reason) return;
      setEmptyStartBusy(true);
      const payload = action === "seed-demo-confirm" ? { source: "empty-start", confirmed: true } : { source: "empty-start" };
      if (action === "seed-demo-confirm") setEmptyDemoStatus("正在导入示例库，请稍等...", "busy");
      Promise.resolve(this.onStateChange(reason, payload))
        .then((result) => {
          if (action === "seed-demo-confirm") {
            setEmptyDemoStatus(result === false ? "导入没有完成，请按状态提示重试。" : "导入成功，正在打开导览笔记...", result === false ? "bad" : "ok");
          }
        })
        .catch((error) => {
          if (action === "seed-demo-confirm") setEmptyDemoStatus(`导入失败：${String(error?.message || error)}`, "bad");
          this.onStatus?.(`操作失败：${String(error?.message || error)}`, "bad");
        })
        .finally(() => {
          setEmptyStartBusy(false);
        });
    };
    this.els.emptyStart?.addEventListener("click", (event) => {
      const actionButton = event.target.closest?.("[data-empty-start-action]");
      if (!actionButton) return;
      startEmptyAction(event, actionButton.getAttribute("data-empty-start-action") || "create-note");
    });
    this.els.emptyStart?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const actionButton = event.target.closest?.("[data-empty-start-action]");
      if (!actionButton) return;
      startEmptyAction(event, actionButton.getAttribute("data-empty-start-action") || "create-note");
    });
    this.els.markdownSplit?.addEventListener("click", (event) => {
      if (!this.els.markdownSplit?.closest?.(".editor-empty")) return;
      if (event.target.closest("button, input, textarea, select, a")) return;
      startEmptyAction(event, "create-note");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#tabs")) {
        const menu = this.els.tabs.querySelector("[data-tab-menu]");
        if (menu) menu.classList.add("hidden");
      }
    });
    document.addEventListener(
      "click",
      (event) => {
        if (!this.els.wysiwygHost?.contains?.(event.target)) return;
        const externalLink = this.extractRichExternalLinkFromEvent(event);
        if (!externalLink?.url) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (event.isTrusted) void this.openExternalUrl(externalLink.url);
      },
      true
    );
    window.addEventListener(
      "click",
      (event) => {
        if (!this.els.wysiwygHost?.contains?.(event.target)) return;
        const externalLink = this.extractRichExternalLinkFromEvent(event);
        if (!externalLink?.url) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (event.isTrusted) void this.openExternalUrl(externalLink.url);
      },
      true
    );

    document.addEventListener(
      "keydown",
      (e) => {
        const linkInlineOpen = !this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext;
        const tagInlineOpen = !this.els.tagPicker.classList.contains("hidden") && this.currentTagContext;
        if (!linkInlineOpen && !tagInlineOpen) return;
        if (e.target.closest("#linkSearchInput") || e.target.closest("#tagSearchInput")) return;
        if (e.target.closest("#linkReasonInput") || e.target.closest("#linkRelationTypeSelect")) return;
        const targetIsEditor =
          e.target.closest?.("#editorHost") || e.target.closest?.("#wysiwygHost") || e.target.closest?.("#editorBody");
        const targetIsPicker = e.target.closest?.("#linkPicker") || e.target.closest?.("#tagPicker");
        const targetIsEmptyPageFocus = e.target === document.body || e.target === document.documentElement || e.target === document;
        if (!targetIsEditor && !targetIsPicker && !targetIsEmptyPageFocus) return;

        if (e.key === "ArrowDown") {
          if (linkInlineOpen) this.moveLinkCandidate(1);
          else void this.moveTagCandidate(1);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === "ArrowUp") {
          if (linkInlineOpen) this.moveLinkCandidate(-1);
          else void this.moveTagCandidate(-1);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === "Enter") {
          if (linkInlineOpen) {
            void this.confirmSelectedLinkCandidate();
          } else {
            const chosen = this.currentTagCandidates[this.currentTagIndex] || this.currentTagCandidates[0];
            this.insertSelectedTag(chosen?.name || this.els.tagSearchInput.value);
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === "Escape") {
          if (linkInlineOpen) this.closeLinkPicker();
          if (tagInlineOpen) this.closeTagPicker();
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    this.els.result.addEventListener("click", (e) => {
      const templatePreferenceClear = e.target.closest("[data-template-preference-clear]");
      if (templatePreferenceClear) {
        this.applyTemplatePreferenceClear(
          templatePreferenceClear.getAttribute("data-template-preference-clear") || "",
          templatePreferenceClear
        );
        return;
      }
      const distillationTemplateMergeAction = e.target.closest("[data-distillation-template-merge-action]");
      if (distillationTemplateMergeAction) {
        this.commitDistillationTemplateVariant(
          distillationTemplateMergeAction.closest("[data-distillation-template-merge-choice]"),
          distillationTemplateMergeAction.getAttribute("data-distillation-template-merge-action") || "replace"
        );
        return;
      }
      const distillationTemplateButton = e.target.closest("[data-distillation-template-variant]");
      if (distillationTemplateButton) {
        this.applyDistillationTemplateVariant(distillationTemplateButton);
        return;
      }
      if (routeEditorRelationClick(this, e)) {
        return;
      }
      const aiAnalysisButton = e.target.closest("[data-note-ai-analysis]");
      if (aiAnalysisButton) {
        void this.runPermanentNoteAnalysis();
        return;
      }
      const permanentWorkspaceTab = e.target.closest("[data-permanent-workspace-tab]");
      if (permanentWorkspaceTab) {
        this.activatePermanentWorkspaceTab(permanentWorkspaceTab.getAttribute("data-permanent-workspace-tab"));
        return;
      }

      const distillationFocusButton = e.target.closest("[data-note-distillation-focus]");
      if (distillationFocusButton) {
        const target = String(distillationFocusButton.dataset.noteDistillationFocus || "").trim();
        if (target === "confirm") {
          void this.confirmDistillation();
          return;
        }
        if (target === "relations") {
          this.activatePermanentWorkspaceTab("relations");
          return;
        }
        const focusSelector =
          target === "boundary"
            ? '[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]'
            : target === "summary2" || target === "summary3"
              ? `[data-note-distillation-form] textarea[name="${target}"]`
              : target === "summary1"
                ? '[data-note-distillation-form] textarea[name="summary1"]'
                : '[data-note-distillation-form] textarea[name="thesis"]';
        this.jumpToInspectorSection("[data-note-distillation-section]", {
          focus: true,
          focusSelector
        });
        return;
      }

      const distillationConfirmButton = e.target.closest("[data-note-distillation-confirm]");
      if (distillationConfirmButton) {
        void this.confirmDistillation();
        return;
      }
      const noteAiSuggestionAction = e.target.closest("[data-note-ai-suggestion-action]");
      if (noteAiSuggestionAction) {
        void this.applyNoteAiSuggestionAction(
          noteAiSuggestionAction.getAttribute("data-note-ai-suggestion-action"),
          noteAiSuggestionAction.getAttribute("data-note-ai-suggestion-id"),
          noteAiSuggestionAction.getAttribute("data-note-ai-suggestion-artifact-id")
        );
        return;
      }
      const noteAiOpenInbox = e.target.closest("[data-note-ai-open-inbox]");
      if (noteAiOpenInbox) {
        void this.onStateChange("open-note-ai-inbox", {
          noteId: this.activeNote()?.id || "",
          artifactId: noteAiOpenInbox.getAttribute("data-note-ai-open-inbox") || ""
        });
        return;
      }

      const sourceContextualAiAction = e.target.closest("[data-contextual-ai-ignore], [data-contextual-ai-confirm-remote], [data-contextual-ai-adopt]");
      if (sourceContextualAiAction && sourceContextualAiAction.closest("[data-source-note-flow-section]")) {
        const actionId = contextualAiActionIdFromElement(sourceContextualAiAction, "distill_material");
        if (actionId !== "distill_material") return;
        if (sourceContextualAiAction.hasAttribute("data-contextual-ai-confirm-remote")) {
          void this.runSourceDistillAction({ remoteConfirmed: true });
        } else if (sourceContextualAiAction.hasAttribute("data-contextual-ai-adopt")) {
          void this.createPermanentNoteFromSourceDistill(contextualAiResultInputValues(this.els.result));
        } else {
          this.setSourceDistillAiState(null);
          this.onStatus("已关闭提炼结果", "ok");
        }
        return;
      }

      const sourceNoteAction = e.target.closest("[data-source-note-action]");
      if (sourceNoteAction) {
        const action = String(sourceNoteAction.getAttribute("data-source-note-action") || "").trim();
        if (action === "record-permanent") {
          this.els.recordPermanent?.click?.();
        }
        if (action === "dismiss-fleeting-cleanup") {
          this.dismissFleetingCleanupPrompt(this.activeNote());
          this.renderRelated();
          this.onStatus("已标记为稍后清理", "ok");
        }
        return;
      }

      const isolatedHoldButton = e.target.closest("[data-note-isolated-hold]");
      if (isolatedHoldButton) {
        this.focusTemporaryIsolatedBoundary();
        return;
      }

      const mainRouteButton = e.target.closest("[data-note-main-route-action]");
      if (mainRouteButton) {
        const action = String(mainRouteButton.dataset.noteMainRouteAction || "").trim();
        if (action === "distillation") {
          this.activatePermanentWorkspaceTab("viewpoint");
          this.jumpToInspectorSection("[data-note-distillation-section]", {
            focus: true,
            focusSelector:
              String(mainRouteButton.dataset.noteMainRouteFocus || "").trim() === "boundary"
                ? '[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]'
                : '[data-note-distillation-form] textarea[name="thesis"]'
          });
          return;
        }
        if (action === "relations") {
          this.setInspectorVisible(true);
          this.activatePermanentWorkspaceTab("relations");
          if (String(mainRouteButton.dataset.noteMainRouteFocus || "").trim() === "create") {
            this.openCreateRelationForm({
              source: RELATION_ENTRY_SOURCES.PERMANENT_WORKSPACE,
              mode: "manual",
              returnTo: "permanent-relation-workspace"
            });
          }
          return;
        }
        if (action === "graph" || action === "writing") {
          if (action === "writing") this.activatePermanentWorkspaceTab("writing");
          void this.onStateChange("open-note-main-route", {
            noteId: this.activeNote()?.id || "",
            action,
            mode: String(mainRouteButton.dataset.noteMainRouteMode || "").trim()
          });
          return;
        }
      }

      const distillationSection = e.target.closest("[data-note-distillation-section]");
      if (distillationSection && e.target.closest("button, textarea, input, select")) return;

      const previewRow = e.target.closest("[data-preview-note]");
      if (previewRow) {
        void this.showNotePreviewInInspector(previewRow.dataset.previewNote, { eyebrow: "相关内容" });
        return;
      }
      const linkedNoteButton = e.target.closest("[data-open-linked-note]");
      if (linkedNoteButton?.dataset.openLinkedNote) {
        void this.openLinkedPreviewNote(linkedNoteButton.dataset.openLinkedNote);
        return;
      }
      const closeNotePeekButton = e.target.closest("[data-close-note-peek]");
      if (closeNotePeekButton) {
        this.toggleInspector(false);
        return;
      }
      const link = e.target.closest("[data-preview-link]");
      if (link) {
        void this.handleTokenAction(`[[${link.dataset.previewLink}]]`);
        return;
      }
      const tag = e.target.closest("[data-preview-tag]");
      if (tag) {
        void this.handleTokenAction(`#${tag.dataset.previewTag}`);
        return;
      }
      const asset = e.target.closest("[data-preview-asset-url]");
      if (asset?.dataset.previewAssetUrl) {
        this.openAssetPreview(asset.dataset.previewAssetUrl, asset.dataset.previewAssetLabel || "");
        return;
      }
      const missingAsset = e.target.closest("[data-preview-missing-asset]");
      if (missingAsset?.dataset.previewMissingAsset) {
        this.onStatus(`附件路径不可预览：${missingAsset.dataset.previewMissingAsset}`, "warn");
        return;
      }
      const row = e.target.closest("[data-open-note]");
      if (!row) return;
      void this.showNotePreviewInInspector(row.dataset.openNote, { eyebrow: "相关内容" });
    });
    this.els.result.addEventListener("input", (e) => {
      const distillationInput = e.target.closest("[data-note-distillation-form] textarea, [data-note-distillation-form] input, [data-note-distillation-form] select");
      if (distillationInput) {
        const form = distillationInput.closest("[data-note-distillation-form]");
        if (form) {
          this.permanentNoteDistillation().syncDraftFromForm(form);
          this.refreshDistillationQuality(form);
        }
        return;
      }
      if (routeEditorRelationInput(this, e)) {
        return;
      }
    });
    this.els.editorWrap?.addEventListener("click", (e) => {
      const mainRouteButton = e.target.closest("[data-note-main-route-action]");
      if (mainRouteButton) {
        const action = String(mainRouteButton.dataset.noteMainRouteAction || "").trim();
        if (action === "relations") {
          e.preventDefault();
          e.stopPropagation();
          this.setInspectorVisible(true);
          this.activatePermanentWorkspaceTab("relations");
          return;
        }
      }
      if (routeEditorRelationClick(this, e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    this.els.result.addEventListener("focusin", (e) => {
      routeEditorRelationFocusIn(this, e);
    });
    this.els.result.addEventListener("keydown", (e) => {
      routeEditorRelationKeydown(this, e);
    });
    this.els.result.addEventListener("submit", (e) => {
      const distillationForm = e.target.closest("[data-note-distillation-form]");
      if (distillationForm) {
        e.preventDefault();
        void this.handleDistillationForm(distillationForm);
        return;
      }
      if (routeEditorRelationSubmit(this, e)) return;
    });
    this.els.preview?.addEventListener("click", (e) => {
      const copy = e.target.closest("[data-preview-copy-code]");
      if (copy?.dataset.previewCopyCode) {
        void this.copyText(decodePreviewPayload(copy.dataset.previewCopyCode), "已复制代码块");
        return;
      }
      const link = e.target.closest("[data-preview-link]");
      if (link) {
        this.handleTokenAction(`[[${link.dataset.previewLink}]]`);
        return;
      }
      const external = e.target.closest("[data-preview-external-url]");
      if (external?.dataset.previewExternalUrl) {
        void this.openExternalUrl(external.dataset.previewExternalUrl);
        return;
      }
      const tag = e.target.closest("[data-preview-tag]");
      if (tag) {
        this.handleTokenAction(`#${tag.dataset.previewTag}`);
        return;
      }
      const asset = e.target.closest("[data-preview-asset-url]");
      if (asset?.dataset.previewAssetUrl) {
        this.openAssetPreview(asset.dataset.previewAssetUrl, asset.dataset.previewAssetLabel || "");
        return;
      }
      const missingAsset = e.target.closest("[data-preview-missing-asset]");
      if (missingAsset?.dataset.previewMissingAsset) {
        this.onStatus(`附件路径不可预览：${missingAsset.dataset.previewMissingAsset}`, "warn");
      }
    });
    this.els.closeAssetPreview?.addEventListener("click", () => this.closeAssetPreview());
    this.els.assetPreviewMask?.addEventListener("click", (event) => {
      if (event.target === this.els.assetPreviewMask) this.closeAssetPreview();
    });
    this.els.assetPreviewOpenLink?.addEventListener("click", (event) => {
      const url = String(this.els.assetPreviewOpenLink?.getAttribute("href") || "").trim();
      if (!url || url === "#") {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      void this.openExternalUrl(url);
    });

    document.querySelectorAll(".tb[data-md]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.md;
        if (t === "bold") this.wrapSelection("**", "**");
        if (t === "italic") this.wrapSelection("*", "*");
      });
    });

    this.installToolbarCommandMenu();
    this.els.headingLevel?.addEventListener("change", () => {
      const rawValue = String(this.els.headingLevel?.value || "").trim();
      if (rawValue === "p") {
        this.clearCurrentHeading();
        this.renderContextualToolbarState();
        this.focusEditor();
        return;
      }
      const level = Number(rawValue || 0);
      if (level >= 1 && level <= 6) this.formatCurrentBlock(`h${level}`);
      this.renderContextualToolbarState();
      this.focusEditor();
    });
    this.els.insertLink.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.clearMarkdownSelectionOverride();
      this.manualLinkReturnSelection = this.rememberEditorSelection() || this.rememberedEditorSelection();
      this.manualLinkReturnScrollState = this.captureEditorScrollState();
    });
    this.els.insertLink.addEventListener("click", (event) => {
      event.preventDefault();
      const note = this.activeNote();
      if (!note) return this.onStatus("请先打开一个笔记", "warn");
      if (!this.isOriginalNote(note)) return this.onStatus("建立关系请在永久笔记里进行", "warn");
      const returnSelection =
        this.normalizedSelectionRange(this.manualLinkReturnSelection) ||
        this.rememberEditorSelection() ||
        this.rememberedEditorSelection();
      this.openPermanentRelationWorkspace({
        source: RELATION_ENTRY_SOURCES.TOOLBAR_RELATION,
        mode: "manual",
        noteId: note.id,
        insertLinkOnSave: true,
        cursorRange: returnSelection,
        relationType: this.relationCreateDefaultType(note) || "associated_with"
      });
    });

    this.els.insertImage?.addEventListener("click", () => {
      const note = this.activeNote();
      if (!note) return this.onStatus("请先打开一个笔记", "warn");
      this.els.assetImageInput?.click();
    });
    this.els.assetImageInput?.addEventListener("change", async () => {
      const files = [...(this.els.assetImageInput?.files || [])];
      await this.insertAssetFiles(files, { sourceLabel: "选择图片" });
    });
    this.els.assetFileInput?.addEventListener("change", async () => {
      const files = [...(this.els.assetFileInput?.files || [])];
      await this.insertAssetFiles(files, { sourceLabel: "选择附件" });
    });

    const preserveInlinePickerFocus = (event) => {
      if (!event.target.closest("#linkPicker") && !event.target.closest("#tagPicker")) return;
      const interactiveControl = event.target.closest("select, textarea, input, button, option, label");
      if (interactiveControl && !this.currentLinkContext && !this.currentTagContext) return;
      event.preventDefault();
    };
    this.els.linkPicker?.addEventListener("mousedown", preserveInlinePickerFocus);
    this.els.tagPicker?.addEventListener("mousedown", preserveInlinePickerFocus);

    this.els.closeLinkPicker.addEventListener("click", () => this.closeLinkPicker());
    this.els.linkSearchInput.addEventListener("input", () => {
      this.currentPinnedLinkId = "";
      this.renderLinkCandidates(this.els.linkSearchInput.value);
      if (this.currentLinkContext) this.positionInlineLinkPicker();
    });
    this.els.linkSearchInput.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        this.closeLinkPicker();
        return;
      }
      if (e.key === "ArrowDown") {
        this.moveLinkCandidate(1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        this.moveLinkCandidate(-1);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        void this.confirmSelectedLinkCandidate();
        e.preventDefault();
      }
    });
    this.els.linkReasonInput?.addEventListener("input", () => this.updateLinkPickerConfirmButton());
    this.els.linkRelationTypeSelect?.addEventListener("change", () => this.updateLinkPickerConfirmButton());
    this.els.linkSearchList.addEventListener("click", (e) => {
      const row = e.target.closest("[data-link-note-id]");
      if (!row) return;
      const next = Number(row.dataset.linkIndex);
      if (Number.isInteger(next)) this.currentLinkIndex = next;
      this.currentPinnedLinkId = String(row.dataset.linkNoteId || "").trim();
      const chosen = this.currentLinkCandidates.find((note) => note.id === this.currentPinnedLinkId) || null;
      this.renderLinkCandidates(this.els.linkSearchInput.value, row.dataset.linkNoteId || "");
      this.els.linkSearchInput.value = chosen ? this.linkCandidateDisplayTitle(chosen) : row.textContent?.trim() || "";
      this.els.linkSearchList.innerHTML = "";
      this.updateLinkPickerConfirmButton();
    });
    this.els.linkSearchList.addEventListener("mouseover", (e) => {
      const row = e.target.closest("[data-link-index]");
      if (!row) return;
      const next = Number(row.dataset.linkIndex);
      if (!Number.isInteger(next) || next === this.currentLinkIndex) return;
      this.currentLinkIndex = next;
      this.renderLinkCandidates(this.els.linkSearchInput.value, this.currentLinkCandidates[next]?.id || "");
    });
    this.els.confirmLinkInsert?.addEventListener("click", () => {
      const selectedId = String(this.currentPinnedLinkId || this.selectedLinkCandidate()?.id || "").trim();
      if (!selectedId) return;
      void this.insertSelectedLinkNote(selectedId);
    });

    this.els.insertTag.addEventListener("click", async () => {
      const note = this.activeNote();
      if (!note) return this.onStatus("请先打开一个笔记", "warn");
      if (this.isWysiwygMode()) {
        await this.openTagPicker("", { anchorAtCursor: true });
        return;
      }
      this.insertAtCursor("#");
      const inline = this.detectInlineTagContext();
      if (inline) {
        await this.openTagPicker("", { inlineContext: inline, focusInput: true });
        return;
      }
      await this.openTagPicker("");
    });
    this.els.modeEdit?.addEventListener("click", () => {
      this.togglePreview();
    });
    this.els.closeTagPicker.addEventListener("click", () => this.closeTagPicker());
    this.els.closeOriginalityNotice?.addEventListener("click", () => this.hideOriginalityNotice());
    this.els.tagSearchInput.addEventListener("input", async () => {
      const list = await this.fetchTagCandidates(this.els.tagSearchInput.value);
      this.renderTagCandidates(list);
    });
    this.els.tagSearchInput.addEventListener("keydown", async (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        this.closeTagPicker();
        return;
      }
      if (e.key === "ArrowDown") {
        await this.moveTagCandidate(1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        await this.moveTagCandidate(-1);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        const chosen = this.currentTagCandidates[this.currentTagIndex] || this.currentTagCandidates[0];
        this.insertSelectedTag(chosen?.name || this.els.tagSearchInput.value);
        e.preventDefault();
      }
    });
    this.els.tagSearchList.addEventListener("click", (e) => {
      const insertCurrent = e.target.closest("[data-insert-current-tag]");
      if (insertCurrent) {
        this.insertSelectedTag(this.els.tagSearchInput.value);
        return;
      }
      const row = e.target.closest("[data-tag-name]");
      if (!row) return;
      this.insertSelectedTag(row.dataset.tagName);
    });
    this.els.tagSearchList.addEventListener("mouseover", (e) => {
      const row = e.target.closest("[data-tag-index]");
      if (!row) return;
      const next = Number(row.dataset.tagIndex);
      if (!Number.isInteger(next) || next === this.currentTagIndex) return;
      this.currentTagIndex = next;
      this.renderTagCandidates(this.currentTagCandidates, this.currentTagCandidates[next]?.name || "");
    });

    this.els.save.addEventListener("click", async () => {
      await this.saveActiveNote();
    });

    const recordSourceAsPermanent = async () => {
      const note = this.activeNote();
      if (!note || !this.isOriginalRecordableSource(note)) {
        this.onStatus("随笔笔记和文献笔记才能创建永久笔记", "warn");
        return;
      }
      const directoryId = await this.pickPermanentDirectoryForNote(note);
      if (!directoryId) return;
      await this.onStateChange("record-original-from-note", {
        sourceNoteId: note.id,
        sourceType: this.resolvedNoteType(note),
        sourceTitle: note.title,
        sourceBody: this.getEditorValue(),
        directoryId
      });
    };

    this.els.recordPermanent?.addEventListener("click", recordSourceAsPermanent);
    this.els.distillSourceAi?.addEventListener("click", recordSourceAsPermanent);

    this.els.completeNote?.addEventListener("click", async () => {
      await this.saveActiveNote({ markLiteratureComplete: true });
    });
    this.els.literatureOpenNext?.addEventListener("click", () => {
      const current = this.activeNote();
      const nextRecord =
        this.literatureQueueRecords(current).find((item) => !item.isCurrent && item.lane === "pending") ||
        this.literatureQueueRecords(current).find((item) => !item.isCurrent && item.lane === "refine");
      if (!nextRecord) {
        this.onStatus("当前范围没有待处理的文献条目", "ok");
        return;
      }
      this.onOpenNote(nextRecord.note.id);
      this.onStatus(`已打开下一条${nextRecord.label}：${nextRecord.note.title || nextRecord.note.id}`, "ok");
    });
    this.els.literatureQueueList?.addEventListener("click", async (event) => {
      const createButton = event.target.closest("[data-create-original-from-literature]");
      if (createButton) {
        const noteId = String(createButton.getAttribute("data-create-original-from-literature") || "").trim();
        const record = this.literatureQueueRecords(this.activeNote()).find((item) => item.note.id === noteId);
        if (!record) {
          this.onStatus("没有找到要提炼的文献条目", "warn");
          return;
        }
        if (record.lane !== "ready") {
          this.onStatus("这条文献笔记还没准备好进入永久笔记，请先补齐来源、转述、判断种子或追问", "warn");
          return;
        }
        const directoryId = await this.pickPermanentDirectoryForNote(record.note);
        if (!directoryId) return;
        void this.onStateChange("record-original-from-note", {
          sourceNoteId: record.note.id,
          sourceTitle: record.note.title || "",
          sourceType: this.resolvedNoteType(record.note) || "literature",
          sourceBody: record.note.body || "",
          directoryId,
          citation: record.fields.citation || {},
          originalText: record.fields.originalText || "",
          paraphrase: record.fields.paraphrase || "",
          whyKeep: record.fields.whyKeep || "",
          supportsJudgment: record.fields.supportsJudgment || "",
          question: record.fields.question || "",
          boundary: record.fields.boundary || ""
        });
        return;
      }
      const button = event.target.closest("[data-open-literature-note]");
      if (!button) return;
      const noteId = String(button.getAttribute("data-open-literature-note") || "").trim();
      if (!noteId) return;
      this.onOpenNote(noteId);
      const target = this.state.notes.find((item) => item.id === noteId);
      this.onStatus(`已打开文献条目：${target?.title || noteId}`, "ok");
    });

    for (const field of [
      this.els.literatureTitle,
      this.els.literatureOriginal,
      this.els.literatureParaphrase,
      this.els.literatureWhyKeep,
      this.els.literatureSupportsJudgment,
      this.els.literatureQuestion,
      this.els.literatureBoundary
    ]) {
      field?.addEventListener("input", () => {
        if (!this.isLiteratureWorkspaceActive()) return;
        this.syncLiteratureWorkspaceToEditor();
        this.handleEditorInput();
      });
    }

    this.els.body.addEventListener("input", () => {
      this.rememberEditorSelection();
      this.handleEditorInput();
    });
    this.els.body.addEventListener("keyup", () => this.rememberEditorSelection());
    this.els.body.addEventListener("mouseup", () => this.rememberEditorSelection());

    this.els.editorHost?.addEventListener("paste", (event) => {
      const clipboardFiles = [...(event.clipboardData?.files || [])];
      if (!clipboardFiles.length) {
        const items = [...(event.clipboardData?.items || [])]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter(Boolean);
        if (!items.length) return;
        event.preventDefault();
        void this.insertAssetFiles(items, { sourceLabel: "粘贴" });
        return;
      }
      event.preventDefault();
      void this.insertAssetFiles(clipboardFiles, { sourceLabel: "粘贴" });
    });
    this.els.editorHost?.addEventListener("dragover", (event) => {
      const hasFiles = [...(event.dataTransfer?.types || [])].includes("Files");
      if (!hasFiles) return;
      event.preventDefault();
      this.els.editorHost?.classList.add("dragover");
    });
    this.els.editorHost?.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && this.els.editorHost?.contains(event.relatedTarget)) return;
      this.els.editorHost?.classList.remove("dragover");
    });
    this.els.editorHost?.addEventListener("drop", (event) => {
      const files = [...(event.dataTransfer?.files || [])];
      this.els.editorHost?.classList.remove("dragover");
      if (!files.length) return;
      event.preventDefault();
      void this.insertAssetFiles(files, { sourceLabel: "拖拽" });
    });

    this.els.body.addEventListener("keydown", (e) => {
      this.handleEditorKeydown(e);
    });

    const handleGlobalSaveShortcut = (e) => {
      if (e.__yansiluSaveHandled) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || String(e.key || "").toLowerCase() !== "s" || e.isComposing) return;
      if (!this.activeTab()) return;
      e.__yansiluSaveHandled = true;
      e.preventDefault();
      e.stopPropagation();
      this.saveActiveNote();
    };
    window.addEventListener("keydown", handleGlobalSaveShortcut, true);
    document.addEventListener("keydown", handleGlobalSaveShortcut, true);

    this.els.body.addEventListener("click", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const value = this.els.body.value;
      const token = tokenAtCursor(value, this.els.body.selectionStart || 0);
      this.handleTokenAction(token);
    });

    this.els.body.addEventListener("keyup", () => this.updateToolbarFormattingState());
    this.els.body.addEventListener("mouseup", () => this.updateToolbarFormattingState());
    this.els.selectionAiAction?.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    this.els.selectionAiDistill?.addEventListener("click", (event) => {
      event.preventDefault();
      this.applySelectionDistillationDraft();
    });

    document.addEventListener("selectionchange", () => {
      const active = document.activeElement;
      if (
        active?.closest?.("#editorHost") ||
        active?.closest?.("#wysiwygHost") ||
        active === this.els.body ||
        document.getSelection()?.anchorNode?.parentElement?.closest?.("#editorHost") ||
        document.getSelection()?.anchorNode?.parentElement?.closest?.("#wysiwygHost")
      ) {
        const editingTitleNow = this.isEditingTitleLine();
        const wasEditingTitle = this.wasEditingTitleLine;
        this.wasEditingTitleLine = editingTitleNow;
        if (wasEditingTitle && !editingTitleNow) this.maybeSaveOnTitleBlur();
        this.updateToolbarFormattingState();
      } else {
        this.wasEditingTitleLine = false;
      }
    });

    this.els.showRelated.addEventListener("click", () => {
      this.toggleInspector();
    });

    this.els.hideRelated?.addEventListener("click", () => {
      this.toggleInspector(false);
    });
  }

  handleEditorInput() {
       if (this.suppressEditorChange) return;
      this.hideSelectionAiAction();
      const tab = this.activeTab();
      if (!tab) return;
      const previousValue = this.lastEditorValue || "";
      tab.body = this.getEditorValue();
      if (!this.isStructuredWorkspaceActive() && this.isWysiwygMode()) {
        const normalized = normalizePlaceholderTitleBody(tab.body);
        if (normalized !== tab.body) {
          tab.body = normalized;
          this.setEditorValue(normalized);
        }
      }
      tab.title = titleFromBody(tab.body);
      this.syncPlaceholderTitleArmed(tab);
      this.syncTabDirtyState(tab);
      if (this.isOriginalNote()) {
        const authorship = this.activeAuthorshipState();
        if (authorship.confirmed && authorship.confirmedBody !== tab.body) {
          authorship.confirmed = false;
        }
      }
      tab.saveUiState = {
        mode: tab.dirty ? "dirty" : "saved",
        message: tab.dirty ? "" : "当前文件：已自动同步"
      };
      if (tab.dirty) this.writeDraft(tab);
      else this.clearDraft(tab.noteId);
      if (tab.dirty) this.scheduleAutoSave();
      else this.clearAutoSaveTimer();
      this.renderTabs();
      this.renderSaveHint();
      this.renderLiteratureWorkspace();
      this.renderPreview();
      this.updateToolbarFormattingState();

      if (this.isStructuredWorkspaceActive()) {
        this.lastEditorValue = tab.body;
        return;
      }
      if (this.isEditingTitleLine()) {
        this.lastTitleInputAt = Date.now();
        if (!this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext) this.closeLinkPicker();
        if (!this.els.tagPicker.classList.contains("hidden") && this.currentTagContext) this.closeTagPicker();
        this.lastEditorValue = tab.body;
        return;
      }

      if (this.skipInlinePickersOnce) {
        this.skipInlinePickersOnce = false;
        if (!this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext) this.closeLinkPicker();
        if (!this.els.tagPicker.classList.contains("hidden") && this.currentTagContext) this.closeTagPicker();
        this.lastEditorValue = tab.body;
        return;
      }

      const inline = this.detectInlineLinkContext();
      const tagInline = this.detectInlineTagContext();
      const explicitEmptyLinkTrigger = inline && !inline.query;
      const explicitEmptyTagTrigger =
        tagInline &&
        !tagInline.query &&
        (Date.now() - this.lastTagTriggerAt < 900 || previousValue.slice(tagInline.start, tagInline.end) !== "#");
      const wantsInlinePicker = Boolean(
        (inline && (inline.query || explicitEmptyLinkTrigger)) ||
          (tagInline && (tagInline.query || explicitEmptyTagTrigger))
      );

      if (!wantsInlinePicker && Date.now() - this.lastPlainEnterAt < 260) {
        if (!this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext) this.closeLinkPicker();
        if (!this.els.tagPicker.classList.contains("hidden") && this.currentTagContext) this.closeTagPicker();
        this.lastEditorValue = tab.body;
        return;
      }

      if (inline && (inline.query || explicitEmptyLinkTrigger)) {
        void this.openLinkPicker(inline.query, { inlineContext: inline });
        this.lastInlinePickerAnchor = inline.end;
      } else if (!this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext) {
        this.closeLinkPicker();
      }

      if (tagInline && (tagInline.query || explicitEmptyTagTrigger)) {
        void this.openTagPicker(tagInline.query, { inlineContext: tagInline });
        this.lastInlinePickerAnchor = tagInline.end;
      } else if (!this.els.tagPicker.classList.contains("hidden") && this.currentTagContext) {
        this.closeTagPicker();
      }
      this.lastEditorValue = tab.body;
  }

  scheduleInlineLinkTriggerProbe() {
    setTimeout(() => {
      const inline = this.detectInlineLinkContext();
      if (!inline || inline.query) return;
      const body = this.getEditorValue();
      const trigger = String(body.slice(inline.start, inline.end) || "");
      if (!["[[", "【【"].includes(trigger)) return;
      void this.openLinkPicker("", { inlineContext: inline, focusInput: true });
      this.lastInlinePickerAnchor = inline.end;
    }, 0);
  }

  handleEditorKeydown(e) {
    if (this.isWysiwygMode()) this.clearMarkdownSelectionOverride();
    if (e.isComposing || e.keyCode === 229) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = String(e.key || "").toLowerCase();
    const inlinePickerOpenBeforeEnter =
      (!this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext) ||
      (!this.els.tagPicker.classList.contains("hidden") && this.currentTagContext);
    if (!mod && (e.key === "[" || e.key === "【")) {
      this.lastLinkTriggerAt = Date.now();
      this.scheduleInlineLinkTriggerProbe();
    }
    if (!mod && e.key === "#") this.lastTagTriggerAt = Date.now();
    if (!mod && !e.shiftKey && e.key === "Enter" && !inlinePickerOpenBeforeEnter) this.lastPlainEnterAt = Date.now();

    if (!mod && !e.shiftKey && e.key === "Enter" && this.enterBodyFromTitle()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (mod && key === "s") {
      e.preventDefault();
      this.saveActiveNote();
      return;
    }
    if (mod && key === "1") {
      e.preventDefault();
      this.togglePreview("wysiwyg");
      return;
    }
    if (mod && key === "2") {
      e.preventDefault();
      this.togglePreview("source");
      return;
    }
    if (mod && key === "b") {
      e.preventDefault();
      this.wrapSelection("**", "**");
      return;
    }
    if (mod && key === "i") {
      e.preventDefault();
      this.wrapSelection("*", "*");
      return;
    }
    if (mod && e.shiftKey && key === "h") {
      e.preventDefault();
      this.formatCurrentBlock("h2");
      return;
    }
    if (mod && e.shiftKey && key === "7") {
      e.preventDefault();
      this.formatCurrentBlock("ul");
      return;
    }
    if (!mod && e.key === "Tab") {
      e.preventDefault();
      this.indentSelection(e.shiftKey ? -1 : 1);
      return;
    }

    const linkInlineOpen = !this.els.linkPicker.classList.contains("hidden") && this.currentLinkContext;
    const tagInlineOpen = !this.els.tagPicker.classList.contains("hidden") && this.currentTagContext;
    if (this.isWysiwygMode() && !linkInlineOpen && !tagInlineOpen && !mod && !e.shiftKey && e.key === "Enter" && this.handleStructuredEnter()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (this.isWysiwygMode() && !linkInlineOpen && !tagInlineOpen && !mod && !e.shiftKey && e.key === "Enter" && this.handlePlainParagraphEnter()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!linkInlineOpen && !tagInlineOpen && !mod && e.key === "Backspace" && this.handleStructuredBackspace()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!linkInlineOpen && !tagInlineOpen) return;

    if (e.key === "ArrowDown") {
      if (linkInlineOpen) this.moveLinkCandidate(1);
      else void this.moveTagCandidate(1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      if (linkInlineOpen) this.moveLinkCandidate(-1);
      else void this.moveTagCandidate(-1);
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      if (linkInlineOpen) {
        void this.confirmSelectedLinkCandidate();
      } else {
        const chosen = this.currentTagCandidates[this.currentTagIndex] || this.currentTagCandidates[0];
        this.insertSelectedTag(chosen?.name || this.els.tagSearchInput.value);
      }
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (linkInlineOpen) this.closeLinkPicker();
      if (tagInlineOpen) this.closeTagPicker();
      e.preventDefault();
    }
  }

  async saveActiveNote(options = {}) {
    if (this.savingPromise) {
      const inFlightSave = this.savingPromise;
      if (!options?.autoSave) {
        const activeTabId = this.activeTab()?.id || "";
        const completed = await inFlightSave.catch(() => false);
        await Promise.resolve();
        if (this.savingPromise === inFlightSave) this.savingPromise = null;
        const tab = this.activeTab();
        if (tab?.id === activeTabId && tab.dirty) return this.saveActiveNote(options);
        return completed;
      }
      return inFlightSave;
    }
    this.clearAutoSaveTimer();
    if (!options?.autoSave) {
      this.closeLinkPicker();
      this.closeTagPicker();
    }
    this.setSaveUiState("saving", "当前文件：正在自动同步...");
    let wrappedSave;
    wrappedSave = (async () => {
      try {
        return await this.performSaveActiveNote(options);
      } finally {
        if (this.savingPromise === wrappedSave) this.savingPromise = null;
        if (this.activeTab()?.dirty) this.scheduleAutoSave();
      }
    })();
    this.savingPromise = wrappedSave;
    return await wrappedSave;
  }

  async performSaveActiveNote(options = {}) {
    const tab = this.updateActiveTabFromEditor();
    if (!tab) return this.onStatus("请先打开一个笔记", "warn");
    const note = this.state.notes.find((n) => n.id === tab.noteId);
    if (!note) return this.onStatus("找不到对应笔记", "bad");
    const savingTabId = tab.id;
    const savingNoteId = note.id;
    const savingTabIsActive = () => this.state.activeTabId === savingTabId;
    const setSavingTabUiState = (mode, message = "") => {
      tab.saveUiState = { mode, message };
      if (savingTabIsActive()) this.renderSaveHint();
    };
    const markLiteratureComplete = options?.markLiteratureComplete === true;
    const skipOriginalityCheck = options?.skipOriginalityCheck === true;

    note.body = tab.body;
    note.noteType = typeFromFolder(this.state, note.folderId);
    if (this.isOriginalNote(note)) {
      const normalizedBody = this.normalizePermanentBodyForSave(note.body);
      if (normalizedBody !== note.body) {
        note.body = normalizedBody;
        tab.body = normalizedBody;
      }
    }
    note.title = titleFromBody(note.body);
    note.tags = parseTags(note.body);
    note.links = parseLinks(note.body);
    note.updatedAt = new Date().toISOString();

    tab.title = note.title;
    const bodySnapshot = String(note.body || "");
    const titleSnapshot = String(note.title || titleFromBody(bodySnapshot));

    let originality = null;
    let nextStatus = String(note.status || "draft").trim() || "draft";
    if (note.noteType === "literature") {
      const completion = this.literatureCompletionState(note);
      if (markLiteratureComplete && !completion.hasParaphrase) {
        const message = reflectionQuestionsHint("文献笔记还不能标记完成。");
        setSavingTabUiState("blocked", message);
        this.onStatus("文献笔记缺少转述，不能标记为已完成", "warn");
        return;
      }
      if (markLiteratureComplete && !completion.hasOriginalText) {
        const message = reflectionQuestionsHint("文献笔记还不能标记完成。");
        setSavingTabUiState("blocked", message);
        this.onStatus("文献笔记缺少原文摘录，不能标记为已完成", "warn");
        return;
      }
      if (markLiteratureComplete && !completion.hasCitationMetadata) {
        const missing = completion.missingCitationFields.join("、");
        const message = `文献笔记还不能标记完成。缺少引用信息：${missing}`;
        setSavingTabUiState("blocked", message);
        this.onStatus(`文献笔记缺少引用信息：${missing}`, "warn");
        return;
      }
      if (!completion.hasParaphrase || !completion.hasCitationMetadata) {
        nextStatus = "draft";
      } else if (markLiteratureComplete || nextStatus === "active") {
        nextStatus = "active";
      } else {
        nextStatus = "draft";
      }
      note.status = nextStatus;
    }
    if (this.isOriginalNote(note)) {
      if (skipOriginalityCheck) {
        nextStatus = String(note.status || nextStatus || "draft").trim() || "draft";
      } else {
      try {
        originality = await this.runOriginalityCheck(note, { forSave: true });
      } catch (error) {
        this.onStatus(`原创性检查不可用，当前先按草稿处理：${String(error?.message || error)}`, "warn");
        originality = { status: "warning", similarity: 0, reasons: ["check_unavailable"] };
      }
      if (originality?.status === "blocked") {
        setSavingTabUiState("blocked", reflectionQuestionsHint("当前文件：原创性检测阻止继续推进，请先重写。"));
        return;
      }
      note.originalityStatus = originality?.status || "warning";
      note.originalitySimilarity = Number(originality?.similarity || 0);
      nextStatus = note.originalityStatus === "pass" ? "active" : "draft";
      note.status = nextStatus;
      }
    }

    if (!this.isOriginalNote(note)) {
      this.onStatus(
        note.noteType === "literature" && nextStatus === "active"
          ? "文献笔记已完成"
          : "当前修改已同步",
        "ok"
      );
    }
    this.renderRelated();
    const saved = await this.onStateChange("save-note", {
      noteId: savingNoteId,
      title: titleSnapshot,
      body: bodySnapshot,
      status: nextStatus,
      originalityStatus: note.originalityStatus,
      originalitySimilarity: note.originalitySimilarity,
      authorshipConfirmed: true,
      authorshipClaim: "",
      preserveEditorFocus: true,
      suppressSaveAiSuggestion: options?.suppressSaveAiSuggestion === true
    });
    if (saved === false || (saved && typeof saved === "object" && saved.ok === false)) {
      tab.dirty = true;
      this.writeDraft(tab);
      setSavingTabUiState(
        String(saved?.saveMode || "error").trim() || "error",
        String(saved?.saveMessage || "当前文件：同步失败，修改仍保留在编辑器中。")
      );
      return;
    }
    let savedBody = bodySnapshot;
    let savedTitle = titleSnapshot;
    if (saved && typeof saved === "object" && String(saved.id || "") === savingNoteId) {
      savedBody = typeof saved.body === "string" ? saved.body : bodySnapshot;
      note.title = saved.title || titleFromBody(savedBody);
      note.body = savedBody;
      note.markdownPath = saved.markdownPath || note.markdownPath;
      note.status = saved.status || note.status;
      note.thinkingStatus = saved.thinkingStatus || note.thinkingStatus || null;
      note.tags = parseTags(savedBody);
      note.links = parseLinks(savedBody);
      note.updatedAt = saved.updatedAt || note.updatedAt;
      note.bodyLoaded = true;
      savedTitle = note.title;
    }
    const liveBodyAtCompletion = savingTabIsActive() ? this.getEditorValue() : tab.body;
    const liveMatchesSaved = normalizedBodyTextForDirtyCheck(liveBodyAtCompletion) === normalizedBodyTextForDirtyCheck(savedBody);
    const changedSinceSaveStarted =
      !liveMatchesSaved &&
      (this.tabBodyChangedSinceSnapshot(tab, bodySnapshot) ||
      this.tabBodyChangedSinceSnapshot({ body: liveBodyAtCompletion }, bodySnapshot));
    tab.savedBody = savedBody;
    tab.savedTitle = savedTitle;
    this.syncPlaceholderTitleArmed(tab);
    if (changedSinceSaveStarted) {
      tab.body = liveBodyAtCompletion;
      tab.title = titleFromBody(tab.body);
      this.syncTabDirtyState(tab);
      if (tab.dirty) {
        this.writeDraft(tab);
        setSavingTabUiState("dirty", "当前文件：已同步早先修改，仍有未保存编辑");
      } else {
        this.clearDraft(tab.noteId);
        setSavingTabUiState("saved", "当前文件：已自动同步");
      }
      this.renderTabs();
      this.renderThinkingStatus();
      return saved || true;
    }
    tab.title = savedTitle;
    tab.body = savedBody;
    tab.dirty = false;
    this.clearDraft(tab.noteId);
    setSavingTabUiState("saved", "当前文件：已自动同步");
    if (
      savingTabIsActive() &&
      normalizedBodyTextForDirtyCheck(this.getEditorValue()) !== normalizedBodyTextForDirtyCheck(tab.body)
    ) {
      this.setEditorValue(tab.body);
    }
    if (this.isOriginalNote(note)) {
      this.onStatus(
        note.originalityStatus === "pass" ? "永久笔记已同步" : "永久笔记已同步，但仍建议继续打磨",
        note.originalityStatus === "pass" ? "ok" : "warn"
      );
    }
    this.renderTabs();
    this.renderThinkingStatus();
  }
}
applyEditorPaneStateMethods(EditorPane);
