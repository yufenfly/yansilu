import { escapeHtml } from "./editor-render-utils.js";
import {
  applyPermanentNoteDistillationToNote,
  currentPermanentNoteDistillationPrefill,
  emptyPermanentNoteDistillationPrefill,
  normalizePermanentNoteDistillationPrefill,
  permanentNoteDistillationFormValues,
  permanentNoteViewpointBaseline,
  permanentNoteViewpointSourceCandidates,
  permanentNoteViewpointHasChanged
} from "./permanent-note-distillation-model.js";
import {
  renderPermanentNoteDistillationSection as renderPermanentNoteDistillationSectionView
} from "./permanent-note-distillation-view.js";

export class PermanentNoteDistillationController {
  constructor(host) {
    this.host = host;
    this.prefillState = emptyPermanentNoteDistillationPrefill("");
    this.viewpointDraftByNoteId = new Map();
    this.currentDraftScope = this.draftScope();
  }

  draftScope() {
    return String(this.host?.vaultScope?.() || "").trim();
  }

  syncDraftScope() {
    const nextScope = this.draftScope();
    if (nextScope === this.currentDraftScope) return;
    this.viewpointDraftByNoteId.clear();
    this.prefillState = emptyPermanentNoteDistillationPrefill("");
    this.currentDraftScope = nextScope;
  }

  clearDrafts() {
    this.viewpointDraftByNoteId.clear();
    this.prefillState = emptyPermanentNoteDistillationPrefill("");
  }

  setPrefill(noteId = "", options = {}) {
    this.syncDraftScope();
    const host = this.host;
    const cleanNoteId = String(noteId || "").trim();
    const preferredTemplateVariant = cleanNoteId
      ? host.readTemplateVariantPreference("distillation", options?.draftVariants || [], options?.selectedTemplateVariant || "")
      : "";
    const rememberedTemplateVariant = cleanNoteId
      ? host.templateVariantPreferenceMeta("distillation", options?.draftVariants || [])
      : { key: "", label: "" };
    const hasExplicitViewpointDraft = Object.prototype.hasOwnProperty.call(options || {}, "viewpointDraft");
    if (hasExplicitViewpointDraft && cleanNoteId) {
      if (options.viewpointDraft && typeof options.viewpointDraft === "object") {
        this.viewpointDraftByNoteId.set(cleanNoteId, { ...options.viewpointDraft });
      } else {
        this.viewpointDraftByNoteId.delete(cleanNoteId);
      }
    }
    const viewpointDraft = cleanNoteId ? this.viewpointDraftByNoteId.get(cleanNoteId) || null : null;
    this.prefillState = normalizePermanentNoteDistillationPrefill(cleanNoteId, { ...options, viewpointDraft }, {
      preferredTemplateVariant,
      rememberedTemplateVariant
    });
  }

  currentPrefill(noteId = "") {
    this.syncDraftScope();
    const current = currentPermanentNoteDistillationPrefill(this.prefillState, noteId);
    const cleanNoteId = String(noteId || "").trim();
    const viewpointDraft = cleanNoteId ? this.viewpointDraftByNoteId.get(cleanNoteId) || null : null;
    return viewpointDraft ? { ...current, viewpointDraft: { ...viewpointDraft } } : current;
  }

  renderSection(note) {
    const host = this.host;
    return renderPermanentNoteDistillationSectionView(note, {
      noteType: host.resolvedNoteType(note),
      explicitRelationCount: host.currentExplicitRelationCount(),
      distillationPrefill: this.currentPrefill(note?.id || ""),
      viewpointBaseline: permanentNoteViewpointBaseline(note),
      viewpointSourceCandidates: permanentNoteViewpointSourceCandidates(
        note,
        host.currentSemanticRelations,
        host.state?.notes
      ),
      aiWorkspaceHtml: host.renderNoteEmbeddedAiWorkspaceForNote(note?.id || "")
    });
  }

  showTemplateMergeChoice(picker, button) {
    const host = this.host;
    const choiceBox = picker?.querySelector?.("[data-distillation-template-merge-choice]");
    if (!choiceBox || !button) return;
    const label = String(button.textContent || "").trim();
    choiceBox.dataset.pendingVariantKey = String(button.dataset.distillationTemplateVariant || "").trim();
    choiceBox.dataset.pendingVariantLabel = label;
    choiceBox.dataset.pendingBoundaryDraft = String(button.dataset.boundaryDraft || "");
    choiceBox.hidden = false;
    choiceBox.innerHTML = `
      <p>你已经改过这段边界草稿了。切到“${escapeHtml(label)}”时，要直接替换，还是先追加成备选？</p>
      <div class="semantic-template-merge-actions">
        <button class="mini-btn primary" type="button" data-distillation-template-merge-action="replace">替换当前草稿</button>
        <button class="mini-btn" type="button" data-distillation-template-merge-action="append">追加为备选</button>
        <button class="mini-btn is-ghost" type="button" data-distillation-template-merge-action="cancel">先不切</button>
      </div>
    `;
  }

  updatePrefillFromForm(form, cleanKey = "") {
    const host = this.host;
    const noteId = String(form?.closest?.("[data-note-distillation-section]")?.getAttribute("data-note-id") || host.activeNote()?.id || "").trim();
    const boundary = form?.querySelector?.('textarea[name="boundaryOrCounterpoint"]');
    if (noteId && this.prefillState.noteId === noteId) {
      this.prefillState = {
        ...this.prefillState,
        selectedTemplateVariant: String(cleanKey || "").trim(),
        boundaryDraft: boundary?.value || ""
      };
    }
  }

  syncDraftFromForm(form) {
    this.syncDraftScope();
    const host = this.host;
    const note = host.activeNote();
    if (!note?.id || !form) return;
    const values = permanentNoteDistillationFormValues(form);
    this.syncChangeReasonVisibility(form, values);
    this.prefillState = {
      ...this.currentPrefill(note.id),
      noteId: note.id,
      viewpointDraft: { ...values }
    };
    this.viewpointDraftByNoteId.set(note.id, { ...values });
  }

  syncChangeReasonVisibility(form, values = permanentNoteDistillationFormValues(form)) {
    const field = form?.querySelector?.("[data-viewpoint-change-reason]");
    const textarea = field?.querySelector?.('[name="thesisChangeReason"]');
    const changed = permanentNoteViewpointHasChanged(values.originalThesis, values.thesis);
    if (field) field.hidden = !changed;
    if (textarea) textarea.required = changed;
    return changed;
  }

  refreshQuality(form) {
    const values = permanentNoteDistillationFormValues(form);
    this.syncChangeReasonVisibility(form, values);
    return values;
  }

  commitTemplateVariant(choiceBox, action = "replace") {
    const host = this.host;
    if (!choiceBox) return;
    if (action === "cancel") {
      host.clearTemplateMergeChoice(choiceBox);
      return;
    }
    const picker = choiceBox.closest("[data-distillation-template-picker]");
    const form = picker?.closest?.("[data-note-distillation-form]");
    if (!picker || !form) return;
    const cleanKey = String(choiceBox.dataset.pendingVariantKey || "").trim();
    const label = String(choiceBox.dataset.pendingVariantLabel || "").trim();
    const boundaryDraft = String(choiceBox.dataset.pendingBoundaryDraft || "");
    const targetButton =
      Array.from(picker.querySelectorAll("[data-distillation-template-variant]")).find(
        (item) => String(item.dataset.distillationTemplateVariant || "").trim() === cleanKey
      ) || picker.querySelector("[data-distillation-template-variant]");
    if (!targetButton) {
      host.clearTemplateMergeChoice(choiceBox);
      return;
    }
    const boundary = form.querySelector('textarea[name="boundaryOrCounterpoint"]');
    if (boundary) {
      boundary.value =
        action === "append"
          ? host.appendTemplateDraft(boundary.value, boundaryDraft, label, "备选边界视角")
          : boundaryDraft;
    }
    host.toggleTemplateVariantButtons(form.querySelectorAll("[data-distillation-template-variant]"), targetButton);
    this.updatePrefillFromForm(form, cleanKey);
    host.writeTemplateVariantPreference("distillation", cleanKey);
    host.clearTemplateMergeChoice(choiceBox);
    boundary?.focus?.();
  }

  applyTemplateVariant(button) {
    const host = this.host;
    const cleanKey = String(button?.dataset?.distillationTemplateVariant || "").trim();
    if (!cleanKey) return;
    const form = button.closest("[data-note-distillation-form]");
    if (!form) return;
    const picker = button.closest("[data-distillation-template-picker]");
    const activeButton = form.querySelector("[data-distillation-template-variant].is-active");
    if (activeButton === button) {
      host.clearTemplateMergeChoice(picker?.querySelector?.("[data-distillation-template-merge-choice]"));
      return;
    }
    const boundary = form.querySelector('textarea[name="boundaryOrCounterpoint"]');
    const shouldConfirm = host.templateDraftHasConflict(
      boundary?.value || "",
      activeButton?.dataset?.boundaryDraft || "",
      button.dataset.boundaryDraft || ""
    );
    if (shouldConfirm) {
      this.showTemplateMergeChoice(picker, button);
      return;
    }
    if (boundary) boundary.value = String(button.dataset.boundaryDraft || "");
    host.toggleTemplateVariantButtons(form.querySelectorAll("[data-distillation-template-variant]"), button);
    this.updatePrefillFromForm(form, cleanKey);
    host.writeTemplateVariantPreference("distillation", cleanKey);
    host.clearTemplateMergeChoice(picker?.querySelector?.("[data-distillation-template-merge-choice]"));
    boundary?.focus?.();
  }

  focusTemporaryIsolatedBoundary() {
    const host = this.host;
    const sectionSelector = "[data-note-distillation-section]";
    const focusSelector = '[data-note-distillation-form] textarea[name="boundaryOrCounterpoint"]';
    const applyDraft = () => {
      const section = host.els.result?.querySelector?.(sectionSelector);
      const textarea = section?.querySelector?.(focusSelector);
      if (!textarea) return false;
      if (!String(textarea.value || "").trim()) {
        textarea.value = "暂时独立：";
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        const form = textarea.closest("[data-note-distillation-form]");
      }
      textarea.focus?.();
      return true;
    };
    host.jumpToInspectorSection(sectionSelector, { focus: true, focusSelector });
    if (!applyDraft()) window.setTimeout(applyDraft, 40);
    host.onStatus("已定位到边界说明：写明为什么暂时不建立关系。", "ok");
  }

  async handleForm(form) {
    const host = this.host;
    const note = host.activeNote();
    const noteId = String(note?.id || "").trim();
    if (!noteId) return;
    const noteType = host.resolvedNoteType(note);
    if (noteType !== "permanent" && noteType !== "original") {
      host.onStatus("观点提纯面板只支持永久笔记", "warn");
      return;
    }
    const values = permanentNoteDistillationFormValues(form);
    if (!values.thesis) {
      host.onStatus("先用一句自己的话写下当前观点", "warn");
      form.querySelector?.('[name="thesis"]')?.focus?.();
      return;
    }
    if (this.syncChangeReasonVisibility(form, values) && !values.thesisChangeReason) {
      host.onStatus("观点变了，请用一句话说明这次为什么改变", "warn");
      form.querySelector?.('[name="thesisChangeReason"]')?.focus?.();
      return;
    }
    const savedEditor = await host.autoSaveActiveNote("distillation");
    if (savedEditor === false) return;
    if (!host.isActiveNoteId(noteId)) return;
    const saved = await host.onStateChange("save-note-distillation", {
      noteId,
      thesis: values.thesis,
      threeLineSummary: values.threeLineSummary,
      startingQuestion: values.startingQuestion,
      thesisChangeReason: values.thesisChangeReason,
      viewpointChangeSourceNoteIds: values.viewpointChangeSourceNoteIds,
      commitViewpointChange: true,
      boundaryOrCounterpoint: values.boundaryOrCounterpoint,
      distillationStatus: "confirmed",
      authorship: values.distillationStatus === "confirmed" ? { user_confirmed: true, ai_assisted: false } : undefined
    });
    if (!saved) return;
    if (!host.isActiveNoteId(noteId)) return;
    applyPermanentNoteDistillationToNote(note, values, {
      confirmAuthorship: values.distillationStatus === "confirmed"
    });
    this.setPrefill(noteId, { boundaryDraft: "", viewpointDraft: null });
    host.renderThinkingStatus();
    host.permanentNoteWorkspace?.().reset(noteId);
    host.renderRelated();
  }

  async confirm() {
    const host = this.host;
    const note = host.activeNote();
    const noteId = String(note?.id || "").trim();
    if (!noteId) return;
    const noteType = host.resolvedNoteType(note);
    if (noteType !== "permanent" && noteType !== "original") {
      host.onStatus("观点提纯面板只支持永久笔记", "warn");
      return;
    }
    const form = host.els.result?.querySelector?.("[data-note-distillation-form]");
    if (form) {
      const values = permanentNoteDistillationFormValues(form);
      if (!values.thesis) {
        host.onStatus("先用一句自己的话写下当前观点", "warn");
        return;
      }
      if (this.syncChangeReasonVisibility(form, values) && !values.thesisChangeReason) {
        host.onStatus("观点变了，请用一句话说明这次为什么改变", "warn");
        form.querySelector?.('[name="thesisChangeReason"]')?.focus?.();
        return;
      }
      const savedEditor = await host.autoSaveActiveNote("distillation-confirm");
      if (savedEditor === false) return;
      if (!host.isActiveNoteId(noteId)) return;
      const saved = await host.onStateChange("save-note-distillation", {
        noteId,
        thesis: values.thesis,
        threeLineSummary: values.threeLineSummary,
        startingQuestion: values.startingQuestion,
        thesisChangeReason: values.thesisChangeReason,
        viewpointChangeSourceNoteIds: values.viewpointChangeSourceNoteIds,
        commitViewpointChange: true,
        boundaryOrCounterpoint: values.boundaryOrCounterpoint,
        distillationStatus: "draft"
      });
      if (!saved) return;
      if (!host.isActiveNoteId(noteId)) return;
      applyPermanentNoteDistillationToNote(note, {
        ...values,
        distillationStatus: ""
      });
      this.setPrefill(noteId, { boundaryDraft: "", viewpointDraft: null });
    }
    const confirmed = await host.onStateChange("confirm-note-distillation", { noteId });
    if (!confirmed) return;
    if (!host.isActiveNoteId(noteId)) return;
    if (confirmed && typeof confirmed === "object" && typeof confirmed.body === "string") {
      host.fillEditorFromTab?.();
    }
    note.distillationStatus = "confirmed";
    note.authorship = { ...(note.authorship || {}), user_confirmed: true };
    host.renderThinkingStatus();
    host.setInspectorVisible?.(false);
    host.revealActiveTabBodyAtStart?.();
    host.renderRelated();
  }
}
