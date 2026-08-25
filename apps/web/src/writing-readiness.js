import { parseLinks, parseTags } from "./prototype-store.js";

export function noteHasBoundarySignal(note = {}) {
  if (String(note?.boundaryOrCounterpoint || note?.boundary_or_counterpoint || "").trim()) return true;
  const body = String(note?.body || note?.markdown || "");
  return /边界|反例|不成立|适用条件|反方|counterpoint|boundary|counterexample/i.test(body);
}

export function isHiddenSemanticRelation(link = {}) {
  const status = String(link?.status || "confirmed").trim().toLowerCase();
  return status === "dismissed" || status === "archived";
}

export function isMarkdownWikilinkSemanticRelation(link = {}) {
  return String(link?.relationType || "").trim().toLowerCase() === "associated_with" && String(link?.rationale || "").trim() === "markdown_wikilink";
}

export function countExplicitSemanticRelations(relations = null) {
  const outgoing = Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : [];
  const backlinks = Array.isArray(relations?.backlinks) ? relations.backlinks : [];
  return [...outgoing, ...backlinks].filter((link) => !isHiddenSemanticRelation(link)).length;
}

export function deriveNoteWritingReadiness(note = {}, overview = {}) {
  const authorshipConfirmed = Boolean(note?.authorship?.user_confirmed);
  const noteStatus = String(note?.status || "").trim().toLowerCase();
  const confirmed = String(note?.distillationStatus || "").trim().toLowerCase() === "confirmed";
  const relationState = String(overview.relationState || "loaded").trim();
  const explicitRelationCount = Number(overview.explicitRelationCount || 0);
  const wikilinkCount = Number(overview.wikilinkCount || 0);
  const themeSignalCount = Number(overview.themeSignalCount || 0);
  const hasBoundary = noteHasBoundarySignal(note);

  if (!authorshipConfirmed) {
    return {
      level: "blocked_authorship",
      status: "先完成作者确认",
      hint: "相关笔记只接收已经完成作者确认的永久笔记。",
      actionLabel: "先完成作者确认"
    };
  }
  if (noteStatus !== "active") {
    return {
      level: "blocked_draft",
      status: "先完成原创确认",
      hint: "当前仍是 draft，先完成原创性检查后再进入写作中心。",
      actionLabel: "先完成原创确认"
    };
  }
  if (!confirmed) {
    return {
      level: "needs_distillation",
      status: "先确认观点",
      hint: "至少先确认 thesis 和三句话压缩，再决定是否进入写作中心。",
      actionLabel: "先确认观点/三句话"
    };
  }
  if (!hasBoundary) {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: "已经可以先作为相关笔记，但先补边界或反例，后面形成文章会更稳。",
      actionLabel: "加入相关笔记"
    };
  }
  if (relationState === "loading") {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: "边界已经具备；等关系读取完成后，再判断是否可以形成文章。",
      actionLabel: "加入相关笔记"
    };
  }
  if (relationState === "error") {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: "当前可以先作为相关笔记，但最好补一条清楚的关系后再写文章。",
      actionLabel: "加入相关笔记"
    };
  }
  if (explicitRelationCount === 0) {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: wikilinkCount > 0 ? "已经有基础链接，但还要补成关联，才适合形成文章。" : "判断和边界已经具备，但最好补一条关系再写文章。",
      actionLabel: "加入相关笔记"
    };
  }
  if (themeSignalCount < 2) {
    return {
      level: "project_ready",
      status: "先确定可写主题",
      hint: "判断、边界和关系已具备，可以先确定可写主题；补更多相关笔记后再做 AI 写作检查。",
      actionLabel: "确定可写主题"
    };
  }
  return {
    level: "strong_model_ready",
    status: "先确定可写主题",
    hint: "判断、边界、关系和相关笔记都较完整；先确定可写主题，再做 AI 写作检查。",
    actionLabel: "确定可写主题"
  };
}

export function deriveBasketWritingReadiness(noteIds = [], noteLookup, relationCounts = {}, options = {}) {
  const uniqueIds = [...new Set((noteIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
  const notes = uniqueIds.map((id) => noteLookup(id)).filter(Boolean);
  const relationState = String(options?.relationState || "loaded").trim().toLowerCase();

  if (!notes.length) {
    return {
      level: "needs_basket",
      status: "先选择相关笔记",
      hint: "至少选择 1 条永久笔记，最好 2-5 条再确定可写主题。",
      actionLabel: "加入相关笔记"
    };
  }

  const blockedAuthorship = notes.filter((note) => !note?.authorship?.user_confirmed);
  if (blockedAuthorship.length) {
    return {
      level: "blocked_authorship",
      status: "先完成作者确认",
      hint: `${blockedAuthorship.length} 条笔记还没完成作者确认。`,
      actionLabel: "查看写作要求"
    };
  }

  const draftNotes = notes.filter((note) => String(note?.status || "").trim().toLowerCase() !== "active");
  if (draftNotes.length) {
    return {
      level: "blocked_draft",
      status: "先完成原创确认",
      hint: `${draftNotes.length} 条笔记仍是 draft。`,
      actionLabel: "查看写作要求"
    };
  }

  const unconfirmed = notes.filter((note) => String(note?.distillationStatus || "").trim().toLowerCase() !== "confirmed");
  if (unconfirmed.length) {
    return {
      level: "needs_distillation",
      status: "先确认观点",
      hint: `${unconfirmed.length} 条笔记还没完成 confirmed distillation。`,
      actionLabel: "先完成提纯"
    };
  }

  const boundaryMissing = notes.filter((note) => !noteHasBoundarySignal(note));
  const totalRelationCount = uniqueIds.reduce((sum, id) => sum + Number(relationCounts[id] || 0), 0);
  const totalThemeSignals = uniqueIds.reduce((sum, id) => {
    const note = noteLookup(id);
    const body = String(note?.body || "");
    return sum + parseLinks(body).length + parseTags(body).length;
  }, 0);

  if (relationState === "error") {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: "关联暂时读取失败，先稍后重试或回到笔记里手动确认关系。",
      actionLabel: "加入相关笔记"
    };
  }

  if (boundaryMissing.length || totalRelationCount === 0) {
    return {
      level: "basket_ready",
      status: "可作为相关笔记",
      hint: boundaryMissing.length
        ? `${boundaryMissing.length} 条笔记还缺边界或反例。`
        : "当前相关笔记还缺关联，建议补一条关系再形成文章。",
      actionLabel: "加入相关笔记"
    };
  }

  if (uniqueIds.length < 2 || totalThemeSignals < 2) {
    return {
      level: "project_ready",
      status: "先确定可写主题",
      hint: "当前相关笔记足够先确定可写主题，但相关笔记还不算丰富，先别急着做 AI 写作检查。",
      actionLabel: "确定可写主题"
    };
  }

  return {
    level: "strong_model_ready",
    status: "先确定可写主题",
    hint: "相关笔记和关系都较完整；先确定可写主题，再做 AI 写作检查。",
    actionLabel: "确定可写主题"
  };
}

export function describeProjectPreflight(preflight = null) {
  const warningCount = Number(preflight?.warningCount || 0);
  if (!preflight) {
    return {
      level: "unknown",
      status: "待检查",
      hint: "先确定可写主题或生成文章提纲，才能看到更具体的写作检查结果。"
    };
  }
  if (String(preflight.status || "").trim() === "ready") {
    return {
      level: "ready",
      status: "结构准备较完整",
      hint: "当前主题的写作检查已基本通过，可以继续生成文章提纲或做 AI 写作检查。"
    };
  }
  return {
    level: "needs_attention",
    status: "仍有预检提醒",
    hint: `当前主题还有 ${warningCount} 项需要注意，先补齐再继续推进会更稳。`
  };
}
