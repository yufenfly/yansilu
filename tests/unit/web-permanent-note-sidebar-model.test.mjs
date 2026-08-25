import assert from "node:assert/strict";
import test from "node:test";

import {
  explicitPermanentNoteRelations,
  permanentNoteSidebarExplicitRelationCount,
  permanentNoteSidebarOverview,
  permanentNoteSidebarRelationSnapshot
} from "../../apps/web/src/permanent-note-sidebar-model.js";

test("permanent note sidebar model counts outgoing and incoming explicit relations", () => {
  const relations = {
    outgoingLinks: [
      { id: "out-1", fromNoteId: "note-a", toNoteId: "note-b", relationType: "supports" }
    ],
    backlinks: [
      { id: "in-1", fromNoteId: "note-c", toNoteId: "note-a", relationType: "contrasts" }
    ]
  };

  assert.deepEqual(explicitPermanentNoteRelations(relations).all.map((item) => item.id), ["out-1", "in-1"]);
  assert.equal(permanentNoteSidebarExplicitRelationCount({ relationState: "loaded", relations }), 2);
});

test("permanent note sidebar model counts body wikilinks and excludes hidden relations", () => {
  const relations = {
    outgoingLinks: [
      { id: "formal", relationType: "supports" },
      { id: "wiki", relationType: "associated_with", rationale: "markdown_wikilink" },
      { id: "hidden", relationType: "supports", status: "dismissed" }
    ],
    backlinks: []
  };

  const explicit = explicitPermanentNoteRelations(relations);
  assert.deepEqual(explicit.all.map((item) => item.id), ["formal", "wiki"]);
  assert.equal(permanentNoteSidebarExplicitRelationCount({ relationState: "loaded", relations }), 2);
});

test("permanent note sidebar model reports weak signals without marking the note connected", () => {
  const overview = permanentNoteSidebarOverview({
    forward: [{ id: "note-b" }],
    backward: [{ id: "note-c" }],
    tagRelated: [{ id: "note-c" }, { id: "note-d" }],
    relations: { outgoingLinks: [], backlinks: [] },
    relationState: "loaded"
  });

  assert.equal(overview.explicitRelationCount, 0);
  assert.equal(overview.wikilinkCount, 2);
  assert.equal(overview.tagRelatedCount, 2);
  assert.equal(overview.themeSignalCount, 3);
});

test("permanent note sidebar model identifies isolated notes", () => {
  const snapshot = permanentNoteSidebarRelationSnapshot({
    relationState: "loaded",
    relations: { outgoingLinks: [], backlinks: [] },
    forward: [],
    backward: [],
    tagRelated: []
  });

  assert.equal(snapshot.hasExplicitRelations, false);
  assert.equal(snapshot.hasWeakSignals, false);
  assert.equal(snapshot.isIsolated, true);
});

test("permanent note sidebar model keeps loading counts unknown", () => {
  const count = permanentNoteSidebarExplicitRelationCount({
    relationState: "loading",
    relations: { outgoingLinks: [{ id: "late" }], backlinks: [] }
  });

  assert.equal(count, null);
});
