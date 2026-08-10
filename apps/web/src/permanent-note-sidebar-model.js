import { isHiddenRelation } from "./editor-relation-helpers.js";

function relationList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function explicitPermanentNoteRelations(relations = null) {
  const outgoing = relationList(relations?.outgoingLinks).filter((link) => !isHiddenRelation(link));
  const backlinks = relationList(relations?.backlinks).filter((link) => !isHiddenRelation(link));
  return {
    outgoing,
    backlinks,
    all: [...outgoing, ...backlinks]
  };
}

export function permanentNoteSidebarExplicitRelationCount({
  relationState = "loaded",
  relations = null
} = {}) {
  if (String(relationState || "").trim() !== "loaded" || !relations) return null;
  return explicitPermanentNoteRelations(relations).all.length;
}

export function permanentNoteSidebarOverview({
  forward = [],
  backward = [],
  tagRelated = [],
  relations = null,
  relationState = "loaded"
} = {}) {
  const explicitRelations = explicitPermanentNoteRelations(relations).all;
  return {
    relationState: String(relationState || "loaded").trim() || "loaded",
    explicitRelationCount: explicitRelations.length,
    thinExplicitRelationCount: explicitRelations.filter(
      (link) => String(link?.rationaleQualityLevel || "").trim().toLowerCase() === "basic"
    ).length,
    wikilinkCount: relationList(forward).length + relationList(backward).length,
    tagRelatedCount: relationList(tagRelated).length,
    themeSignalCount: new Set([
      ...relationList(forward).map((item) => item.id),
      ...relationList(backward).map((item) => item.id),
      ...relationList(tagRelated).map((item) => item.id)
    ]).size
  };
}

export function permanentNoteSidebarRelationSnapshot({
  relationState = "loaded",
  relations = null,
  forward = [],
  backward = [],
  tagRelated = []
} = {}) {
  const overview = permanentNoteSidebarOverview({
    relationState,
    relations,
    forward,
    backward,
    tagRelated
  });
  const explicit = explicitPermanentNoteRelations(relations);
  return {
    overview,
    relationState: overview.relationState,
    explicitRelationCount:
      overview.relationState === "loaded" && relations
        ? explicit.all.length
        : null,
    hasExplicitRelations: explicit.all.length > 0,
    hasWeakSignals: overview.wikilinkCount + overview.tagRelatedCount > 0,
    isIsolated: overview.relationState === "loaded" && explicit.all.length === 0 && overview.wikilinkCount + overview.tagRelatedCount === 0
  };
}
