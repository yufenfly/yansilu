export function buildPermanentNoteMainPathActionModel({
  note = {},
  overview = {},
  architecture = {},
  themeInfo = {},
  distillationInfo = {},
  writingStep = {},
  mainPathSummary = {}
} = {}) {
  const viewpoint = architecture.viewpoint || {};
  const thesis = viewpoint.thesis;
  const confirmed = Boolean(viewpoint.confirmed);
  const relation = architecture.relation || {};
  const relationState = String(relation.relationState || overview.relationState || "loaded").trim();
  const explicitRelationCount = Number(relation.explicitRelationCount || 0);
  const wikilinkCount = Number(overview.wikilinkCount || 0);
  const tagRelatedCount = Number(overview.tagRelatedCount || 0);
  const thinExplicitRelationCount = Number(relation.thinExplicitRelationCount || 0);
  const primaryAction =
    !thesis || !confirmed
      ? "distillation"
      : relationState === "loading" || relationState === "error" || explicitRelationCount === 0 || thinExplicitRelationCount > 0
        ? "relations"
        : "writing";
  const steps = [
    {
      label: "提炼观点",
      status: distillationInfo.status,
      hint: distillationInfo.hint,
      action: "distillation",
      actionLabel: distillationInfo.actionLabel,
      focusTarget: distillationInfo.focusTarget
    },
    buildPermanentNoteRelationActionStep({
      overview,
      themeInfo,
      relationState,
      explicitRelationCount,
      wikilinkCount,
      tagRelatedCount,
      thinExplicitRelationCount
    }),
    {
      label: "进入写作",
      status: writingStep.status,
      hint: writingStep.hint,
      action: "writing",
      actionLabel: writingStep.actionLabel,
      routeMode: writingStep.routeMode
    }
  ];
  const primaryStep = steps.find((step) => step.action === primaryAction) || steps[0];
  return {
    noteId: String(note?.id || "").trim(),
    nextStep: mainPathSummary.nextStep || "",
    noteSummary: mainPathSummary.summary || "",
    primaryStep,
    steps
  };
}

export function buildPermanentNoteRelationActionStep({
  overview = {},
  themeInfo = {},
  relationState = "loaded",
  explicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0,
  thinExplicitRelationCount = 0
} = {}) {
  const weakSignalLabel = themeInfo.badgeLabel || String(themeInfo.badge ?? wikilinkCount + tagRelatedCount);
  return {
    label: "建立关系",
    status:
      relationState === "loading"
        ? "读取中"
        : relationState === "error"
          ? "读取失败"
          : explicitRelationCount
            ? thinExplicitRelationCount > 0
              ? `理由待补 ${thinExplicitRelationCount}`
              : `已建 ${explicitRelationCount}`
            : wikilinkCount
              ? tagRelatedCount > 0
                ? `可能关系 ${weakSignalLabel}`
                : `已有线索 ${wikilinkCount}`
              : "待建立",
    hint:
      relationState === "loading"
        ? "先等关系读取完成。"
        : relationState === "error"
          ? "读取失败，但仍然可以手动补建。"
          : explicitRelationCount
            ? thinExplicitRelationCount > 0
              ? "已经连上关系，但还有理由偏薄的连接，先把它写具体。"
              : "已经有带理由的关系。"
            : wikilinkCount
              ? tagRelatedCount > 0
                ? "已经看得到几条可能关系。先挑最关键的一条，把为什么相关写清楚。"
                : "已经看得到一条可能关系，下一步把为什么相关写清楚。"
              : tagRelatedCount > 0
                ? "现在只有标签上的接近，先挑一条最关键的关系写出来。"
                : "先关联一条真正相关的永久笔记。",
    action: "relations",
    focusTarget: "create",
    actionLabel:
      thinExplicitRelationCount > 0
        ? "补关系说明"
        : wikilinkCount > 0
          ? tagRelatedCount > 0
            ? "补关系说明"
            : "补关系说明"
          : Number(overview.tagRelatedCount || 0) > 0
            ? "从同标签补关系"
            : "关联一条笔记"
  };
}
