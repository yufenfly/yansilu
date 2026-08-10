import { escapeHtml } from "./editor-render-utils.js";
import {
  permanentNoteStatusSummaryState,
  permanentRelationAssistState
} from "./permanent-note-sidebar-architecture.js";

export function renderPermanentNoteStatusSummary({
  note = {},
  relationState = "idle",
  relationCount = 0
} = {}) {
  const summaryState = permanentNoteStatusSummaryState({
    note,
    relationState,
    relationCount
  });
  const thesis = summaryState.viewpoint.thesis;
  const confirmed = summaryState.viewpoint.confirmed;
  const viewpointLabel = !thesis ? "观点：待提纯" : confirmed ? "观点：已确认" : "观点：待确认";
  const relationSummaryLabel =
    relationState === "error"
      ? "关联：读取失败"
      : relationState === "loading"
        ? "关联：读取中"
        : relationCount > 0
          ? `关联：${relationCount} 条`
          : "关联：待建立";
  return `
    <div class="inspector-summary inspector-summary-compact" data-inspector-status-summary>
      <span class="inspector-chip ${confirmed ? "is-success" : "is-warning"}">${escapeHtml(viewpointLabel)}</span>
      <span class="inspector-chip ${relationCount > 0 ? "is-success" : "is-warning"}">${escapeHtml(relationSummaryLabel)}</span>
    </div>
  `;
}

export function permanentNoteRelationAssistViewState({
  explicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0,
  analysis = null
} = {}) {
  const assistState = permanentRelationAssistState({
    explicitRelationCount,
    wikilinkCount,
    tagRelatedCount,
    analysis
  });
  const relationText =
    explicitRelationCount === null
      ? "正在读取关系。"
      : explicitRelationCount > 0
        ? `已有 ${explicitRelationCount} 条关系。`
        : wikilinkCount || tagRelatedCount
          ? "有线索，选一条保存为关联。"
          : "找一条真正相关的笔记。";
  return {
    ...assistState,
    relationText,
    primaryLabel: assistState.relationCandidates > 0 ? `AI推荐 ${assistState.relationCandidates}` : "AI推荐"
  };
}

export function renderPermanentNoteRelationAssistSection({
  note = {},
  explicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0,
  analysis = null
} = {}) {
  if (!note?.id) return "";
  const assist = permanentNoteRelationAssistViewState({
    explicitRelationCount,
    wikilinkCount,
    tagRelatedCount,
    analysis
  });
  return `<div class="relation-assist-panel" data-note-relation-assist-section data-note-id="${escapeHtml(note.id)}" data-relation-ai-count="${escapeHtml(String(assist.relationCandidates || 0))}" hidden></div>`;
}
