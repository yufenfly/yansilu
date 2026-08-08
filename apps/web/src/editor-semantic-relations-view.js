import { escapeHtml } from "./editor-render-utils.js";
import { highlightMatch, relationCreateDefaultTypeForNote, sortRelationTargetCandidatesForNote } from "./editor-link-picker.js";
import { relationRowsByEndpoint } from "./editor-related-notes-panel.js";
import { typeFromFolder } from "./prototype-store.js";
import {
  explicitPermanentNoteRelations,
  permanentNoteSidebarExplicitRelationCount
} from "./permanent-note-sidebar-model.js";
import {
  isHiddenRelation,
  isMarkdownWikilinkRelation,
  noteTypeText,
  parseInlineRelationAnnotations,
  relationStatusLabel,
  relationTone,
  RELATION_CREATE_TYPES,
  RELATION_EDIT_STATUSES,
  relationTypeGuidance,
  relationTypeLabel
} from "./editor-relation-helpers.js";

export class EditorSemanticRelationsView {
  constructor(host) {
    this.host = host;
  }

  relationEndpoint(link, direction) {
    const host = this.host;
    const endpointId = direction === "outgoing" ? link?.toNoteId : link?.fromNoteId;
    const apiNote = direction === "outgoing" ? link?.target : link?.source;
    const cached = host.state.notes.find((item) => item.id === endpointId) || null;
    return {
      id: endpointId || apiNote?.id || "",
      title: apiNote?.title || cached?.title || endpointId || "未命名笔记",
      noteType: apiNote?.noteType || cached?.noteType || "original",
      folderId: cached?.folderId || "",
      status: apiNote?.status || cached?.status || ""
    };
  }

  relationAiButtonLabel(noteId = "") {
    const analysis = this.host?.noteAiAnalysisByNoteId?.get?.(noteId) || null;
    const count = Array.isArray(analysis?.analysis?.relationCandidates) ? analysis.analysis.relationCandidates.length : 0;
    return count > 0 ? `AI推荐 ${count}` : "AI推荐";
  }

  renderRelationFollowupSuggestion(noteId = "") {
    const suggestion = this.host.relationFollowupSuggestion;
    if (!suggestion || String(suggestion.noteId || "") !== String(noteId || "")) return "";
    return `
      <div class="relation-followup-suggestion" data-relation-followup-suggestion data-relation-id="${escapeHtml(suggestion.relationId)}">
        <div class="relation-followup-suggestion-text">${escapeHtml(suggestion.text || "这条关系还可以补理由。")}</div>
        <div class="relation-followup-suggestion-actions">
          <button class="mini-btn primary" type="button" data-relation-action="open-followup-reason" data-relation-id="${escapeHtml(suggestion.relationId)}">${escapeHtml(suggestion.actionLabel || "补理由")}</button>
          <button class="mini-btn is-ghost" type="button" data-relation-action="dismiss-followup">${escapeHtml(suggestion.laterLabel || "稍后")}</button>
        </div>
      </div>
    `;
  }

  renderSemanticRelationItem(link, direction) {
    const endpoint = this.relationEndpoint(link, direction);
    const type = String(link?.relationType || "").trim().toLowerCase();

    return `
      <article class="related-item semantic-relation-item" data-relation-tone="${escapeHtml(relationTone(link))}" data-relation-id="${escapeHtml(link?.id || "")}">
        <button class="semantic-relation-open" type="button" data-preview-note="${escapeHtml(endpoint.id)}">
          <span class="related-item-title">${escapeHtml(endpoint.title)}</span>
        </button>
        <div class="related-item-badges">
          <span class="related-item-badge">外部关联</span>
          <span class="related-item-badge">${escapeHtml(relationTypeLabel(type))}</span>
        </div>
        <div class="semantic-relation-card-actions">
          <button class="mini-btn is-ghost" type="button" data-relation-action="open-edit" data-relation-id="${escapeHtml(link?.id || "")}">编辑</button>
          <button class="mini-btn is-ghost" type="button" data-relation-action="delete" data-relation-id="${escapeHtml(link?.id || "")}">取消外部关联</button>
        </div>
      </article>
    `;
  }

  renderSemanticRelationsLoadingSection(noteId) {
    return `
      <section class="inspector-section semantic-relations-section" data-note-relations-section data-note-id="${escapeHtml(noteId)}">
        <div class="inspector-section-head">
          <div class="inspector-section-title">关系网络</div>
          <div class="semantic-relation-head-actions">
            <button class="mini-btn primary" type="button" data-permanent-relation-action="open" data-permanent-relation-mode="ai" data-relation-entry-note="${escapeHtml(noteId)}">${escapeHtml(this.relationAiButtonLabel(noteId))}</button>
            <button class="mini-btn semantic-relation-add-btn" type="button" data-relation-action="open-create">添加外部关联</button>
            <div class="inspector-count">读取中</div>
          </div>
        </div>
        <div class="related-empty">正在读取关联。</div>
      </section>
    `;
  }

  renderInlineDraftRelationSection(note, tab) {
    const host = this.host;
    const drafts = parseInlineRelationAnnotations(tab?.body || "");
    if (!drafts.length) return "";
    const scoped = host.scopedLinkCandidates();
    const items = drafts
      .map((draft, index) => {
        const resolved = host.resolveLinkToken(draft.token, scoped);
        const endpoint = resolved?.note || { id: draft.token, title: draft.token, noteType: "original", folderId: "" };
        return `
          <article class="related-item semantic-relation-item" data-relation-tone="${escapeHtml(relationTone({ relationType: draft.relationType }))}" data-inline-relation-index="${index}">
            <button class="semantic-relation-open" type="button" data-preview-note="${escapeHtml(endpoint.id || "")}">
              <span class="related-item-title">${escapeHtml(endpoint.title || draft.token)}</span>
              ${draft.rationale ? `<span class="related-item-preview">${escapeHtml(draft.rationale)}</span>` : ""}
            </button>
            <div class="related-item-badges">
              <span class="related-item-badge">正文链接</span>
            </div>
            <div class="semantic-relation-card-actions">
              <button class="mini-btn is-ghost" type="button" data-preview-note="${escapeHtml(endpoint.id || "")}">打开</button>
            </div>
          </article>
        `;
      })
      .join("");
    return `
      <section class="inspector-section semantic-relations-section">
        <div class="inspector-section-head">
          <div class="inspector-section-title">正文链接</div>
          <div class="inspector-count">${drafts.length}</div>
        </div>
        <div class="inspector-list">${items}</div>
      </section>
    `;
  }

  relationCreateDefaultType(note = this.host.activeNote()) {
    return relationCreateDefaultTypeForNote(note);
  }

  sortRelationTargetCandidates(candidates = [], note = this.host.activeNote()) {
    return sortRelationTargetCandidatesForNote(candidates, note);
  }

  renderRelationTargetOptions(candidates = [], selectedId = "") {
    const host = this.host;
    const selected = String(selectedId || "").trim();
    const selectedNote = selected ? host.state.notes.find((item) => item?.id === selected) || null : null;
    const sorted = this.sortRelationTargetCandidates(candidates);
    const items = selected && !sorted.some((candidate) => candidate?.id === selected)
      ? [...(selectedNote ? [selectedNote] : []), ...sorted]
      : sorted;
    return items
      .filter(Boolean)
      .map((note) => {
        const meta = `${noteTypeText(note.noteType || typeFromFolder(host.state, note.folderId))} · ${host.folderLabel(note.folderId)}`;
        return `<option value="${escapeHtml(note.id)}"${note.id === selected ? " selected" : ""}>${escapeHtml(note.title || note.id)} · ${escapeHtml(meta)}</option>`;
      })
      .join("");
  }

  renderRelationTargetChoices(candidates = [], selectedId = "", query = "", activeId = "") {
    const host = this.host;
    const selected = String(selectedId || "").trim();
    const active = String(activeId || "").trim();
    const selectedNote = selected ? host.state.notes.find((item) => item?.id === selected) || null : null;
    const q = String(query || "").trim().toLowerCase();
    const sorted = this.sortRelationTargetCandidates(candidates);
    const filtered = q ? sorted.filter((candidate) => String(candidate?.title || "").toLowerCase().includes(q)) : sorted;
    const items = selected && !filtered.some((candidate) => candidate?.id === selected)
      ? [...(selectedNote ? [selectedNote] : []), ...filtered]
      : filtered;
    if (!items.length) return `<div class="picker-empty">没有匹配笔记</div>`;
    return items
      .slice(0, 10)
      .map((candidate) => {
        const isActive = candidate?.id === active;
        const resolvedType = noteTypeText(candidate?.noteType || typeFromFolder(host.state, candidate?.folderId || ""));
        const location = host.folderLabel(candidate?.folderId || "");
        return `
          <button
            class="link-picker-item ${isActive ? "active" : ""}"
            type="button"
            data-relation-target-choice
            data-note-id="${escapeHtml(candidate?.id || "")}"
            data-note-title="${escapeHtml(candidate?.title || candidate?.id || "")}"
            aria-selected="${isActive ? "true" : "false"}"
            title="${escapeHtml(`${candidate?.title || candidate?.id || ""} · ${resolvedType} · ${location}`)}"
          >
            <span class="picker-headline">
              <strong>${highlightMatch(candidate?.title || candidate?.id || "", q)}</strong>
            </span>
          </button>
        `;
      })
      .join("");
  }

  renderCreateRelationTypeOptions(selectedType = "") {
    const selected = String(selectedType || "supports").trim().toLowerCase() || "supports";
    const common = [
      ["supports", "支持它"],
      ["contradicts", "不同意它"],
      ["associated_with", "让我想到它"]
    ];
    const commonIds = new Set(common.map(([type]) => type));
    const commonOptions = common.map(([type, label]) =>
      `<option value="${escapeHtml(type)}"${type === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
    ).join("");
    const moreOptions = RELATION_CREATE_TYPES
      .filter((type) => !commonIds.has(type))
      .map((type) => `<option value="${escapeHtml(type)}"${type === selected ? " selected" : ""}>${escapeHtml(relationTypeLabel(type))}</option>`)
      .join("");
    return `<optgroup label="常用">${commonOptions}</optgroup><optgroup label="更多关系">${moreOptions}</optgroup>`;
  }

  renderCreateRelationFormSection(noteId, prefill = {}) {
    const host = this.host;
    const activeNote = host.activeNote();
    const candidates = host.scopedLinkCandidates();
    const defaultType = this.relationCreateDefaultType(activeNote);
    const selectedTargetId = String(prefill?.targetNoteId || "").trim();
    const selectedTarget = selectedTargetId ? host.state.notes.find((item) => item?.id === selectedTargetId) || null : null;
    const selectedRelationType = String(prefill?.relationType || "").trim().toLowerCase() || defaultType;
    const targetQuery = String(prefill?.targetQuery || selectedTarget?.title || "").trim();
    const rationaleDraft = String(prefill?.rationaleDraft || "").trim();
    const insightQuestionDraft = String(prefill?.insightQuestionDraft || "").trim();
    const typeOptions = this.renderCreateRelationTypeOptions(selectedRelationType);
    const targetChoices = this.renderRelationTargetChoices(candidates, selectedTargetId, targetQuery, selectedTargetId);

    return `
      <section class="inspector-section semantic-relations-section" data-note-relations-section data-note-id="${escapeHtml(noteId)}">
        <div class="inspector-section-head">
          <div class="inspector-section-title">添加外部关联</div>
          <button class="mini-btn is-ghost" type="button" data-relation-action="cancel-create">返回列表</button>
        </div>
        <form class="semantic-relation-form" data-create-relation-form data-note-id="${escapeHtml(noteId)}">
          <label>
            <span>目标笔记</span>
            <input id="targetQuery" class="semantic-relation-target-search" name="targetQuery" data-relation-target-search data-autofocus-relation-target autocomplete="off" placeholder="搜索笔记" value="${escapeHtml(targetQuery)}" autofocus />
            <input type="hidden" name="toNoteId" data-relation-target-id value="${escapeHtml(selectedTargetId)}" />
            <div class="link-picker-list semantic-relation-target-list" data-relation-target-list hidden>${targetChoices}</div>
          </label>
          <label>
            <span>它和这条笔记是什么关系？</span>
            <select name="relationType" required>${typeOptions}</select>
          </label>
          <label>
            <span>为什么这么想？</span>
            <textarea name="rationale" required placeholder="例如：这条笔记补充了前一条判断在什么条件下成立。">${escapeHtml(rationaleDraft)}</textarea>
          </label>
          <input type="hidden" name="insightQuestion" value="${escapeHtml(insightQuestionDraft)}">
          <div class="semantic-relation-form-error" data-relation-form-error></div>
          <div class="semantic-relation-actions">
            <button class="mini-btn primary" type="submit" ${selectedTargetId ? "" : "disabled"}>保存外部关联</button>
          </div>
        </form>
      </section>
    `;
  }
  renderRelationTypeOptions(selectedType = "") {
    const selected = String(selectedType || "").trim().toLowerCase();
    return RELATION_CREATE_TYPES.map(
      (type) => `<option value="${escapeHtml(type)}"${type === selected ? " selected" : ""}>${escapeHtml(relationTypeLabel(type))}</option>`
    ).join("");
  }

  renderRelationStatusOptions(selectedStatus = "confirmed") {
    const selected = String(selectedStatus || "confirmed").trim().toLowerCase();
    return RELATION_EDIT_STATUSES.map(
      (status) => `<option value="${escapeHtml(status)}"${status === selected ? " selected" : ""}>${escapeHtml(relationStatusLabel(status))}</option>`
    ).join("");
  }

  renderEditRelationFormSection(noteId, link, context = {}) {
    const endpoint = this.relationEndpoint(link, link?.fromNoteId === noteId ? "outgoing" : "incoming");
    const defaultGuidance = relationTypeGuidance(link?.relationType || "supports");
    const rationaleDraft = String(link?.rationale || "").trim() || String(context?.rationaleDraft || "").trim();
    const insightQuestionDraft = String(link?.insightQuestion || "").trim() || String(context?.insightQuestionDraft || "").trim();
    const templateVariants = context?.draftVariants || [];
    const selectedTemplateVariant = context?.selectedTemplateVariant || "";
    const rememberedTemplateVariantLabel = String(context?.rememberedTemplateVariantLabel || "").trim();
    return `
      <section class="inspector-section semantic-relations-section" data-note-relations-section data-note-id="${escapeHtml(noteId)}">
        <div class="inspector-section-head">
          <div>
            <div class="inspector-section-title">编辑外部关联</div>
            <div class="inspector-section-note">${escapeHtml(endpoint.title || "未命名笔记")}</div>
          </div>
          <button class="mini-btn is-ghost" type="button" data-relation-action="cancel-edit">取消</button>
        </div>
        <form class="semantic-relation-form" data-edit-relation-form data-note-id="${escapeHtml(noteId)}" data-relation-id="${escapeHtml(link?.id || "")}">
          <label>
            <span>关系类型</span>
            <select name="relationType" required>${this.renderRelationTypeOptions(link?.relationType || "supports")}</select>
          </label>
          <label>
            <span>关系状态</span>
            <select name="status" required>${this.renderRelationStatusOptions(link?.status || "confirmed")}</select>
          </label>
          <label>
            <span>为什么要关联</span>
            <textarea name="rationale" required aria-describedby="relation-rationale-guidance-edit" placeholder="${escapeHtml(defaultGuidance.rationalePlaceholder)}">${escapeHtml(rationaleDraft)}</textarea>
          </label>
          <input type="hidden" name="insightQuestion" value="${escapeHtml(insightQuestionDraft)}">
          <div class="semantic-relation-form-error" data-relation-form-error></div>
          <div class="semantic-relation-actions">
            <button class="mini-btn primary" type="submit">保存修改</button>
          </div>
        </form>
      </section>
    `;
  }

  renderRelationTabButton(key, label, count, activeTab) {
    const isActive = key === activeTab;
    return `
      <button
        class="semantic-relation-tab ${isActive ? "is-active" : ""}"
        type="button"
        role="tab"
        aria-selected="${isActive ? "true" : "false"}"
        data-relation-action="switch-tab"
        data-relation-tab="${escapeHtml(key)}"
      >
        <span>${escapeHtml(label)}</span>
        <small>${escapeHtml(String(count || 0))}</small>
      </button>
    `;
  }

  renderRelationSummaryRow(row, { kind = "external" } = {}) {
    const primary = row.links[0] || {};
    const link = primary.link || {};
    const endpoint = row.endpoint || {};
    const actions = kind === "external"
      ? `
        <button class="mini-btn is-ghost" type="button" data-relation-action="open-edit" data-relation-id="${escapeHtml(link?.id || "")}">编辑</button>
        <button class="mini-btn is-ghost" type="button" data-relation-action="delete" data-relation-id="${escapeHtml(link?.id || "")}">取消外部关联</button>
      `
      : `<button class="mini-btn is-ghost" type="button" data-preview-note="${escapeHtml(endpoint.id || "")}">打开</button>`;

    return `
      <article class="related-item semantic-relation-item semantic-relation-summary-row" data-relation-tone="${escapeHtml(relationTone(link))}">
        <button class="semantic-relation-open" type="button" data-preview-note="${escapeHtml(endpoint.id || "")}">
          <span class="related-item-title">${escapeHtml(endpoint.title || endpoint.id || "未命名笔记")}</span>
        </button>
        <div class="semantic-relation-card-actions">
          ${actions}
        </div>
      </article>
    `;
  }

  renderSemanticRelationsSection(relations, noteId) {
    const outgoing = Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks.filter((link) => !isHiddenRelation(link)) : [];
    const backlinks = Array.isArray(relations?.backlinks) ? relations.backlinks.filter((link) => !isHiddenRelation(link)) : [];
    const { outgoing: explicitOutgoing, backlinks: explicitBacklinks } = explicitPermanentNoteRelations(relations);
    const bodyLinks = outgoing.filter((link) => isMarkdownWikilinkRelation(link));
    const externalRows = relationRowsByEndpoint([
      ...explicitOutgoing.map((link) => ({ link, direction: "outgoing" })),
      ...explicitBacklinks.map((link) => ({ link, direction: "incoming" }))
    ], this.host.state.notes || []);
    const bodyRows = relationRowsByEndpoint(
      bodyLinks.map((link) => ({ link, direction: "outgoing" })),
      this.host.state.notes || []
    );
    const activeTab = externalRows.length ? "external" : "body";
    const bodyPanel = bodyRows.length
      ? `<div class="inspector-list">${bodyRows.map((row) => this.renderRelationSummaryRow(row, { kind: "body" })).join("")}</div>`
      : `<div class="related-empty">正文里还没有关联到其他笔记。</div>`;
    const externalPanel = externalRows.length
      ? `<div class="inspector-list">${externalRows.map((row) => this.renderRelationSummaryRow(row, { kind: "external" })).join("")}</div>`
      : `<div class="related-empty">还没有外部关联。</div>`;
    return `
      <section class="inspector-section semantic-relations-section" data-note-relations-section data-note-id="${escapeHtml(noteId)}">
        <div class="inspector-section-head">
          <div class="inspector-section-title">关联</div>
          <div class="semantic-relation-head-actions">
            <button class="mini-btn primary" type="button" data-permanent-relation-action="open" data-permanent-relation-mode="ai" data-relation-entry-note="${escapeHtml(noteId)}">${escapeHtml(this.relationAiButtonLabel(noteId))}</button>
            <button class="mini-btn semantic-relation-add-btn" type="button" data-relation-action="open-create">添加外部关联</button>
          </div>
        </div>
        <div class="semantic-relation-tabs" role="tablist" aria-label="关联类型">
          ${this.renderRelationTabButton("external", "外部关联", externalRows.length, activeTab)}
          ${this.renderRelationTabButton("body", "正文链接", bodyRows.length, activeTab)}
        </div>
        <div class="semantic-relation-tab-panel" data-relation-tab-panel="external"${activeTab === "external" ? "" : " hidden"}>
          ${externalPanel}
        </div>
        <div class="semantic-relation-tab-panel" data-relation-tab-panel="body"${activeTab === "body" ? "" : " hidden"}>
          ${bodyPanel}
        </div>
      </section>
    `;
  }
  renderSemanticRelationsErrorSection(noteId, error) {
    return `
      <section class="inspector-section semantic-relations-section" data-note-relations-section data-note-id="${escapeHtml(noteId)}">
        <div class="inspector-section-head">
          <div class="inspector-section-title">关系网络</div>
          <div class="inspector-count">不可用</div>
        </div>
        <div class="related-empty bad">关系读取失败：${escapeHtml(String(error?.message || error || "未知错误"))}</div>
      </section>
    `;
  }

  renderCurrentRelationSection(noteId, { relations = this.host.currentSemanticRelations, relationState = this.host.semanticRelationsState, error = null } = {}) {
    const panelState = this.host.currentRelationPanelState(noteId);
    if (panelState.mode === "create") {
      return this.renderCreateRelationFormSection(noteId, {
        targetNoteId: panelState.targetNoteId,
        relationType: panelState.relationType,
        entryHint: panelState.entryHint,
        rationaleDraft: panelState.rationaleDraft,
        insightQuestionDraft: panelState.insightQuestionDraft,
        draftVariants: panelState.draftVariants,
        selectedTemplateVariant: panelState.selectedTemplateVariant,
        rememberedTemplateVariantLabel: panelState.rememberedTemplateVariantLabel
      });
    }
    if (panelState.mode === "edit") {
      const link =
        relationState === "loaded" && relations
          ? [...(Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : []), ...(Array.isArray(relations?.backlinks) ? relations.backlinks : [])].find(
              (item) => item?.id === panelState.relationId
            ) || null
          : this.host.findSemanticRelation(panelState.relationId);
      if (link) {
        return this.renderEditRelationFormSection(noteId, link, {
          entryHint: panelState.entryHint,
          rationaleDraft: panelState.rationaleDraft,
          insightQuestionDraft: panelState.insightQuestionDraft,
          draftVariants: panelState.draftVariants,
          selectedTemplateVariant: panelState.selectedTemplateVariant,
          rememberedTemplateVariantLabel: panelState.rememberedTemplateVariantLabel
        });
      }
    }
    if (relationState === "error") return this.renderSemanticRelationsErrorSection(noteId, error);
    if (relationState !== "loaded" || !relations) return this.renderSemanticRelationsLoadingSection(noteId);
    return this.renderSemanticRelationsSection(relations, noteId);
  }

  currentExplicitRelationCount() {
    return permanentNoteSidebarExplicitRelationCount({
      relationState: this.host.semanticRelationsState,
      relations: this.host.currentSemanticRelations
    });
  }
}
