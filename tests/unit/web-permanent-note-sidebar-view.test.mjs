import assert from "node:assert/strict";
import test from "node:test";

import {
  permanentNoteRelationAssistViewState,
  renderPermanentNoteRelationAssistSection,
  renderPermanentNoteStatusSummary
} from "../../apps/web/src/permanent-note-sidebar-view.js";

test("permanent note sidebar view keeps relation assist as hidden metadata", () => {
  const html = renderPermanentNoteRelationAssistSection({
    note: { id: "note-a" },
    explicitRelationCount: 0,
    wikilinkCount: 0,
    tagRelatedCount: 0,
    analysis: null
  });

  assert.match(html, /data-note-relation-assist-section/);
  assert.match(html, /data-note-id="note-a"/);
  assert.match(html, /data-relation-ai-count="0"/);
  assert.match(html, /hidden/);
  assert.doesNotMatch(html, /关联笔记/);
  assert.doesNotMatch(html, /找一条真正相关的笔记/);
  assert.doesNotMatch(html, /条建议/);
});

test("permanent note sidebar view changes the primary label when AI analysis exists", () => {
  const empty = permanentNoteRelationAssistViewState({ analysis: null });
  const analyzed = permanentNoteRelationAssistViewState({
    analysis: {
      analysis: { relationCandidates: [{ targetNoteId: "note-b" }] },
      reviewItems: { storedArtifactIds: ["artifact-1"] }
    }
  });

  assert.notEqual(empty.primaryLabel, analyzed.primaryLabel);
  assert.equal(analyzed.relationCandidates, 1);
  assert.equal(analyzed.storedArtifactCount, 1);
});

test("permanent note sidebar status summary stays mounted for sidebar refreshes", () => {
  const html = renderPermanentNoteStatusSummary({
    note: {
      id: "note-a",
      thesis: "claim",
      threeLineSummary: [],
      distillationStatus: "confirmed"
    },
    relationState: "loaded",
    relationCount: 1
  });

  assert.match(html, /data-inspector-status-summary/);
  assert.match(html, /is-success/);
});
