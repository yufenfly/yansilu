import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPermanentNoteDistillationToNote,
  currentPermanentNoteDistillationPrefill,
  emptyPermanentNoteDistillationPrefill,
  normalizePermanentNoteDistillationPrefill,
  permanentNoteDistillationFormValues,
  permanentNoteViewpointBaseline,
  permanentNoteViewpointSourceCandidates,
  permanentNoteViewpointHasChanged
} from "../../apps/web/src/permanent-note-distillation-model.js";
import { PermanentNoteDistillationController } from "../../apps/web/src/permanent-note-distillation-controller.js";
import { renderPermanentNoteDistillationSection } from "../../apps/web/src/permanent-note-distillation-view.js";

function field(value = "") {
  return { value };
}

function distillationForm(values = {}) {
  const sourceInputs = (values.viewpointChangeSourceNoteIds || []).map((value) => ({ value, checked: true }));
  const fields = new Map([
    ['[name="thesis"]', field(values.thesis)],
    ['[name="originalThesis"]', field(values.originalThesis)],
    ['[name="startingQuestion"]', field(values.startingQuestion)],
    ['[name="thesisChangeReason"]', field(values.thesisChangeReason)],
    ['[name="summary1"]', field(values.summary1)],
    ['[name="summary2"]', field(values.summary2)],
    ['[name="summary3"]', field(values.summary3)],
    ['[name="boundaryOrCounterpoint"]', field(values.boundaryOrCounterpoint)],
    ['[name="distillationStatus"]', field(values.distillationStatus)]
  ]);
  return {
    querySelector(selector) {
      return fields.get(selector) || null;
    },
    querySelectorAll(selector) {
      return selector === '[name="viewpointChangeSourceNoteIds"]:checked' ? sourceInputs : [];
    }
  };
}

test("distillation model normalizes empty and remembered prefill state", () => {
  assert.deepEqual(currentPermanentNoteDistillationPrefill(null, "pn1"), emptyPermanentNoteDistillationPrefill("pn1"));

  const state = normalizePermanentNoteDistillationPrefill("pn1", {
    boundaryDraft: " boundary ",
    draftVariants: [
      { key: "default", label: "Default", boundaryDraft: "A" },
      { key: "product", label: "Product", boundaryDraft: "B" }
    ]
  }, {
    preferredTemplateVariant: "product",
    rememberedTemplateVariant: { key: "product", label: "Product" }
  });

  assert.equal(state.noteId, "pn1");
  assert.equal(state.boundaryDraft, "boundary");
  assert.equal(state.selectedTemplateVariant, "product");
  assert.equal(state.rememberedTemplateVariantLabel, "Product");
});

test("distillation form values keep thesis, boundary and confirmed status", () => {
  const values = permanentNoteDistillationFormValues(distillationForm({
    thesis: " Distilled thesis ",
    summary1: "One",
    summary2: "Two",
    summary3: "Three",
    boundaryOrCounterpoint: " Boundary ",
    distillationStatus: "confirmed"
  }));

  assert.deepEqual(values, {
    thesis: "Distilled thesis",
    originalThesis: "",
    startingQuestion: "",
    thesisChangeReason: "",
    viewpointChangeSourceNoteIds: [],
    threeLineSummary: ["One", "Two", "Three"],
    boundaryOrCounterpoint: "Boundary",
    distillationStatus: "confirmed"
  });
});

test("viewpoint changes only require a reason after an existing thesis changes", () => {
  assert.equal(permanentNoteViewpointHasChanged("", "First viewpoint"), false);
  assert.equal(permanentNoteViewpointHasChanged("Same", "Same"), false);
  assert.equal(permanentNoteViewpointHasChanged("Before", "After"), true);
});

test("distillation controller refreshes the viewpoint-change requirement while typing", () => {
  const reason = { required: false };
  const changeField = {
    hidden: true,
    querySelector: (selector) => (selector === '[name="thesisChangeReason"]' ? reason : null)
  };
  const form = distillationForm({ thesis: "Updated viewpoint", originalThesis: "Earlier viewpoint" });
  const originalQuerySelector = form.querySelector.bind(form);
  form.querySelector = (selector) => selector === "[data-viewpoint-change-reason]" ? changeField : originalQuerySelector(selector);
  const controller = new PermanentNoteDistillationController({});

  const values = controller.refreshQuality(form);

  assert.equal(values.thesis, "Updated viewpoint");
  assert.equal(changeField.hidden, false);
  assert.equal(reason.required, true);
});

test("pending AI viewpoint keeps the confirmed baseline and exposes real source notes", () => {
  const note = {
    id: "pn1",
    thesis: "AI draft",
    pendingViewpointRevision: {
      previousThesis: "Confirmed viewpoint",
      thesis: "AI draft",
      sourceNoteIds: ["source-2"]
    }
  };
  const candidates = permanentNoteViewpointSourceCandidates(note, {
    outgoingLinks: [{ target: { id: "source-1", title: "Connected evidence" } }],
    backlinks: []
  }, [{ id: "source-2", title: "AI source" }]);

  assert.equal(permanentNoteViewpointBaseline(note), "Confirmed viewpoint");
  assert.deepEqual(candidates, [
    { id: "source-1", title: "Connected evidence", selected: false },
    { id: "source-2", title: "AI source", selected: true }
  ]);
});

test("dismissed relations are not offered as viewpoint-change sources", () => {
  const candidates = permanentNoteViewpointSourceCandidates({ id: "pn1" }, {
    outgoingLinks: [
      { status: "dismissed", target: { id: "dismissed", title: "Dismissed evidence" } },
      { status: "confirmed", target: { id: "confirmed", title: "Confirmed evidence" } }
    ],
    backlinks: []
  });

  assert.deepEqual(candidates, [
    { id: "confirmed", title: "Confirmed evidence", selected: false }
  ]);
});

test("backlink source candidates use the other note instead of the current note", () => {
  const candidates = permanentNoteViewpointSourceCandidates({ id: "current" }, {
    outgoingLinks: [],
    backlinks: [{
      fromNoteId: "source-note",
      toNoteId: "current",
      target: { id: "current", title: "Current note" },
      source: { id: "source-note", title: "Actual source note" }
    }]
  });

  assert.deepEqual(candidates, [{ id: "source-note", title: "Actual source note", selected: false }]);
});

test("unsaved viewpoint reason and source selection survive a controller rerender", () => {
  const note = { id: "pn1", thesis: "Confirmed viewpoint", noteType: "permanent" };
  const controller = new PermanentNoteDistillationController({ activeNote: () => note });
  controller.syncDraftFromForm(distillationForm({
    thesis: "Edited viewpoint",
    originalThesis: "Confirmed viewpoint",
    thesisChangeReason: "A counterexample changed my judgment.",
    viewpointChangeSourceNoteIds: ["source-1"],
    distillationStatus: "confirmed"
  }));

  assert.equal(note.thesis, "Confirmed viewpoint");

  const html = renderPermanentNoteDistillationSection(note, {
    noteType: "permanent",
    viewpointBaseline: permanentNoteViewpointBaseline(note),
    viewpointSourceCandidates: [{ id: "source-1", title: "Counterexample", selected: false }],
    distillationPrefill: controller.currentPrefill(note.id)
  });
  assert.match(html, /value="Confirmed viewpoint"/);
  assert.match(html, /A counterexample changed my judgment\./);
  assert.match(html, /value="source-1" checked/);
  assert.doesNotMatch(html, /data-viewpoint-change-reason hidden/);
});

test("unsaved viewpoint drafts stay isolated per note", () => {
  const notes = {
    first: { id: "first", thesis: "First saved", noteType: "permanent" },
    second: { id: "second", thesis: "Second saved", noteType: "permanent" }
  };
  let active = notes.first;
  const controller = new PermanentNoteDistillationController({ activeNote: () => active });

  controller.syncDraftFromForm(distillationForm({
    thesis: "First draft",
    originalThesis: "First saved",
    thesisChangeReason: "First reason"
  }));
  active = notes.second;
  controller.syncDraftFromForm(distillationForm({
    thesis: "Second draft",
    originalThesis: "Second saved",
    thesisChangeReason: "Second reason"
  }));

  assert.equal(notes.first.thesis, "First saved");
  assert.equal(notes.second.thesis, "Second saved");
  assert.equal(controller.currentPrefill("first").viewpointDraft.thesis, "First draft");
  assert.equal(controller.currentPrefill("second").viewpointDraft.thesis, "Second draft");
});

test("unsaved viewpoint drafts clear when the vault changes", () => {
  const note = { id: "shared", thesis: "Saved viewpoint", noteType: "permanent" };
  let vaultScope = "vault-a";
  const controller = new PermanentNoteDistillationController({
    activeNote: () => note,
    vaultScope: () => vaultScope
  });

  controller.syncDraftFromForm(distillationForm({
    thesis: "Vault A draft",
    originalThesis: "Saved viewpoint",
    thesisChangeReason: "Only belongs to Vault A"
  }));
  assert.equal(controller.currentPrefill(note.id).viewpointDraft.thesis, "Vault A draft");

  vaultScope = "vault-b";
  assert.equal(controller.currentPrefill(note.id).viewpointDraft, null);
});

test("distillation view shows source choices only for a changed viewpoint", () => {
  const html = renderPermanentNoteDistillationSection({
    id: "pn1",
    thesis: "AI draft"
  }, {
    noteType: "permanent",
    viewpointBaseline: "Confirmed viewpoint",
    viewpointSourceCandidates: [{ id: "source-1", title: "Counterexample note", selected: true }]
  });

  assert.match(html, /哪些笔记影响了这次改变/);
  assert.match(html, /value="source-1" checked/);
  assert.match(html, /Counterexample note/);
  assert.doesNotMatch(html, /data-viewpoint-change-reason hidden/);
});

test("distillation controller confirms authorship after a confirmed save", async () => {
  const note = { id: "pn1", title: "Note", status: "active", noteType: "permanent", authorship: { ai_assisted: false } };
  const calls = [];
  const host = {
    activeNote: () => note,
    resolvedNoteType: () => "permanent",
    autoSaveActiveNote: async () => true,
    isActiveNoteId: (id) => id === note.id,
    onStateChange: async (action, payload) => {
      calls.push([action, payload]);
      return true;
    },
    renderThinkingStatus() {
      calls.push(["thinking"]);
    },
    permanentNoteWorkspace() {
      return {
        reset(noteId) {
          calls.push(["workspace-reset", noteId]);
        }
      };
    },
    renderRelated() {
      calls.push(["related"]);
    },
    readTemplateVariantPreference: () => "",
    templateVariantPreferenceMeta: () => ({ key: "", label: "" })
  };
  const controller = new PermanentNoteDistillationController(host);

  await controller.handleForm(distillationForm({
    thesis: "Thesis",
    originalThesis: "Earlier thesis",
    thesisChangeReason: "New evidence changed the judgment.",
    viewpointChangeSourceNoteIds: ["source-1"],
    summary1: "One",
    boundaryOrCounterpoint: "Boundary",
    distillationStatus: "confirmed"
  }));

  assert.equal(note.distillationStatus, "confirmed");
  assert.deepEqual(note.authorship, { ai_assisted: false, user_confirmed: true });
  assert.equal(calls[0][0], "save-note-distillation");
  assert.deepEqual(calls[0][1].authorship, { user_confirmed: true, ai_assisted: false });
  assert.equal(calls[0][1].commitViewpointChange, true);
  assert.deepEqual(calls[0][1].viewpointChangeSourceNoteIds, ["source-1"]);
  assert.deepEqual(calls.slice(-3), [["thinking"], ["workspace-reset", "pn1"], ["related"]]);
});

test("distillation controller leaves note and writing status alone when save fails", async () => {
  const note = { id: "pn1", title: "Note", status: "active", noteType: "permanent" };
  const calls = [];
  const controller = new PermanentNoteDistillationController({
    activeNote: () => note,
    resolvedNoteType: () => "permanent",
    autoSaveActiveNote: async () => true,
    isActiveNoteId: (id) => id === note.id,
    onStateChange: async (action) => {
      calls.push([action]);
      return false;
    },
    renderThinkingStatus() {
      calls.push(["thinking"]);
    },
    renderRelated() {
      calls.push(["related"]);
    },
    readTemplateVariantPreference: () => "",
    templateVariantPreferenceMeta: () => ({ key: "", label: "" })
  });

  await controller.handleForm(distillationForm({
    thesis: "Thesis",
    summary1: "One",
    distillationStatus: "draft"
  }));

  assert.equal(note.thesis, undefined);
  assert.deepEqual(calls, [["save-note-distillation"]]);
});

test("distillation controller refreshes the editor after confirming into the body", async () => {
  const note = { id: "pn1", title: "Note", status: "active", noteType: "permanent" };
  const form = distillationForm({
    thesis: "Thesis",
    summary1: "One",
    summary2: "Two",
    summary3: "Three",
    distillationStatus: "draft"
  });
  const calls = [];
  const controller = new PermanentNoteDistillationController({
    activeNote: () => note,
    resolvedNoteType: () => "permanent",
    els: {
      result: {
        querySelector: (selector) => (selector === "[data-note-distillation-form]" ? form : null)
      }
    },
    autoSaveActiveNote: async () => true,
    isActiveNoteId: (id) => id === note.id,
    onStateChange: async (action) => {
      calls.push([action]);
      return action === "confirm-note-distillation" ? { id: note.id, body: "# Note\n\n## 提炼观点\n\nThesis\n" } : true;
    },
    fillEditorFromTab() {
      calls.push(["fill-editor"]);
    },
    renderThinkingStatus() {
      calls.push(["thinking"]);
    },
    renderRelated() {
      calls.push(["related"]);
    },
    readTemplateVariantPreference: () => "",
    templateVariantPreferenceMeta: () => ({ key: "", label: "" })
  });

  await controller.confirm();

  assert.deepEqual(calls, [
    ["save-note-distillation"],
    ["confirm-note-distillation"],
    ["fill-editor"],
    ["thinking"],
    ["related"]
  ]);
});
