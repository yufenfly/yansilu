import test from "node:test";
import assert from "node:assert/strict";

import { completePendingSmartNotesDemoRelation } from "../../apps/web/src/permanent-relation-composer-controller.js";

test("saving the demo relation advances only the pending demo relation step", () => {
  const state = {
    smartNotesDemoCompletedSteps: ["first-judgment"],
    smartNotesDemoPendingRelationStep: {
      key: "first-relation",
      noteId: "PERM-UNLINKED-PRACTICE"
    }
  };

  assert.equal(completePendingSmartNotesDemoRelation(state, "another-note"), false);
  assert.deepEqual(state.smartNotesDemoCompletedSteps, ["first-judgment"]);

  assert.equal(completePendingSmartNotesDemoRelation(state, "PERM-UNLINKED-PRACTICE"), true);
  assert.deepEqual(state.smartNotesDemoCompletedSteps, ["first-judgment", "first-relation"]);
  assert.equal(state.smartNotesDemoPendingRelationStep, null);
});
