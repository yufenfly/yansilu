import test from "node:test";
import assert from "node:assert/strict";

import {
  handleConfirmNoteDistillationStateChange,
  handleSaveNoteDistillationStateChange
} from "../../apps/web/src/app-shell-distillation-state-actions.js";

function statusRecorder() {
  const calls = [];
  return {
    calls,
    setStatus(message, tone) {
      calls.push({ message, tone });
    }
  };
}

test("distillation state actions save fields and sync the open tab", async () => {
  const status = statusRecorder();
  const state = {
    notes: [{ id: "n1", title: "Old", body: "old" }],
    tabs: [{ noteId: "n1", title: "Old", savedTitle: "Old", body: "old", savedBody: "old", dirty: true }]
  };
  const calls = [];

  const result = await handleSaveNoteDistillationStateChange({
    noteId: "n1",
    thesis: "claim",
    threeLineSummary: ["a"],
    boundaryOrCounterpoint: "boundary",
    viewpointChangeSourceNoteIds: ["source-1"],
    commitViewpointChange: true,
    distillationStatus: "draft"
  }, {
    state,
    updatePermanentNoteDistillation: async (noteId, payload) => {
      calls.push(["update", noteId, payload]);
      return { id: noteId, title: "New", body: "new body", thesis: payload.thesis };
    },
    mapNoteItem: (item) => ({ ...item, mapped: true }),
    setStatus: status.setStatus,
    renderDistillationPanel: () => calls.push("render-distillation"),
    renderAll: () => calls.push("render-all")
  });

  assert.equal(result.title, "New");
  assert.equal(state.notes[0].mapped, true);
  assert.equal(state.notes[0].bodyLoaded, true);
  assert.deepEqual(state.tabs[0], {
    noteId: "n1",
    title: "New",
    savedTitle: "New",
    body: "new body",
    savedBody: "new body",
    dirty: false
  });
  assert.deepEqual(calls, [
    ["update", "n1", {
      thesis: "claim",
      threeLineSummary: ["a"],
      boundaryOrCounterpoint: "boundary",
      viewpointChangeSourceNoteIds: ["source-1"],
      commitViewpointChange: true,
      distillationStatus: "draft"
    }],
    "render-distillation",
    "render-all"
  ]);
  assert.deepEqual(status.calls.at(-1), { message: "观点草稿已保存", tone: "ok" });
});

test("distillation state actions save draft before confirming requested confirmed status", async () => {
  const status = statusRecorder();
  const calls = [];
  const state = {
    notes: [{ id: "n1", authorship: { ai_assisted: true } }],
    tabs: []
  };

  const result = await handleSaveNoteDistillationStateChange({
    noteId: "n1",
    distillationStatus: "confirmed",
    authorship: { ai_assisted: false }
  }, {
    state,
    updatePermanentNoteDistillation: async (noteId, payload) => {
      calls.push(["update", noteId, payload.distillationStatus]);
      return { id: noteId, body: "draft" };
    },
    confirmPermanentNoteDistillation: async (noteId, payload) => {
      calls.push(["confirm", noteId, payload]);
      return { id: noteId, distillationStatus: "confirmed" };
    },
    mapNoteItem: (item) => item,
    setStatus: status.setStatus
  });

  assert.equal(result.distillationStatus, "confirmed");
  assert.deepEqual(calls, [
    ["update", "n1", "draft"],
    ["confirm", "n1", { aiAssisted: false }]
  ]);
  assert.deepEqual(status.calls.at(-1), { message: "当前观点已保存", tone: "ok" });
});

test("distillation state actions return false when the note is missing", async () => {
  const result = await handleSaveNoteDistillationStateChange({ noteId: "missing" }, {
    state: { notes: [] }
  });
  assert.equal(result, false);
});

test("distillation state actions report save failures", async () => {
  const status = statusRecorder();
  const result = await handleSaveNoteDistillationStateChange({ noteId: "n1" }, {
    state: { notes: [{ id: "n1" }] },
    updatePermanentNoteDistillation: async () => {
      throw new Error("network");
    },
    setStatus: status.setStatus
  });

  assert.equal(result, false);
  assert.deepEqual(status.calls.at(-1), { message: "当前观点保存失败：network", tone: "bad" });
});

test("distillation state actions confirm an existing note", async () => {
  const status = statusRecorder();
  const state = {
    notes: [{ id: "n1", title: "Old", body: "old", authorship: { ai_assisted: true } }],
    tabs: [{ noteId: "n1", title: "Old", savedTitle: "Old", body: "old", savedBody: "old", dirty: true }]
  };
  const calls = [];

  const result = await handleConfirmNoteDistillationStateChange({ noteId: "n1" }, {
    state,
    confirmPermanentNoteDistillation: async (noteId, payload) => {
      calls.push(["confirm", noteId, payload]);
      return { id: noteId, title: "Updated", body: "updated body", distillationStatus: "confirmed" };
    },
    mapNoteItem: (item) => ({ ...item, mapped: true }),
    setStatus: status.setStatus,
    renderAll: () => calls.push("render-all")
  });

  assert.equal(result.distillationStatus, "confirmed");
  assert.equal(state.notes[0].mapped, true);
  assert.equal(state.notes[0].bodyLoaded, true);
  assert.deepEqual(state.tabs[0], {
    noteId: "n1",
    title: "Updated",
    savedTitle: "Updated",
    body: "updated body",
    savedBody: "updated body",
    dirty: false
  });
  assert.deepEqual(calls, [
    ["confirm", "n1", { aiAssisted: true }],
    "render-all"
  ]);
  assert.deepEqual(status.calls.at(-1), { message: "提炼内容已整理到正文", tone: "ok" });
});
