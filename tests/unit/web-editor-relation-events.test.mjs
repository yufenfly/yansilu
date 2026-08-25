import test from "node:test";
import assert from "node:assert/strict";

import {
  routeEditorRelationClick,
  routeEditorRelationInput,
  routeEditorRelationKeydown,
  routeEditorRelationSubmit
} from "../../apps/web/src/editor-relation-events.js";

function eventFor(target, overrides = {}) {
  return {
    target,
    key: "",
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides
  };
}

function elementWithClosest(matches = {}) {
  return {
    closest(selector) {
      return Object.prototype.hasOwnProperty.call(matches, selector) ? matches[selector] : null;
    }
  };
}

function attrElement(attrs = {}, extra = {}) {
  return {
    dataset: {},
    getAttribute(name) {
      return attrs[name] ?? "";
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    ...extra
  };
}

test("relation submit route handles create forms once", () => {
  const calls = [];
  const form = {
    matches(selector) {
      return selector === "[data-create-relation-form]";
    }
  };
  const target = elementWithClosest({
    "[data-permanent-relation-form]": null,
    "[data-create-relation-form], [data-edit-relation-form]": form
  });
  const host = {
    handleCreateRelationForm(nextForm) {
      calls.push(["create", nextForm]);
    },
    handleEditRelationForm(nextForm) {
      calls.push(["edit", nextForm]);
    },
    handlePermanentRelationWorkspaceSubmit(nextForm) {
      calls.push(["permanent", nextForm]);
    }
  };
  const event = eventFor(target);

  assert.equal(routeEditorRelationSubmit(host, event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, [["create", form]]);
});

test("relation keydown route selects highlighted target with Enter", () => {
  const applied = [];
  const hiddenTarget = { value: "note-b" };
  const buttons = [
    { dataset: { noteId: "note-a", noteTitle: "Alpha" } },
    { dataset: { noteId: "note-b", noteTitle: "Beta" } }
  ];
  const form = {
    querySelector(selector) {
      if (selector === "[data-relation-target-id]") return hiddenTarget;
      return null;
    }
  };
  const targetSearch = {
    closest(selector) {
      if (selector === "[data-create-relation-form]") return form;
      return null;
    }
  };
  const target = elementWithClosest({
    "[data-relation-target-search]": targetSearch,
    "[data-create-relation-form]": form
  });
  const host = {
    visibleRelationTargetChoices(nextForm) {
      assert.equal(nextForm, form);
      return buttons;
    },
    applyRelationTargetChoice(nextForm, noteId, noteTitle) {
      applied.push([nextForm, noteId, noteTitle]);
    }
  };
  const event = eventFor(target, { key: "Enter" });

  assert.equal(routeEditorRelationKeydown(host, event), true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(applied, [[form, "note-b", "Beta"]]);
});

test("relation input route keeps target search on the debounce queue", () => {
  const calls = [];
  const searchInput = {};
  const target = elementWithClosest({
    "[data-relation-target-search]": searchInput
  });
  const host = {
    queueRelationTargetSearch(input) {
      calls.push(input);
    }
  };

  assert.equal(routeEditorRelationInput(host, eventFor(target)), true);
  assert.deepEqual(calls, [searchInput]);
});

test("permanent relation open action keeps sidebar route context", () => {
  const opened = [];
  const action = attrElement({
    "data-permanent-relation-action": "open",
    "data-permanent-relation-mode": "manual"
  });
  const target = elementWithClosest({
    "[data-relation-template-merge-action]": null,
    "[data-relation-template-variant]": null,
    "[data-permanent-relation-mode]": action,
    "[data-permanent-relation-action]": action
  });
  const host = {
    activeNote() {
      return { id: "note-current" };
    },
    openPermanentRelationWorkspace(route) {
      opened.push(route);
    }
  };

  assert.equal(routeEditorRelationClick(host, eventFor(target)), true);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].source, "right-sidebar");
  assert.equal(opened[0].mode, "manual");
  assert.equal(opened[0].noteId, "note-current");
});

test("relation type choice updates the permanent relation workspace", () => {
  const calls = [];
  const choice = attrElement({
    "data-permanent-relation-type-choice": "contradicts"
  });
  const target = elementWithClosest({
    "[data-relation-template-merge-action]": null,
    "[data-relation-template-variant]": null,
    "[data-permanent-relation-mode]": null,
    "[data-permanent-relation-action]": null,
    "[data-relation-target-choice]": null,
    "[data-relation-action]": null,
    "[data-permanent-relation-type-choice]": choice
  });
  const host = {
    updatePermanentRelationWorkspaceField(field, value) {
      calls.push([field, value]);
    },
    syncPermanentRelationWorkspaceOverlay() {
      calls.push(["sync"]);
    }
  };

  assert.equal(routeEditorRelationClick(host, eventFor(target)), true);
  assert.deepEqual(calls, [["relationType", "contradicts"], ["sync"]]);
});

test("existing relation edit opens the permanent relation workspace", () => {
  const opened = [];
  const relationAction = attrElement({}, {
    dataset: {
      relationAction: "open-edit",
      relationId: "rel-in"
    }
  });
  const target = elementWithClosest({
    "[data-relation-template-merge-action]": null,
    "[data-relation-template-variant]": null,
    "[data-permanent-relation-mode]": null,
    "[data-permanent-relation-action]": null,
    "[data-relation-target-choice]": null,
    "[data-relation-action]": relationAction
  });
  const host = {
    activeNote() {
      return { id: "current" };
    },
    findSemanticRelation(relationId) {
      assert.equal(relationId, "rel-in");
      return {
        id: "rel-in",
        fromNoteId: "source",
        toNoteId: "current",
        relationType: "qualifies",
        rationale: "source limits current",
        insightQuestion: "what changes?"
      };
    },
    openPermanentRelationWorkspace(route) {
      opened.push(route);
      return true;
    },
    openEditRelationForm() {
      assert.fail("existing relation edit should not fall back to the hidden sidebar form");
    }
  };

  assert.equal(routeEditorRelationClick(host, eventFor(target)), true);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].mode, "manual");
  assert.equal(opened[0].targetNoteId, "source");
  assert.equal(opened[0].relationType, "qualifies");
  assert.equal(opened[0].rationaleDraft, "source limits current");
  assert.equal(opened[0].insightQuestionDraft, "what changes?");
});

test("relation open-create routes through the permanent workspace composer", () => {
  const calls = [];
  const relationAction = attrElement({}, {
    dataset: {
      relationAction: "open-create",
      relationTargetNote: "target-note"
    }
  });
  const target = elementWithClosest({
    "[data-relation-template-merge-action]": null,
    "[data-relation-template-variant]": null,
    "[data-permanent-relation-mode]": null,
    "[data-permanent-relation-action]": null,
    "[data-relation-target-choice]": null,
    "[data-relation-action]": relationAction
  });
  const host = {
    openCreateRelationForm(route) {
      calls.push(route);
    }
  };

  assert.equal(routeEditorRelationClick(host, eventFor(target)), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].source, "permanent-relation-workspace");
  assert.equal(calls[0].mode, "manual");
  assert.equal(calls[0].targetNoteId, "target-note");
  assert.equal(calls[0].returnTo, "permanent-relation-workspace");
});
