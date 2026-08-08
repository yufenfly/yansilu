import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  EditorPane,
  relationCreateDefaultTypeForNote,
  relationTypeGuidance,
  sortRelationTargetCandidatesForNote
} from "../../apps/web/src/components-editor-pane.js";
import { createInitialState } from "../../apps/web/src/prototype-store.js";

function readSemanticRelationsControllerSource() {
  return fs.readFileSync(new URL("../../apps/web/src/editor-semantic-relations-controller.js", import.meta.url), "utf8");
}

function createClassList() {
  const classes = new Set();
  return {
    toggle(token, force) {
      if (force === undefined) {
        if (classes.has(token)) {
          classes.delete(token);
          return false;
        }
        classes.add(token);
        return true;
      }
      if (force) classes.add(token);
      else classes.delete(token);
      return force;
    },
    contains(token) {
      return classes.has(token);
    }
  };
}

test("relation guidance defaults to counterexample when note body signals a counterexample", () => {
  const note = {
    body: "# Note\n\n这个反例说明原判断并不总成立。"
  };

  assert.equal(relationCreateDefaultTypeForNote(note), "counterexample_to");
});

test("relation guidance defaults to qualifies when note carries a boundary signal", () => {
  const note = {
    body: "# Note\n\n这里需要说明适用条件。",
    boundaryOrCounterpoint: "只在样本足够大时成立。"
  };

  assert.equal(relationCreateDefaultTypeForNote(note), "qualifies");
  const guidance = relationTypeGuidance("qualifies");
  assert.match(guidance.rationalePlaceholder, /边界|条件|例外/);
  assert.match(guidance.questionPlaceholder, /条件/);
});

test("relation guidance defaults to example_of when note body reads like an example", () => {
  const note = {
    body: "# Note\n\n例如，这条笔记提供了一个具体场景。"
  };

  assert.equal(relationCreateDefaultTypeForNote(note), "example_of");
  const guidance = relationTypeGuidance("example_of");
  assert.match(guidance.rationalePlaceholder, /具体例子|例子/);
});

test("relation guidance defaults to same_topic when note already contains links or tags", () => {
  const withLink = {
    body: "# Note\n\n[[Linked Note]]"
  };
  const withTag = {
    body: "# Note\n\n#主题"
  };

  assert.equal(relationCreateDefaultTypeForNote(withLink), "same_topic");
  assert.equal(relationCreateDefaultTypeForNote(withTag), "same_topic");
  const guidance = relationTypeGuidance("same_topic");
  assert.match(guidance.rationaleHint, /共享的是哪个主题|标签相同/);
});

test("relation guidance falls back to supports when no stronger signal exists", () => {
  const note = {
    body: "# Note\n\nThis is a plain claim without stronger relation hints."
  };

  assert.equal(relationCreateDefaultTypeForNote(note), "supports");
  const guidance = relationTypeGuidance("supports");
  assert.match(guidance.rationalePlaceholder, /因为/);
  assert.match(guidance.questionPlaceholder, /新问题/);
  assert.doesNotMatch(guidance.questionHint, /\$\{/);
  assert.match(guidance.questionHint, /最值得验证的疑问/);
});

test("opening the create relation form uses the shared relation composer", () => {
  const source = readSemanticRelationsControllerSource();
  const start = source.indexOf("openCreateForm(options = {}) {");
  const end = source.indexOf("\n  openInlineCreateForm", start);
  assert.ok(start >= 0 && end > start, "expected openCreateForm body");
  const body = source.slice(start, end);

  assert.match(body, /host\.setInspectorVisible\?\.\(true\)/);
  assert.match(body, /host\.activatePermanentWorkspaceTab\?\.\("relations"\)/);
  assert.match(body, /host\.openPermanentRelationWorkspace\(\{/);
  assert.match(body, /source: RELATION_ENTRY_SOURCES\.PERMANENT_WORKSPACE/);
  assert.match(body, /returnTo: "permanent-relation-workspace"/);
  assert.match(body, /mode: entryRoute\.mode \|\| "manual"/);
  assert.match(body, /targetNoteId: options\?\.targetNoteId/);
  assert.match(body, /relationType: options\?\.relationType/);
  assert.match(body, /rationaleDraft: options\?\.rationaleDraft/);
  assert.doesNotMatch(body, /jumpToInspectorSection\("\[data-create-relation-form\]"/);
  assert.doesNotMatch(body, /renderCurrentRelationSection/);
  assert.doesNotMatch(body, /refreshTargetSearch\(""\)/);
});

test("relation target sorting prioritizes linked notes over tag-only and plain candidates", () => {
  const note = {
    folderId: "dir_original_default",
    body: "# Note\n\n[[Linked Note]] #topic"
  };
  const candidates = [
    {
      id: "plain",
      title: "Plain Note",
      folderId: "dir_original_default",
      body: "# Plain\n\nNo shared signals."
    },
    {
      id: "tagged",
      title: "Tagged Note",
      folderId: "dir_original_default",
      body: "# Tagged\n\n#topic"
    },
    {
      id: "linked",
      title: "Linked Note",
      folderId: "dir_original_default",
      body: "# Linked\n\nSome text."
    }
  ];

  const sorted = sortRelationTargetCandidatesForNote(candidates, note);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["linked", "tagged", "plain"]
  );
});

test("relation target sorting favors same-folder notes with thesis over weaker equal-score candidates", () => {
  const note = {
    folderId: "dir_original_method",
    body: "# Note\n\nNo explicit links or tags here."
  };
  const candidates = [
    {
      id: "same-folder-thesis",
      title: "Same Folder Thesis",
      folderId: "dir_original_method",
      thesis: "A reusable judgment."
    },
    {
      id: "other-folder",
      title: "Other Folder",
      folderId: "dir_original_default"
    }
  ];

  const sorted = sortRelationTargetCandidatesForNote(candidates, note);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["same-folder-thesis", "other-folder"]
  );
});

test("create relation form uses a searchable target field instead of a select box", () => {
  const state = createInitialState();
  const pane = Object.create(EditorPane.prototype);
  const note = { id: "pn_current", folderId: "dir_original_default", noteType: "" };
  state.notes.push(
    note,
    { id: "pn_target_a", title: "Alpha Note", folderId: "dir_original_default", noteType: "" },
    { id: "pn_target_b", title: "Beta Note", folderId: "dir_original_default", noteType: "" }
  );
  pane.state = state;
  pane.activeNote = () => note;
  pane.scopedLinkCandidates = () => state.notes.filter((item) => item.id !== note.id);

  const html = pane.renderCreateRelationFormSection(note.id, { targetNoteId: "pn_target_a" });

  assert.match(html, /data-relation-target-search/);
  assert.match(html, /data-relation-target-list/);
  assert.match(html, /type="hidden" name="toNoteId"/);
  assert.doesNotMatch(html, /data-relation-target-select/);
  assert.match(html, /value="Alpha Note"/);
  assert.match(html, /\u6dfb\u52a0\u5916\u90e8\u5173\u8054/);
  assert.match(html, /\u76ee\u6807\u7b14\u8bb0/);
  assert.match(html, /placeholder="\u641c\u7d22\u7b14\u8bb0"/);
  assert.match(html, /\u4fdd\u5b58\u5916\u90e8\u5173\u8054/);
  assert.match(html, /\u5b83\u548c\u8fd9\u6761\u7b14\u8bb0\u662f\u4ec0\u4e48\u5173\u7cfb？/);
  assert.match(html, /\u652f\u6301\u5b83/);
  assert.match(html, /\u4e0d\u540c\u610f\u5b83/);
  assert.match(html, /\u8ba9\u6211\u60f3\u5230\u5b83/);
  assert.match(html, /<optgroup label="\u66f4\u591a\u5173\u7cfb">/);
  assert.match(html, /\u4e3a\u4ec0\u4e48\u8fd9\u4e48\u60f3？/);
  assert.doesNotMatch(html, /data-relation-target-status/);
  assert.doesNotMatch(html, /\u5df2\u9009\uff1a/);
  assert.doesNotMatch(html, /新建关联|确认建立/);
});

test("relation target selection writes the chosen title back into the search field", () => {
  const pane = Object.create(EditorPane.prototype);
  const hiddenTarget = { value: "", dataset: {} };
  const searchInput = { value: "" };
  const submit = { disabled: true };
  const list = { hidden: false };
  const form = {
    dataset: {},
    querySelector(selector) {
      if (selector === "[data-relation-target-id]") return hiddenTarget;
      if (selector === "[data-relation-target-search]") return searchInput;
      if (selector === 'button[type="submit"]') return submit;
      if (selector === "[data-relation-target-list]") return list;
      if (selector === 'textarea[name="rationale"]') return null;
      return null;
    }
  };
  pane.refreshRelationTargetSearch = async () => {};

  pane.applyRelationTargetChoice(form, "pn_target_a", "Alpha Note");

  assert.equal(hiddenTarget.value, "pn_target_a");
  assert.equal(hiddenTarget.dataset.targetTitle, "Alpha Note");
  assert.equal(searchInput.value, "Alpha Note");
  assert.equal(submit.disabled, false);
  assert.equal(list.hidden, true);
});

test("relation target keyboard move updates the chosen candidate without closing the list", () => {
  const pane = Object.create(EditorPane.prototype);
  const hiddenTarget = { value: "", dataset: {} };
  const searchInput = { value: "" };
  const submit = { disabled: true };
  const list = { hidden: false };
  const buttons = [
    {
      dataset: { noteId: "pn_target_a", noteTitle: "Alpha Note" },
      classList: createClassList(),
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      scrollIntoView() {}
    },
    {
      dataset: { noteId: "pn_target_b", noteTitle: "Beta Note" },
      classList: createClassList(),
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      scrollIntoView() {}
    }
  ];
  const form = {
    dataset: {},
    querySelector(selector) {
      if (selector === "[data-relation-target-id]") return hiddenTarget;
      if (selector === "[data-relation-target-search]") return searchInput;
      if (selector === 'button[type="submit"]') return submit;
      if (selector === "[data-relation-target-list]") return list;
      if (selector === 'textarea[name="rationale"]') return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-relation-target-choice]") return buttons;
      return [];
    }
  };
  pane.refreshRelationTargetSearch = async () => {};

  pane.moveRelationTargetChoice(form, 1);

  assert.equal(hiddenTarget.value, "");
  assert.equal(searchInput.value, "");
  assert.equal(form.dataset.relationTargetHighlightId, "pn_target_a");
  assert.equal(list.hidden, false);
});
