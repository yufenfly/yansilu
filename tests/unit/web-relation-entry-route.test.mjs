import assert from "node:assert/strict";
import test from "node:test";

import {
  RELATION_ENTRY_SOURCES,
  normalizeRelationEntryRoute,
  relationEntryRouteForInlineLink,
  relationEntryRouteForPermanentWorkspaceContinuation,
  relationEntryRouteForPermanentWorkspace,
  relationEntryRouteFromElement,
  relationEntryRouteFromGraphAction
} from "../../apps/web/src/relation-entry-route.js";

function element(attrs = {}) {
  return {
    getAttribute(name) {
      return attrs[name] || "";
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    }
  };
}

test("relation entry route normalizes source, note, target and return context", () => {
  const route = normalizeRelationEntryRoute({
    source: "graph",
    noteId: " note-a ",
    targetNoteId: " note-b ",
    relationType: " Supports ",
    rationaleDraft: " because ",
    insightQuestionDraft: " question "
  });

  assert.deepEqual(route, {
    source: RELATION_ENTRY_SOURCES.GRAPH_NODE,
    noteId: "note-a",
    targetNoteId: "note-b",
    relationType: "supports",
    rationaleDraft: "because",
    insightQuestionDraft: "question",
    candidateSource: "",
    mode: "",
    returnTo: "graph",
    entryHint: "",
    isolatedKey: "",
    graphSelectionKind: ""
  });
});

test("graph action route keeps raw candidate source while using graph entry source", () => {
  const route = relationEntryRouteFromGraphAction({
    noteId: "note-a",
    source: "graph",
    candidateSource: "today-organizing"
  });

  assert.equal(route.source, RELATION_ENTRY_SOURCES.GRAPH_NODE);
  assert.equal(route.noteId, "note-a");
  assert.equal(route.candidateSource, "today-organizing");
  assert.equal(route.returnTo, "graph");
});

test("relation entry route keeps real entry aliases out of unknown source", () => {
  assert.equal(normalizeRelationEntryRoute({ source: "explorer-browser" }).source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
  assert.equal(normalizeRelationEntryRoute({ source: "system-message" }).source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
  assert.equal(normalizeRelationEntryRoute({ source: "today-organizing" }).source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
  assert.equal(normalizeRelationEntryRoute({ source: "import-result" }).source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
  assert.equal(normalizeRelationEntryRoute({ source: "graph-sidebar-associate" }).source, RELATION_ENTRY_SOURCES.GRAPH_NODE);
  assert.equal(normalizeRelationEntryRoute({ source: "graph-context-menu" }).source, RELATION_ENTRY_SOURCES.GRAPH_NODE);
});

test("right sidebar permanent workspace route keeps mode and returns to sidebar", () => {
  const route = relationEntryRouteForPermanentWorkspace("note-a", {
    mode: "manual",
    targetNoteId: "note-b"
  });

  assert.equal(route.source, RELATION_ENTRY_SOURCES.RIGHT_SIDEBAR);
  assert.equal(route.noteId, "note-a");
  assert.equal(route.targetNoteId, "note-b");
  assert.equal(route.mode, "manual");
  assert.equal(route.returnTo, "right-sidebar");
  assert.equal(route.relationType, "associated_with");
});

test("graph action route reads data attributes and remembers graph return", () => {
  const route = relationEntryRouteFromGraphAction(element({
    "data-graph-open-relation-form": "",
    "data-graph-relation-source": "note-a",
    "data-graph-target-note": "note-b",
    "data-graph-relation-type": "Bridges",
    "data-graph-rationale-draft": "draft reason"
  }), { currentSelection: { kind: "isolated", noteId: "note-a" } });

  assert.equal(route.source, RELATION_ENTRY_SOURCES.GRAPH_NODE);
  assert.equal(route.noteId, "note-a");
  assert.equal(route.targetNoteId, "note-b");
  assert.equal(route.relationType, "bridges");
  assert.equal(route.rationaleDraft, "draft reason");
  assert.equal(route.returnTo, "graph");
  assert.equal(route.graphSelectionKind, "isolated");
});

test("graph isolated queue route preserves candidate source for the shared composer", () => {
  const route = relationEntryRouteFromGraphAction(element({
    "data-graph-select-isolated": "iso-a",
    "data-graph-isolated-note": "note-a"
  }));

  assert.equal(route.source, RELATION_ENTRY_SOURCES.GRAPH_ISOLATED);
  assert.equal(route.noteId, "note-a");
  assert.equal(route.candidateSource, "graph-isolated-queue");
  assert.equal(route.returnTo, "graph");
});

test("AI candidate action route has a distinct source", () => {
  const route = relationEntryRouteFromElement(element({
    "data-graph-relation-candidate-apply": "",
    "data-open-note": "note-a",
    "data-graph-target-note": "note-b"
  }));

  assert.equal(route.source, RELATION_ENTRY_SOURCES.GRAPH_AI_CANDIDATE);
  assert.equal(route.noteId, "note-a");
  assert.equal(route.targetNoteId, "note-b");
  assert.equal(route.returnTo, "graph");
});

test("inline and toolbar relations share the same route shape", () => {
  const inline = relationEntryRouteForInlineLink("note-a", "note-b", {
    relationType: "same_topic",
    rationaleDraft: "manual reason"
  });
  const toolbar = relationEntryRouteForInlineLink("note-a", "note-b", {
    source: RELATION_ENTRY_SOURCES.TOOLBAR_RELATION,
    relationType: "same_topic",
    rationaleDraft: "manual reason"
  });

  assert.equal(inline.source, RELATION_ENTRY_SOURCES.INLINE_WIKILINK);
  assert.equal(toolbar.source, RELATION_ENTRY_SOURCES.TOOLBAR_RELATION);
  assert.equal(inline.returnTo, "editor");
  assert.deepEqual(
    { ...inline, source: toolbar.source },
    toolbar
  );
});

test("permanent workspace continuation keeps source context without reusing previous target draft", () => {
  const next = relationEntryRouteForPermanentWorkspaceContinuation("note-a", {
    source: RELATION_ENTRY_SOURCES.GRAPH_NODE,
    noteId: "note-a",
    targetNoteId: "old-target",
    relationType: "supports",
    rationaleDraft: "old reason",
    insightQuestionDraft: "old question",
    candidateSource: "import-result",
    returnTo: "graph",
    graphSelectionKind: "isolated"
  }, {
    mode: "manual",
    targetNoteId: "",
    relationType: "same_topic",
    rationaleDraft: "",
    insightQuestionDraft: ""
  });

  assert.equal(next.source, RELATION_ENTRY_SOURCES.GRAPH_NODE);
  assert.equal(next.returnTo, "graph");
  assert.equal(next.graphSelectionKind, "isolated");
  assert.equal(next.candidateSource, "import-result");
  assert.equal(next.noteId, "note-a");
  assert.equal(next.targetNoteId, "");
  assert.equal(next.relationType, "same_topic");
  assert.equal(next.rationaleDraft, "");
  assert.equal(next.insightQuestionDraft, "");
  assert.equal(next.mode, "manual");
});
