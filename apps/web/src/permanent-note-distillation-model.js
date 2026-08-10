import { normalizeDistillationTemplateVariants } from "./editor-relation-helpers.js";
import { relationOtherEndpoint } from "./note-relation-endpoint.js";
import { isHiddenSemanticRelation } from "./writing-readiness.js";

export function emptyPermanentNoteDistillationPrefill(noteId = "") {
  return {
    noteId: String(noteId || "").trim(),
    boundaryDraft: "",
    draftVariants: [],
    selectedTemplateVariant: "",
    rememberedTemplateVariantLabel: "",
    viewpointDraft: null
  };
}

export function normalizePermanentNoteDistillationPrefill(noteId = "", options = {}, deps = {}) {
  const cleanNoteId = String(noteId || "").trim();
  if (!cleanNoteId) return emptyPermanentNoteDistillationPrefill("");

  const normalized = normalizeDistillationTemplateVariants(
    options?.draftVariants || [],
    deps.preferredTemplateVariant || options?.selectedTemplateVariant || ""
  );
  const rememberedTemplateVariant = deps.rememberedTemplateVariant || { key: "", label: "" };

  return {
    noteId: cleanNoteId,
    boundaryDraft: String(options?.boundaryDraft || "").trim(),
    draftVariants: normalized.items,
    selectedTemplateVariant: normalized.selectedKey,
    viewpointDraft: options?.viewpointDraft && typeof options.viewpointDraft === "object"
      ? { ...options.viewpointDraft }
      : null,
    rememberedTemplateVariantLabel:
      rememberedTemplateVariant.key && rememberedTemplateVariant.key === normalized.selectedKey
        ? rememberedTemplateVariant.label
        : ""
  };
}

export function currentPermanentNoteDistillationPrefill(state = null, noteId = "") {
  const cleanNoteId = String(noteId || "").trim();
  if (!cleanNoteId || !state || state.noteId !== cleanNoteId) {
    return emptyPermanentNoteDistillationPrefill(cleanNoteId);
  }
  return state;
}

export function permanentNoteDistillationStatus(selectedStatus = "", values = {}) {
  const cleanStatus = String(selectedStatus || "").trim();
  if (["missing", "draft", "confirmed"].includes(cleanStatus)) return cleanStatus;
  return values.thesis || values.threeLineSummary?.length ? "draft" : "missing";
}

export function permanentNoteDistillationFormValues(form) {
  const thesis = String(form?.querySelector?.('[name="thesis"]')?.value || "").trim();
  const originalThesis = String(form?.querySelector?.('[name="originalThesis"]')?.value || "").trim();
  const startingQuestion = String(form?.querySelector?.('[name="startingQuestion"]')?.value || "").trim();
  const thesisChangeReason = String(form?.querySelector?.('[name="thesisChangeReason"]')?.value || "").trim();
  const threeLineSummary = [1, 2, 3]
    .map((idx) => String(form?.querySelector?.(`[name="summary${idx}"]`)?.value || "").trim())
    .filter(Boolean);
  const boundaryOrCounterpoint = String(form?.querySelector?.('[name="boundaryOrCounterpoint"]')?.value || "").trim();
  const selectedStatus = String(form?.querySelector?.('[name="distillationStatus"]')?.value || "").trim();
  const viewpointChangeSourceNoteIds = Array.from(
    form?.querySelectorAll?.('[name="viewpointChangeSourceNoteIds"]:checked') || []
  ).map((item) => String(item.value || "").trim()).filter(Boolean);

  return {
    thesis,
    originalThesis,
    startingQuestion,
    thesisChangeReason,
    viewpointChangeSourceNoteIds,
    threeLineSummary,
    boundaryOrCounterpoint,
    distillationStatus: permanentNoteDistillationStatus(selectedStatus, {
      thesis,
      threeLineSummary
    })
  };
}

export function permanentNoteViewpointBaseline(note = {}) {
  return String(note?.pendingViewpointRevision?.previousThesis || note?.thesis || "").trim();
}

export function permanentNoteViewpointSourceCandidates(note = {}, relations = {}, notes = []) {
  const noteId = String(note?.id || "").trim();
  const selectedIds = new Set(
    (Array.isArray(note?.pendingViewpointRevision?.sourceNoteIds) ? note.pendingViewpointRevision.sourceNoteIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  const noteById = new Map(
    (Array.isArray(notes) ? notes : [])
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => id)
  );
  const candidateById = new Map();
  const relationItems = [
    ...(Array.isArray(relations?.outgoingLinks) ? relations.outgoingLinks : []),
    ...(Array.isArray(relations?.backlinks) ? relations.backlinks : [])
  ];
  for (const relation of relationItems) {
    if (isHiddenSemanticRelation(relation)) continue;
    const related = relationOtherEndpoint(relation, noteId);
    const id = related.id;
    if (!id) continue;
    const known = noteById.get(id);
    candidateById.set(id, {
      id,
      title: String(related.title || known?.title || id).trim(),
      selected: selectedIds.has(id)
    });
  }
  for (const id of selectedIds) {
    if (candidateById.has(id)) continue;
    const known = noteById.get(id);
    candidateById.set(id, { id, title: String(known?.title || id).trim(), selected: true });
  }
  return [...candidateById.values()];
}

export function permanentNoteViewpointHasChanged(originalThesis = "", thesis = "") {
  const original = String(originalThesis || "").trim();
  const current = String(thesis || "").trim();
  return Boolean(original && current && original !== current);
}

export function applyPermanentNoteDistillationToNote(note, values = {}, options = {}) {
  if (!note) return;
  note.thesis = String(values.thesis || "").trim();
  note.startingQuestion = String(values.startingQuestion || note.startingQuestion || "").trim();
  if (Array.isArray(values.viewpointHistory)) note.viewpointHistory = values.viewpointHistory;
  if (Object.prototype.hasOwnProperty.call(values, "pendingViewpointRevision")) {
    note.pendingViewpointRevision = values.pendingViewpointRevision || null;
  }
  note.threeLineSummary = Array.isArray(values.threeLineSummary) ? values.threeLineSummary : [];
  note.boundaryOrCounterpoint = String(values.boundaryOrCounterpoint || "").trim();
  if (values.distillationStatus) note.distillationStatus = values.distillationStatus;
  if (options.confirmAuthorship) {
    note.authorship = {
      ...(note.authorship || {}),
      user_confirmed: true,
      ai_assisted: Boolean(note.authorship?.ai_assisted)
    };
  }
}
