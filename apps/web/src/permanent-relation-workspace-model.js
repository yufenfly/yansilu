import {
  isHiddenSemanticRelation
} from "./writing-readiness.js";
import {
  relationWorkspaceExistingEdge,
  relationWorkspaceNextTargetCandidate
} from "./relation-workspace-shared.js";

export const PERMANENT_RELATION_WORKSPACE_MODES = new Set(["ai", "manual"]);

function cleanText(value = "") {
  return String(value || "").trim();
}

function cleanId(value = "") {
  return cleanText(value);
}

function cleanType(value = "") {
  return cleanText(value).toLowerCase();
}

export function defaultPermanentRelationWorkspaceState(noteId = "") {
  return {
    open: false,
    noteId: cleanId(noteId),
    sourceNoteId: cleanId(noteId),
    mode: "manual",
    selectedTargetNoteId: "",
    relationType: "",
    rationale: "",
    insightQuestion: "",
    sourceKind: "manual",
    candidateSource: "",
    relationComposerSessionId: "",
    insertLinkOnSave: false,
    cursorRange: null,
    manualQuery: "",
    manualTargets: [],
    searchState: "idle",
    saveState: "idle",
    error: "",
    notice: "",
    dirty: false,
    result: null,
    entryRoute: null
  };
}

export function normalizePermanentRelationWorkspaceState(state = {}, noteId = "") {
  const base = defaultPermanentRelationWorkspaceState(noteId || state.noteId);
  const mode = cleanType(state.mode);
  return {
    ...base,
    ...state,
    open: state.open === true,
    noteId: cleanId(noteId || state.noteId),
    sourceNoteId: cleanId(state.sourceNoteId || noteId || state.noteId),
    mode: PERMANENT_RELATION_WORKSPACE_MODES.has(mode) ? mode : "manual",
    selectedTargetNoteId: cleanId(state.selectedTargetNoteId),
    relationType: cleanType(state.relationType),
    rationale: cleanText(state.rationale),
    insightQuestion: cleanText(state.insightQuestion),
    sourceKind: cleanType(state.sourceKind || state.source_kind || "manual") || "manual",
    candidateSource: cleanText(state.candidateSource || state.candidate_source),
    relationComposerSessionId: cleanText(state.relationComposerSessionId || state.relation_composer_session_id),
    insertLinkOnSave: state.insertLinkOnSave === true || state.insert_link_on_save === true,
    cursorRange: state.cursorRange && typeof state.cursorRange === "object" ? state.cursorRange : null,
    manualQuery: cleanText(state.manualQuery),
    manualTargets: Array.isArray(state.manualTargets) ? state.manualTargets : [],
    searchState: cleanType(state.searchState) || "idle",
    saveState: cleanType(state.saveState) || "idle",
    error: cleanText(state.error),
    notice: cleanText(state.notice),
    dirty: state.dirty === true,
    result: state.result && typeof state.result === "object" ? state.result : null,
    entryRoute: state.entryRoute && typeof state.entryRoute === "object" ? state.entryRoute : null
  };
}

export function resetPermanentRelationWorkspaceResult(state = {}) {
  return {
    ...state,
    saveState: "idle",
    error: "",
    notice: "",
    result: null
  };
}

export function permanentRelationCandidateRationale(candidate = {}) {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const rationale = cleanText(source.rationaleDraft || source.rationale || source.aiRationale || source.reviewQuestion);
  return rationale && !/^本地初判发现/.test(rationale) ? rationale : "";
}

export function permanentRelationCandidateEndpoint(candidate = {}, sourceNoteId = "") {
  const sourceId = cleanId(sourceNoteId);
  const rawSource = cleanId(
    candidate.actionSourceNoteId ||
      candidate.action_source_note_id ||
      candidate.sourceNoteId ||
      candidate.source_note_id ||
      candidate.fromNoteId ||
      candidate.from_note_id ||
      candidate.from?.id
  );
  const rawTarget = cleanId(
    candidate.counterpartNoteId ||
      candidate.counterpart_note_id ||
      candidate.targetNoteId ||
      candidate.target_note_id ||
      candidate.actionTargetNoteId ||
      candidate.action_target_note_id ||
      candidate.toNoteId ||
      candidate.to_note_id ||
      candidate.to?.id
  );
  if (rawTarget && rawTarget !== sourceId) return rawTarget;
  if (rawSource && rawSource !== sourceId) return rawSource;
  return rawTarget || rawSource || "";
}

export function normalizePermanentRelationAiCandidates(analysis = null, sourceNoteId = "") {
  const payload = analysis?.analysis && typeof analysis.analysis === "object" ? analysis.analysis : analysis;
  const candidates = [
    ...(Array.isArray(payload?.relationCandidates) ? payload.relationCandidates : []),
    ...(Array.isArray(payload?.bridgeCandidates) ? payload.bridgeCandidates : [])
  ];
  const seen = new Set();
  return candidates
    .map((candidate) => {
      const targetNoteId = permanentRelationCandidateEndpoint(candidate, sourceNoteId);
      const relationType = cleanType(
        candidate.aiRelationType ||
          candidate.ai_relation_type ||
          candidate.relationType ||
          candidate.relation_type ||
          (candidate.componentBridge ? "bridges" : "associated_with")
      ) || "associated_with";
      const title = cleanText(
        candidate.counterpartTitle ||
          candidate.counterpart_title ||
          candidate.targetTitle ||
          candidate.target_title ||
          candidate.toTitle ||
          candidate.to_title ||
          candidate.title ||
          targetNoteId
      );
      const rationale = cleanText(
        candidate.rationaleDraft ||
          candidate.rationale_draft ||
          candidate.aiRationale ||
          candidate.ai_rationale ||
          candidate.rationale ||
          candidate.evidenceText ||
          candidate.evidence_text ||
          ""
      );
      const insightQuestion = cleanText(
        candidate.insightQuestionDraft ||
          candidate.insight_question_draft ||
          candidate.insightQuestion ||
          candidate.insight_question ||
          candidate.reviewQuestion ||
          candidate.review_question ||
          ""
      );
      const decision = cleanType(candidate.aiDecision || candidate.ai_decision || "");
      const blocked = decision === "reject" || relationType === "no_relation" || relationType === "appears_in_draft";
      const aiConfidence = Number(candidate.aiConfidence ?? candidate.ai_confidence);
      return {
        ...candidate,
        ...(Number.isFinite(aiConfidence) && aiConfidence > 0 ? { aiConfidence } : {}),
        targetNoteId,
        targetTitle: title,
        relationType,
        rationaleDraft: rationale,
        insightQuestionDraft: insightQuestion,
        blocked
      };
    })
    .filter((candidate) => candidate.targetNoteId && !candidate.blocked)
    .filter((candidate) => {
      if (seen.has(candidate.targetNoteId)) return false;
      seen.add(candidate.targetNoteId);
      return true;
    });
}

export function permanentRelationWorkspaceExistingLinks(relations = null) {
  return [
    ...(Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : []),
    ...(Array.isArray(relations?.backlinks) ? relations.backlinks : [])
  ].filter((link) => !isHiddenSemanticRelation(link));
}

export function permanentRelationWorkspaceExistingLink(relations = null, sourceNoteId = "", targetNoteId = "") {
  return relationWorkspaceExistingEdge(permanentRelationWorkspaceExistingLinks(relations), sourceNoteId, targetNoteId);
}

export function permanentRelationWorkspaceNextAiCandidate(aiCandidates = [], relations = null, sourceNoteId = "", excludeTargetIds = []) {
  return relationWorkspaceNextTargetCandidate(aiCandidates, {
    sourceNoteId,
    edges: permanentRelationWorkspaceExistingLinks(relations),
    excludeTargetIds
  });
}

export function permanentRelationWorkspaceSelectedTarget({
  state = {},
  aiCandidates = [],
  notes = []
} = {}) {
  const targetId = cleanId(state.selectedTargetNoteId);
  if (!targetId) return null;
  const knownNote = (Array.isArray(notes) ? notes : []).find((note) => cleanId(note?.id) === targetId) || null;
  const aiCandidate = (Array.isArray(aiCandidates) ? aiCandidates : []).find((candidate) => cleanId(candidate?.targetNoteId) === targetId) || null;
  const manualTarget = (Array.isArray(state.manualTargets) ? state.manualTargets : []).find((note) => cleanId(note?.id) === targetId) || null;
  return {
    id: targetId,
    title: cleanText(knownNote?.title || manualTarget?.title || aiCandidate?.targetTitle || targetId),
    noteType: cleanText(knownNote?.noteType || manualTarget?.noteType || ""),
    folderId: cleanText(knownNote?.folderId || manualTarget?.folderId || ""),
    body: cleanText(knownNote?.body || manualTarget?.body || ""),
    thesis: cleanText(knownNote?.thesis || manualTarget?.thesis || ""),
    candidate: aiCandidate
  };
}

export function permanentRelationWorkspaceCanSave({
  state = {},
  relations = null,
  allowExistingUpdate = false
} = {}) {
  const normalized = normalizePermanentRelationWorkspaceState(state);
  if (!normalized.noteId) return { ok: false, reason: "missing_note" };
  if (!normalized.selectedTargetNoteId) return { ok: false, reason: "missing_target" };
  if (normalized.selectedTargetNoteId === normalized.noteId) return { ok: false, reason: "self_relation" };
  if (!normalized.relationType) return { ok: false, reason: "missing_type" };
  if (!normalized.rationale) return { ok: false, reason: "missing_rationale" };
  const existing = permanentRelationWorkspaceExistingLink(relations, normalized.noteId, normalized.selectedTargetNoteId);
  if (existing && allowExistingUpdate) return { ok: true, reason: "update_existing", existing };
  if (existing) return { ok: false, reason: "existing_relation", existing };
  return { ok: true, reason: "" };
}

export function permanentRelationWorkspaceErrorText(reason = "") {
  const key = cleanType(reason);
  if (key === "missing_note") return "请先打开一条永久笔记。";
  if (key === "missing_target") return "请选择要关联的笔记。";
  if (key === "self_relation") return "不能把笔记关联到自己。";
  if (key === "missing_type") return "请选择关系类型。";
  if (key === "missing_rationale") return "请写一句为什么要关联。";
  if (key === "existing_relation") return "这两条笔记已经有关系。";
  return "关系暂时不能保存。";
}
