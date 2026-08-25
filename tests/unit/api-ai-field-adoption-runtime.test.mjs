import test from "node:test";
import assert from "node:assert/strict";

import {
  adoptSuggestionAndLinkedArtifactAtomically,
  createInMemoryArtifactStore,
  createInMemorySuggestionStore,
  transitionSuggestionStatus
} from "../../packages/ai-orchestrator/src/index.mjs";

function createAdoptionFixture() {
  const suggestionStore = createInMemorySuggestionStore();
  const artifactStore = createInMemoryArtifactStore();
  const suggestion = suggestionStore.create(
    {
      id: "suggestion_adopt_runtime_1",
      target: { type: "permanent_note", id: "pn_1", field: "thesis" },
      scope: "permanent_note_distillation",
      content: { thesis: "A draft AI thesis." },
      sourceArtifactId: "artifact_adopt_runtime_1"
    },
    { now: "2026-05-21T09:00:00.000Z" }
  );
  const artifact = artifactStore.createArtifact(
    {
      id: "artifact_adopt_runtime_1",
      type: "InsightCard",
      title: "Field suggestion runtime adopt",
      summary: "A linked field suggestion should adopt consistently across stores.",
      body: "A draft AI thesis.",
      agentRunId: "run_adopt_runtime_1",
      status: "pending_review",
      payload: {
        fieldSuggestionId: suggestion.id,
        fieldSuggestion: {
          id: suggestion.id,
          target: { type: "permanent_note", id: "pn_1", field: "thesis" },
          content: { thesis: "A draft AI thesis." },
          status: "suggested",
          provenance: { humanConfirmed: false, humanEdited: false }
        },
        field_suggestion: {
          id: suggestion.id,
          target: { type: "permanent_note", id: "pn_1", field: "thesis" },
          content: { thesis: "A draft AI thesis." },
          status: "suggested",
          provenance: { humanConfirmed: false, humanEdited: false }
        }
      }
    },
    { now: "2026-05-21T09:00:00.000Z" }
  );
  const originalNote = {
    id: "pn_1",
    title: "Original note",
    body: "# Original note\n\nBody.",
    status: "draft",
    thesis: "",
    threeLineSummary: [],
    distillationStatus: "missing",
    authorship: { user_confirmed: false, ai_assisted: false },
    boundaryOrCounterpoint: ""
  };
  const updatedNote = {
    ...originalNote,
    thesis: "A draft AI thesis.",
    distillationStatus: "draft",
    authorship: { user_confirmed: false, ai_assisted: true }
  };
  return {
    suggestionStore,
    artifactStore,
    suggestion,
    artifact,
    originalNote,
    updatedNote,
    fieldSuggestion: {
      noteId: "pn_1",
      field: "thesis",
      update: {
        thesis: "A draft AI thesis.",
        distillationStatus: "draft",
        authorship: { user_confirmed: false, ai_assisted: true }
      },
      adoptedValue: { thesis: "A draft AI thesis." }
    }
  };
}

function getSuggestionIdFromArtifact(artifact = {}) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  return String(
    payload.fieldSuggestionId ||
      payload.field_suggestion_id ||
      payload.fieldSuggestion?.id ||
      payload.field_suggestion?.id ||
      ""
  ).trim();
}

function buildAdoptedArtifactPayload(artifact = {}, fieldSuggestion = {}, updatedNote = null) {
  const payload = artifact.payload && typeof artifact.payload === "object" ? artifact.payload : {};
  const originalSuggestion = payload.fieldSuggestion || payload.field_suggestion;
  if (!originalSuggestion || typeof originalSuggestion !== "object") return payload;

  const target = originalSuggestion.target && typeof originalSuggestion.target === "object" ? originalSuggestion.target : {};
  const nextSuggestion = {
    ...originalSuggestion,
    status: "adopted_as_draft",
    target: {
      ...target,
      type: target.type || target.kind || "permanent_note",
      id: fieldSuggestion.noteId || target.id || "",
      field: fieldSuggestion.field || target.field || ""
    },
    provenance: {
      ...(originalSuggestion.provenance && typeof originalSuggestion.provenance === "object" ? originalSuggestion.provenance : {}),
      humanEdited: true,
      humanConfirmed: false
    }
  };

  return {
    ...payload,
    targetField: fieldSuggestion.field,
    target_field: fieldSuggestion.field,
    adoptedNoteId: String(updatedNote?.id || fieldSuggestion.noteId || "").trim(),
    adopted_note_id: String(updatedNote?.id || fieldSuggestion.noteId || "").trim(),
    fieldSuggestion: nextSuggestion,
    field_suggestion: nextSuggestion
  };
}

test("non-sqlite adopt helper updates note artifact and suggestion together", async () => {
  const fixture = createAdoptionFixture();
  const restored = [];

  const result = await adoptSuggestionAndLinkedArtifactAtomically({
    suggestionStore: fixture.suggestionStore,
    artifactStore: fixture.artifactStore,
    sourceArtifact: fixture.artifact,
    fieldSuggestion: fixture.fieldSuggestion,
    body: {
      userId: "user_1",
      comment: "Use the AI thesis as a draft only.",
      feedback: { useful: true }
    },
    originalNote: fixture.originalNote,
    applyNoteUpdate: async () => fixture.updatedNote,
    restoreNote: async (input) => {
      restored.push(input);
      return fixture.originalNote;
    },
    buildAdoptedArtifactPayload,
    getSuggestionIdFromArtifact
  });

  assert.equal(result.note.thesis, "A draft AI thesis.");
  assert.equal(result.artifact.status, "adopted_as_draft");
  assert.equal(result.artifact.payload.fieldSuggestion.status, "adopted_as_draft");
  assert.equal(result.artifact.userDecisions.at(-1).decision, "adopted_as_draft");
  assert.equal(result.suggestion.status, "adopted_as_draft");
  assert.equal(result.suggestion.history.at(-1).toStatus, "adopted_as_draft");
  assert.deepEqual(restored, []);
});

test("non-sqlite adopt helper rolls note and stores back when suggestion transition fails", async () => {
  const fixture = createAdoptionFixture();
  const restored = [];
  const wrappedSuggestionStore = {
    get: (...args) => fixture.suggestionStore.get(...args),
    replace: (...args) => fixture.suggestionStore.replace(...args),
    transition: () => {
      throw new Error("suggestion write failed");
    }
  };

  await assert.rejects(
    () =>
      adoptSuggestionAndLinkedArtifactAtomically({
        suggestionStore: wrappedSuggestionStore,
        artifactStore: fixture.artifactStore,
        sourceArtifact: fixture.artifact,
        fieldSuggestion: fixture.fieldSuggestion,
        body: {
          userId: "user_1",
          comment: "Use the AI thesis as a draft only."
        },
        originalNote: fixture.originalNote,
        applyNoteUpdate: async () => fixture.updatedNote,
        restoreNote: async (input) => {
          restored.push(input);
          return fixture.originalNote;
        },
        buildAdoptedArtifactPayload,
        getSuggestionIdFromArtifact
      }),
    /suggestion write failed/
  );

  const rolledBackArtifact = fixture.artifactStore.getArtifact(fixture.artifact.id);
  const rolledBackSuggestion = fixture.suggestionStore.get(fixture.suggestion.id);
  assert.equal(rolledBackArtifact.status, "pending_review");
  assert.equal(rolledBackArtifact.payload.fieldSuggestion.status, "suggested");
  assert.deepEqual(rolledBackArtifact.userDecisions, []);
  assert.equal(rolledBackSuggestion.status, "suggested");
  assert.deepEqual(rolledBackSuggestion.history, []);
  assert.deepEqual(restored, [
    {
      title: fixture.originalNote.title,
      body: fixture.originalNote.body,
      status: fixture.originalNote.status,
      thesis: fixture.originalNote.thesis,
      threeLineSummary: fixture.originalNote.threeLineSummary,
      startingQuestion: "",
      viewpointHistory: [],
      pendingViewpointRevision: null,
      distillationStatus: fixture.originalNote.distillationStatus,
      authorship: fixture.originalNote.authorship,
      boundaryOrCounterpoint: fixture.originalNote.boundaryOrCounterpoint
    }
  ]);
});
