function cleanText(value) {
  return String(value || "").trim();
}

function stringItems(value) {
  return (Array.isArray(value) ? value : []).map((item) => cleanText(item)).filter(Boolean);
}

function status(status, label, nextAction, targetField, severity = "next") {
  return { status, label, nextAction, targetField, severity };
}

function hasParaphrase(body = "") {
  const text = String(body || "");
  const paraphraseMatch = text.match(/(?:^|\n)#{1,6}\s*(?:转述|我的转述|Paraphrase)\s*\n([\s\S]*?)(?=\n#{1,6}\s|\s*$)/i);
  return Boolean(cleanText(paraphraseMatch?.[1]));
}

export function deriveNoteThinkingStatus(note = {}) {
  const noteType = cleanText(note.noteType || note.note_type).toLowerCase();
  if (noteType === "literature") {
    if (!hasParaphrase(note.body || note.markdown || "")) {
      return status("needs_paraphrase", "待转述", "用自己的话重说一遍", "body");
    }
    return status("paraphrased", "已转述", "转成自己的看法", "body", "ready");
  }

  if (noteType !== "permanent") {
    return status("captured", "已记录", "整理成可复用的想法", "body", "ready");
  }

  const thesis = cleanText(note.thesis);
  const distillationStatus = cleanText(note.distillationStatus || note.distillation_status).toLowerCase();
  const explicitRelationCount = Number(note.explicitRelationCount ?? note.explicit_relation_count ?? 0) || 0;

  if (!thesis) {
    return status("needs_thesis", "待写论点", "写一句话看法", "thesis");
  }
  if (distillationStatus !== "confirmed") {
    return status("needs_confirmation", "待确认", "确认这是你的当前观点", "thesis");
  }
  if (explicitRelationCount < 1) {
    return status("needs_relation", "待建立关系", "关联一条相关笔记", "relations");
  }
  return status("ready_for_index", "待加入主题", "加入索引卡", "related_index_ids", "ready");
}

export function deriveIndexCardThinkingStatus(indexCard = {}) {
  const centralQuestion = cleanText(indexCard.centralQuestion || indexCard.central_question);
  const items = Array.isArray(indexCard.items) ? indexCard.items : [];
  const noteIds = stringItems(indexCard.item_note_ids || indexCard.noteIds || indexCard.note_ids);
  const noteCount = Number(indexCard.note_count ?? items.length ?? noteIds.length) || 0;
  const thesis = cleanText(indexCard.thesis);
  const threeLineSummary = stringItems(indexCard.threeLineSummary || indexCard.three_line_summary);

  if (noteCount < 2) {
    return status("needs_notes", "待补笔记", "加入至少两条相关笔记", "items");
  }
  if (!centralQuestion) {
    return status("needs_central_question", "待写中心问题", "写出这个主题正在追问什么", "central_question");
  }
  if (!thesis) {
    return status("needs_theme_thesis", "待写主题判断", "压成一句主题判断", "thesis");
  }
  if (threeLineSummary.length !== 3) {
    return status("needs_theme_summary", "待压缩主题", "补三句话主题说明", "three_line_summary");
  }
  return status("ready_for_writing", "可进入写作", "进入写作准备", "writing_project", "ready");
}

export function deriveWritingProjectThinkingStatus(project = {}) {
  const basketIds = stringItems(project.basketNoteIds || project.basket_note_ids);
  const basketCount = Number(project.basket_count ?? basketIds.length) || 0;
  const scaffoldId = cleanText(project.scaffold_id || project.scaffoldId);
  const intent = cleanText(project.intent);

  if (!basketCount) {
    return status("needs_basket", "待选材料", "选择要进入写作的永久笔记", "basket_note_ids");
  }
  if (!intent) {
    return status("needs_intent", "待写意图", "写清这次想让读者明白什么", "intent");
  }
  if (!scaffoldId) {
    return status("needs_scaffold", "待生成骨架", "生成段落骨架", "scaffold_id");
  }
  return status("ready_for_review", "待检查薄弱处", "查看缺来源、缺例子或反例的段落", "scaffold_id", "ready");
}
