import test from "node:test";
import assert from "node:assert/strict";
import { openDistillationQueueNoteRoute } from "../../apps/web/src/distillation-note-route.js";

test("distillation note route opens note in explorer and focuses the matching distillation field", async () => {
  const activeStates = [];
  const focused = [];
  const state = {
    module: "distillation",
    inspectorVisible: true,
    notes: [{ id: "note-1", stage: "needs_confirm" }]
  };
  const railButton = {
    dataset: { module: "explorer" },
    classList: {
      toggle(name, active) {
        activeStates.push([name, active]);
      }
    }
  };
  const documentRef = {
    querySelectorAll(selector) {
      assert.equal(selector, ".rail-btn[data-module]");
      return [railButton];
    },
    querySelector(selector) {
      if (selector === "[data-note-distillation-section]") {
        return { scrollIntoView: (...args) => focused.push(["scroll", ...args]) };
      }
      return { focus: () => focused.push(["focus", selector]) };
    }
  };
  const calls = [];

  const opened = await openDistillationQueueNoteRoute("note-1", {
    documentRef,
    queueMicrotaskRef: (handler) => handler(),
    state,
    editor: { setInspectorVisible: (visible) => calls.push(["inspector", visible]) },
    ensureNoteBodyLoaded: async (noteId) => calls.push(["loaded", noteId]),
    openNoteById: (...args) => {
      calls.push(["open", ...args]);
      return true;
    },
    distillationStageOf: (note) => note.stage,
    renderAll: () => calls.push(["render"]),
    setStatus: (...args) => calls.push(["status", ...args])
  });

  assert.equal(opened, true);
  assert.equal(state.module, "explorer");
  assert.equal(state.inspectorVisible, false);
  assert.deepEqual(activeStates, [["active", true]]);
  assert.ok(calls.some(([name, noteId]) => name === "loaded" && noteId === "note-1"));
  assert.ok(calls.some(([name, noteId]) => name === "open" && noteId === "note-1"));
  assert.ok(calls.some(([name, visible]) => name === "inspector" && visible === false));
  assert.ok(focused.some(([name, selector]) => name === "focus" && selector.includes('button[type="submit"]')));
});
