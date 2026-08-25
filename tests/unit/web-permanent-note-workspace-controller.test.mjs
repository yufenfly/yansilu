import assert from "node:assert/strict";
import test from "node:test";

import { PermanentNoteWorkspaceController } from "../../apps/web/src/permanent-note-workspace-controller.js";
import {
  renderPermanentNoteWorkspace
} from "../../apps/web/src/permanent-note-workspace-view.js";

function workspace(noteId = "note-a") {
  return {
    attrs: { "data-note-id": noteId },
    getAttribute(name) {
      return this.attrs[name] || "";
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };
}

function host(overrides = {}) {
  const app = {
    els: {
      result: {
        querySelector: () => null
      }
    },
    activeTab: () => ({ body: "[[Beta]] #theme" }),
    currentExplicitRelationCount: () => 0,
    currentSemanticRelations: { outgoingLinks: [], backlinks: [] },
    semanticRelationsState: "loaded",
    renderPermanentNoteDistillationSection: () => '<section data-note-distillation-section></section>',
    renderPermanentNoteRelationAssistSection: () => '<section data-note-relation-assist-section></section>',
    renderCurrentRelationSection: () => '<section data-note-relations-section></section>',
    ...overrides
  };
  return app;
}

test("permanent note workspace renders viewpoint and relation tabs", () => {
  const html = renderPermanentNoteWorkspace({
    note: { id: "note-a" },
    activeTab: "viewpoint",
    viewpointHtml: '<section data-note-distillation-section></section>',
    relationsHtml: '<section data-note-relations-section></section>'
  });

  assert.match(html, /data-permanent-note-workspace data-note-id="note-a"/);
  assert.match(html, /data-permanent-workspace-tab="viewpoint"/);
  assert.match(html, />当前观点<\/button>/);
  assert.match(html, />怎么形成的<\/button>/);
  assert.match(html, /data-permanent-workspace-tab="relations"/);
  assert.match(html, /data-note-distillation-section/);
  assert.match(html, /data-note-relations-section/);
  assert.match(html, /data-permanent-workspace-pane="relations" hidden/);
  assert.doesNotMatch(html, /data-permanent-workspace-pane="writing"/);
});

test("permanent note workspace controller keeps the mounted note guard", () => {
  const staleWorkspace = workspace("note-b");
  const app = host({
    els: {
      result: {
        querySelector(selector) {
          return selector === "[data-permanent-note-workspace]" ? staleWorkspace : null;
        }
      }
    }
  });
  const controller = new PermanentNoteWorkspaceController(app);

  assert.equal(controller.refreshSnapshot({ id: "note-a" }, { body: "" }), false);
});

test("permanent note workspace controller refreshes only the current mounted note", () => {
  const mountedWorkspace = workspace("note-a");
  const app = host({
    els: {
      result: {
        querySelector(selector) {
          return selector === "[data-permanent-note-workspace]" ? mountedWorkspace : null;
        }
      }
    }
  });
  const controller = new PermanentNoteWorkspaceController(app);

  assert.equal(controller.renderDeferredWorkspace({ id: "note-a" }, { body: "" }).includes("data-note-distillation-section"), true);
  assert.match(controller.renderDeferredWorkspace({ id: "note-a" }, { body: "" }), /这条观点怎么形成的/);
  assert.equal(controller.refreshSnapshot({ id: "note-a" }, { body: "" }), true);
  assert.match(mountedWorkspace.outerHTML, /data-permanent-note-workspace/);
  assert.equal(controller.currentTab(), "viewpoint");
  assert.equal(controller.activateTab("relations"), true);
  assert.equal(controller.currentTab(), "relations");
});
