function cleanText(value = "") {
  return String(value || "").trim();
}

function cleanKey(value = "") {
  return cleanText(value).toLowerCase();
}

function filledSummaryLines(note = {}) {
  return Array.isArray(note?.threeLineSummary)
    ? note.threeLineSummary.filter((item) => cleanText(item))
    : [];
}

export function permanentNoteViewpointState(note = {}) {
  const thesis = cleanText(note?.thesis);
  const summary = filledSummaryLines(note);
  const confirmed = cleanKey(note?.distillationStatus) === "confirmed";
  return {
    thesis,
    summary,
    confirmed,
    needsViewpoint: !confirmed || !thesis,
    status:
      !thesis
        ? "missing"
        : confirmed
          ? "confirmed"
          : "draft"
  };
}

export function permanentNoteSidebarLayout({
  isPermanentNote = false,
  isRecordableSource = false,
  tags = []
} = {}) {
  const permanent = Boolean(isPermanentNote);
  return {
    kind: permanent ? "permanent" : "source",
    showStatusSummary: permanent,
    showSourceGuidance: !permanent,
    showDeferredWorkspace: permanent,
    showSourceFlow: !permanent && Boolean(isRecordableSource),
    showOverviewTags: !permanent && Array.isArray(tags) && tags.length > 0
  };
}

export function permanentNoteRelationState({
  relationState = "loaded",
  explicitRelationCount = 0,
  thinExplicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0
} = {}) {
  const cleanRelationState = cleanKey(relationState) || "loaded";
  const explicitCount = explicitRelationCount === null ? null : Number(explicitRelationCount || 0);
  const thinCount = Number(thinExplicitRelationCount || 0);
  const weakSignalCount = Number(wikilinkCount || 0) + Number(tagRelatedCount || 0);
  const status =
    cleanRelationState === "loading"
      ? "loading"
      : cleanRelationState === "error"
        ? "error"
        : explicitCount > 0
          ? thinCount > 0
            ? "thin"
            : "connected"
          : weakSignalCount > 0
            ? "candidate"
            : "isolated";
  return {
    relationState: cleanRelationState,
    explicitRelationCount: explicitCount,
    thinExplicitRelationCount: thinCount,
    weakSignalCount,
    status,
    needsRelation: status === "loading" || status === "error" || status === "isolated" || status === "candidate" || status === "thin"
  };
}

export function permanentNoteWorkspaceArchitecture({
  note = {},
  relationState = "loaded",
  explicitRelationCount = 0,
  thinExplicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0
} = {}) {
  const viewpoint = permanentNoteViewpointState(note);
  const relation = permanentNoteRelationState({
    relationState,
    explicitRelationCount,
    thinExplicitRelationCount,
    wikilinkCount,
    tagRelatedCount
  });
  const activeTab = viewpoint.needsViewpoint ? "viewpoint" : relation.needsRelation ? "relations" : "writing";
  return {
    activeTab,
    viewpoint,
    relation,
    tabs: ["relations", "viewpoint", "writing"].map((key) => ({
      key,
      active: key === activeTab
    }))
  };
}

export function permanentNoteStatusSummaryState({
  note = {},
  relationState = "loaded",
  relationCount = 0
} = {}) {
  const viewpoint = permanentNoteViewpointState(note);
  const relation = permanentNoteRelationState({ relationState, explicitRelationCount: relationCount });
  return {
    viewpoint,
    relation,
    viewpointTone: viewpoint.confirmed ? "success" : "warning",
    relationTone: relation.explicitRelationCount > 0 ? "success" : "warning"
  };
}

export function permanentRelationAssistState({
  explicitRelationCount = 0,
  wikilinkCount = 0,
  tagRelatedCount = 0,
  analysis = null
} = {}) {
  const explicitCount = explicitRelationCount === null ? null : Number(explicitRelationCount || 0);
  const weakSignalCount = Number(wikilinkCount || 0) + Number(tagRelatedCount || 0);
  const relationCandidates = Array.isArray(analysis?.analysis?.relationCandidates) ? analysis.analysis.relationCandidates.length : 0;
  const storedArtifactCount = Array.isArray(analysis?.reviewItems?.storedArtifactIds)
    ? analysis.reviewItems.storedArtifactIds.length
    : Array.isArray(analysis?.reviewItems?.artifacts)
      ? analysis.reviewItems.artifacts.length
      : 0;
  return {
    explicitRelationCount: explicitCount,
    weakSignalCount,
    relationCandidates,
    storedArtifactCount,
    hasAnalysis: Boolean(analysis),
    textKind:
      explicitCount === null
        ? "loading"
        : explicitCount > 0
          ? "connected"
          : weakSignalCount > 0
            ? "candidate"
            : "empty",
    primaryMode: analysis ? "ai" : "manual",
    primaryActionLabelKind: analysis ? "organize" : "ai"
  };
}
