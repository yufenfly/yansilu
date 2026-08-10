import assert from "node:assert/strict";
import test from "node:test";

import {
  PermanentNoteSidebarController,
  permanentRelationWorkspaceFocusSelector
} from "../../apps/web/src/permanent-note-sidebar-controller.js";
import { defaultPermanentRelationWorkspaceState } from "../../apps/web/src/permanent-relation-workspace-model.js";
import { normalizeRelationDraft } from "../../apps/web/src/permanent-relation-draft-model.js";
import { RELATION_ENTRY_SOURCES } from "../../apps/web/src/relation-entry-route.js";
import { PermanentRelationComposerController } from "../../apps/web/src/permanent-relation-composer-controller.js";
import { EditorPane } from "../../apps/web/src/components-editor-pane.js";

function host(overrides = {}) {
  const note = overrides.note || { id: "note-a", title: "A", noteType: "permanent" };
  const app = {
    currentSemanticRelations: overrides.currentSemanticRelations || { outgoingLinks: [], backlinks: [] },
    permanentRelationWorkspaceState: defaultPermanentRelationWorkspaceState(note.id),
    activeNote: () => note,
    setInspectorVisible: (visible) => {
      app.visible = visible;
    },
    activatePermanentWorkspaceTab: (tab) => {
      app.tab = tab;
    },
    permanentRelationWorkspaceAiCandidates: () => overrides.aiCandidates || [],
    relationCreateDefaultType: () => "associated_with",
    syncPermanentRelationWorkspaceOverlay: () => {
      app.synced = true;
    },
    renderRelated: (message) => {
      app.renderedMessage = message;
    },
    onStatus: (message, tone) => {
      app.statusMessage = message;
      app.statusTone = tone;
    },
    permanentRelationWorkspaceElement: () => ({
      querySelector: () => ({ focus: () => { app.focused = true; } })
    }),
    upsertApiNotes: (items) => {
      app.upserted = items;
    },
    ...overrides
  };
  return app;
}

test("permanent note sidebar controller chooses stable focus targets", () => {
  assert.equal(permanentRelationWorkspaceFocusSelector({ selectedTargetNoteId: "note-b", mode: "manual" }), '[data-permanent-relation-field="rationale"]');
  assert.equal(permanentRelationWorkspaceFocusSelector({ selectedTargetNoteId: "", mode: "manual" }), "[data-permanent-relation-target-search]");
  assert.equal(permanentRelationWorkspaceFocusSelector({ selectedTargetNoteId: "", mode: "ai" }), "[data-permanent-relation-target-search]");
});

test("permanent note sidebar controller opens relation workspace through a route", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout: (callback) => callback() };
  try {
    const app = host();
    const controller = new PermanentNoteSidebarController(app);
    assert.equal(controller.openRelationWorkspace({ mode: "manual", targetNoteId: "note-b" }), true);

    assert.equal(app.permanentRelationWorkspaceState.open, true);
    assert.equal(app.permanentRelationWorkspaceState.mode, "manual");
    assert.equal(app.permanentRelationWorkspaceState.selectedTargetNoteId, "note-b");
    assert.equal(app.permanentRelationWorkspaceState.relationType, "associated_with");
    assert.equal(app.permanentRelationWorkspaceState.entryRoute.returnTo, "right-sidebar");
    assert.equal(app.permanentRelationWorkspaceState.entryRoute.source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
    assert.equal(app.visible, true);
    assert.equal(app.tab, "relations");
    assert.equal(app.synced, true);
    assert.equal(app.focused, true);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("relation draft keeps source metadata for future AI candidates without saving", () => {
  const draft = normalizeRelationDraft({
    noteId: "note-a",
    sourceKind: "graph-ai-candidate",
    candidateSource: "potential-relation-scan",
    insertLinkOnSave: true,
    cursorRange: { from: 4, to: 4 }
  });

  assert.equal(draft.sourceNoteId, "note-a");
  assert.equal(draft.sourceKind, "graph-ai-candidate");
  assert.equal(draft.candidateSource, "potential-relation-scan");
  assert.equal(draft.insertLinkOnSave, true);
  assert.deepEqual(draft.cursorRange, { from: 4, to: 4 });
});

test("manual relation target selection defaults to a visible relation choice", () => {
  const app = host({
    state: { notes: [{ id: "note-a" }, { id: "note-b" }] },
    windowRef: { clearTimeout: () => {} }
  });
  app.permanentRelationSearchSerial = 0;
  app.permanentRelationWorkspaceState = {
    ...defaultPermanentRelationWorkspaceState("note-a"),
    manualTargets: [{ id: "note-b", title: "B" }]
  };

  new PermanentRelationComposerController(app).chooseManualTarget("note-b");

  assert.equal(app.permanentRelationWorkspaceState.selectedTargetNoteId, "note-b");
  assert.equal(app.permanentRelationWorkspaceState.relationType, "associated_with");
});

test("editor relation entry opens composer without replacing the current tab", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout: (callback) => callback() };
  try {
    const app = host();
    const controller = new PermanentNoteSidebarController(app);
    assert.equal(controller.openRelationWorkspace({
      source: RELATION_ENTRY_SOURCES.TOOLBAR_RELATION,
      mode: "manual",
      insertLinkOnSave: true,
      cursorRange: { from: 3, to: 3 }
    }), true);

    assert.equal(app.permanentRelationWorkspaceState.open, true);
    assert.equal(app.permanentRelationWorkspaceState.sourceKind, RELATION_ENTRY_SOURCES.TOOLBAR_RELATION);
    assert.match(app.permanentRelationWorkspaceState.relationComposerSessionId, /^relation-composer-/);
    assert.equal(app.permanentRelationWorkspaceState.insertLinkOnSave, true);
    assert.deepEqual(app.permanentRelationWorkspaceState.cursorRange, { from: 3, to: 3 });
    assert.equal(app.visible, undefined);
    assert.equal(app.tab, undefined);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("graph relation entry opens composer as overlay without activating editor sidebar", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { setTimeout: (callback) => callback() };
  try {
    const app = host({
      state: {
        notes: [
          { id: "note-a", title: "A", noteType: "permanent" },
          { id: "note-b", title: "B", noteType: "permanent" }
        ]
      },
      activeNote: () => ({ id: "note-b", title: "B", noteType: "permanent" })
    });
    const controller = new PermanentNoteSidebarController(app);
    assert.equal(controller.openRelationWorkspace({
      source: RELATION_ENTRY_SOURCES.GRAPH_NODE,
      noteId: "note-a",
      returnTo: "graph",
      targetNoteId: "note-b"
    }), true);

    assert.equal(app.permanentRelationWorkspaceState.noteId, "note-a");
    assert.match(app.permanentRelationWorkspaceState.relationComposerSessionId, /^relation-composer-/);
    assert.equal(app.permanentRelationWorkspaceState.selectedTargetNoteId, "note-b");
    assert.equal(app.permanentRelationWorkspaceState.entryRoute.returnTo, "graph");
    assert.equal(app.visible, undefined);
    assert.equal(app.tab, undefined);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("relation workspace overlay renders the draft source note instead of the active editor note", () => {
  const pane = Object.create(EditorPane.prototype);
  Object.assign(pane, {
    state: {
      notes: [
        { id: "note-a", title: "Source A", noteType: "permanent" },
        { id: "note-b", title: "Target B", noteType: "permanent" }
      ]
    },
    permanentRelationWorkspaceState: {
      ...defaultPermanentRelationWorkspaceState("note-a"),
      open: true,
      noteId: "note-a",
      sourceNoteId: "note-a",
      selectedTargetNoteId: "note-b",
      relationType: "supports",
      rationale: "because"
    },
    currentSemanticRelations: {
      outgoingLinks: [{ targetNoteId: "note-b", relationType: "supports", rationale: "active relation" }],
      backlinks: []
    },
    activeNote: () => ({ id: "note-b", title: "Target B", noteType: "permanent" }),
    isActiveNoteId: (noteId) => noteId === "note-b",
    permanentRelationWorkspaceAiCandidates: () => [],
    permanentRelationWorkspaceDeps: () => ({})
  });

  const html = pane.renderPermanentRelationWorkspaceOverlay();

  assert.match(html, /data-note-id="note-a"/);
  assert.doesNotMatch(html, /disabled>.*关联/s);
});

test("relation composer inserts target title wikilink at remembered cursor on save", async () => {
  let body = "alpha omega";
  const app = host({
    note: { id: "note-a", title: "A", noteType: "permanent" },
    state: {
      notes: [
        { id: "note-a", title: "A", noteType: "permanent" },
        { id: "note-b", title: "Target Note", noteType: "permanent" }
      ]
    }
  });
  Object.assign(app, {
    permanentRelationWorkspaceState: {
      ...defaultPermanentRelationWorkspaceState("note-a"),
      noteId: "note-a",
      sourceNoteId: "note-a",
      selectedTargetNoteId: "note-b",
      insertLinkOnSave: true,
      cursorRange: { from: 6, to: 6 }
    },
    isActiveNoteId: (noteId) => noteId === "note-a",
    isWysiwygMode: () => false,
    replaceEditorRange: (from, to, text) => {
      body = `${body.slice(0, from)}${text}${body.slice(to)}`;
    },
    handleEditorInput: () => {},
    saveActiveNote: async () => true,
    hideSaveAiSuggestion: () => {}
  });

  const inserted = await new PermanentRelationComposerController(app).insertLinkIfRequested(app.permanentRelationWorkspaceState);

  assert.equal(inserted, true);
  assert.equal(body, "alpha [[Target Note]]omega");
});

test("permanent note sidebar controller continuation preserves the original return context", () => {
  const app = host({
    aiCandidates: [
      {
        targetNoteId: "note-c",
        relationType: "contrasts",
        rationaleDraft: "reason",
        insightQuestionDraft: "question"
      }
    ]
  });
  app.permanentRelationWorkspaceState = {
    ...defaultPermanentRelationWorkspaceState("note-a"),
    entryRoute: {
      source: RELATION_ENTRY_SOURCES.GRAPH_NODE,
      noteId: "note-a",
      targetNoteId: "old",
      relationType: "supports",
      rationaleDraft: "old",
      insightQuestionDraft: "old",
      returnTo: "graph",
      entryHint: "",
      mode: "ai",
      isolatedKey: "",
      graphSelectionKind: "isolated"
    },
    result: { targetNoteId: "old" }
  };

  new PermanentNoteSidebarController(app).continueRelationWorkspace();

  assert.equal(app.permanentRelationWorkspaceState.open, true);
  assert.equal(app.permanentRelationWorkspaceState.mode, "manual");
  assert.equal(app.permanentRelationWorkspaceState.selectedTargetNoteId, "");
  assert.equal(app.permanentRelationWorkspaceState.rationale, "");
  assert.equal(app.permanentRelationWorkspaceState.entryRoute.returnTo, "graph");
  assert.equal(app.permanentRelationWorkspaceState.entryRoute.graphSelectionKind, "isolated");
});

test("permanent note sidebar controller commits saved relation results in place", () => {
  const app = host();
  new PermanentNoteSidebarController(app).commitSavedRelationWorkspaceResult({
    noteId: "note-a",
    state: {
      ...defaultPermanentRelationWorkspaceState("note-a"),
      selectedTargetNoteId: "note-b",
      relationType: "supports",
      rationale: "reason"
    },
    result: {
      targetNoteId: "note-b",
      relationType: "supports",
      created: true
    },
    successMessage: "saved"
  });

  assert.equal(app.permanentRelationWorkspaceState.open, true);
  assert.equal(app.permanentRelationWorkspaceState.saveState, "saved");
  assert.equal(app.permanentRelationWorkspaceState.result.targetNoteId, "note-b");
  assert.equal(app.renderedMessage, undefined);
  assert.equal(app.statusMessage, "saved");
  assert.equal(app.statusTone, "ok");
  assert.equal(app.synced, true);
});
