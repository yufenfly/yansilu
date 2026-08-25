import { escapeHtml } from "./editor-render-utils.js";
import {
  collectDistillationWarnings
} from "./editor-template-workspace.js";
import {
  normalizeDistillationTemplateVariants,
  renderDistillationTemplateVariantSwitcher
} from "./editor-relation-helpers.js";

export function renderPermanentNoteDistillationSection(note, options = {}) {
  const noteType = String(options.noteType || "").trim();
  if (!note?.id || (noteType !== "permanent" && noteType !== "original")) return "";
  const distillationPrefill = options.distillationPrefill || {};
  const viewpointDraft = distillationPrefill.viewpointDraft && typeof distillationPrefill.viewpointDraft === "object"
    ? distillationPrefill.viewpointDraft
    : null;
  const thesis = String(viewpointDraft?.thesis ?? note.thesis ?? "").trim();
  const startingQuestion = String(viewpointDraft?.startingQuestion ?? note.startingQuestion ?? "").trim();
  const summary = Array.isArray(viewpointDraft?.threeLineSummary)
    ? viewpointDraft.threeLineSummary
    : Array.isArray(note.threeLineSummary)
      ? note.threeLineSummary
      : [];
  const summaryLines = [0, 1, 2].map((idx) => String(summary[idx] || "").trim());
  const distillationVariants = normalizeDistillationTemplateVariants(
    distillationPrefill.draftVariants || [],
    distillationPrefill.selectedTemplateVariant || ""
  );
  const rememberedTemplateVariantLabel = String(distillationPrefill.rememberedTemplateVariantLabel || "").trim();
  const boundaryOrCounterpoint = viewpointDraft
    ? String(viewpointDraft.boundaryOrCounterpoint || "").trim()
    : String(note.boundaryOrCounterpoint || "").trim() || String(distillationPrefill.boundaryDraft || "").trim();
  const viewpointBaseline = String(viewpointDraft?.originalThesis || options.viewpointBaseline || thesis).trim();
  const viewpointChanged = Boolean(viewpointBaseline && thesis && viewpointBaseline !== thesis);
  const draftSourceIds = new Set(
    (Array.isArray(viewpointDraft?.viewpointChangeSourceNoteIds) ? viewpointDraft.viewpointChangeSourceNoteIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const viewpointSourceCandidates = (Array.isArray(options.viewpointSourceCandidates) ? options.viewpointSourceCandidates : [])
    .map((item) => ({ ...item, selected: viewpointDraft ? draftSourceIds.has(String(item.id || "").trim()) : item.selected }));
  const thesisChangeReason = String(viewpointDraft?.thesisChangeReason || "").trim();

  return `
      <section class="inspector-section semantic-relations-section" data-note-distillation-section data-note-id="${escapeHtml(note.id)}">
        <form class="semantic-relation-form" data-note-distillation-form>
          ${options.relationNetworkPromptHtml || ""}
          <label>
            你现在认为是什么？
            <textarea name="thesis" rows="3" placeholder="用一句自己的话，写下你愿意保留的判断。" required>${escapeHtml(thesis)}</textarea>
          </label>
          <input type="hidden" name="originalThesis" value="${escapeHtml(viewpointBaseline)}" />
          <input type="hidden" name="distillationStatus" value="confirmed" />
          <label>
            最初想解决什么？ <span class="distillation-field-hint">可选</span>
            <textarea name="startingQuestion" rows="2" placeholder="例如：为什么记了很多笔记，写作时还是用不上？">${escapeHtml(startingQuestion)}</textarea>
          </label>
          <div class="viewpoint-change-reason" data-viewpoint-change-reason ${viewpointChanged ? "" : "hidden"}>
            <label>
              这次为什么改变？
              <textarea name="thesisChangeReason" rows="2" placeholder="是哪条证据、反例或新理解改变了你的判断？" ${viewpointChanged ? "required" : ""}>${escapeHtml(thesisChangeReason)}</textarea>
            </label>
            ${viewpointSourceCandidates.length ? `
              <fieldset class="viewpoint-change-sources">
                <legend>哪些笔记影响了这次改变？ <span class="distillation-field-hint">可选</span></legend>
                <div class="viewpoint-change-source-list">
                  ${viewpointSourceCandidates.map((item) => `
                    <label>
                      <input type="checkbox" name="viewpointChangeSourceNoteIds" value="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} />
                      <span>${escapeHtml(item.title)}</span>
                    </label>
                  `).join("")}
                </div>
              </fieldset>
            ` : ""}
          </div>
          <details class="viewpoint-optional-details">
            <summary>补充说明和边界（可选）</summary>
            <div class="viewpoint-optional-fields">
              <label>
                三句话补充
                <textarea name="summary1" rows="2" placeholder="这条观点在说什么？">${escapeHtml(summaryLines[0])}</textarea>
              </label>
              <label>
                <span class="sr-only">第二句补充</span>
                <textarea name="summary2" rows="2" placeholder="为什么它成立或重要？">${escapeHtml(summaryLines[1])}</textarea>
              </label>
              <label>
                <span class="sr-only">第三句补充</span>
                <textarea name="summary3" rows="2" placeholder="它可以进入哪个主题或写作方向？">${escapeHtml(summaryLines[2])}</textarea>
              </label>
              ${renderDistillationTemplateVariantSwitcher(
                distillationVariants.items,
                distillationVariants.selectedKey,
                rememberedTemplateVariantLabel
              )}
              <label>
                还要注意什么？
                <textarea name="boundaryOrCounterpoint" rows="3" placeholder="这条判断在哪些情况下不成立？">${escapeHtml(boundaryOrCounterpoint)}</textarea>
              </label>
              ${options.aiWorkspaceHtml ? `<div class="note-distillation-ai-assist">${options.aiWorkspaceHtml}</div>` : ""}
            </div>
          </details>
          <div class="semantic-relation-actions">
            <button class="mini-btn primary" type="submit">保存当前观点</button>
          </div>
        </form>
      </section>
    `;
}

export function renderPermanentNoteDistillationQuality(draft = {}) {
  const warnings = collectDistillationWarnings(draft);
  return `
      <div class="semantic-relation-group-head"><strong>质量提示</strong><span>${escapeHtml(warnings.length || "OK")}</span></div>
      <div class="related-empty">${escapeHtml(warnings.length ? warnings.join("；") : "OK")}</div>
    `;
}
