import test from "node:test";
import assert from "node:assert/strict";

import {
  permanentNoteRelationState,
  permanentNoteSidebarLayout,
  permanentNoteStatusSummaryState,
  permanentNoteWorkspaceArchitecture,
  permanentRelationAssistState
} from "../../apps/web/src/permanent-note-sidebar-architecture.js";

test("permanent note sidebar layout keeps source guidance out of permanent note workspace", () => {
  assert.deepEqual(
    permanentNoteSidebarLayout({ isPermanentNote: true, isRecordableSource: true, tags: ["a"] }),
    {
      kind: "permanent",
      showStatusSummary: true,
      showSourceGuidance: false,
      showDeferredWorkspace: true,
      showSourceFlow: false,
      showOverviewTags: false
    }
  );

  assert.deepEqual(
    permanentNoteSidebarLayout({ isPermanentNote: false, isRecordableSource: true, tags: ["a"] }),
    {
      kind: "source",
      showStatusSummary: false,
      showSourceGuidance: true,
      showDeferredWorkspace: false,
      showSourceFlow: true,
      showOverviewTags: true
    }
  );
});

test("permanent note workspace architecture chooses one active information area", () => {
  assert.equal(
    permanentNoteWorkspaceArchitecture({
      note: { thesis: "", threeLineSummary: [], distillationStatus: "missing" },
      relationState: "loaded",
      explicitRelationCount: 0
    }).activeTab,
    "viewpoint"
  );

  assert.equal(
    permanentNoteWorkspaceArchitecture({
      note: { thesis: "Claim", threeLineSummary: [], distillationStatus: "confirmed" },
      relationState: "loaded",
      explicitRelationCount: 0
    }).activeTab,
    "relations"
  );

  assert.equal(
    permanentNoteWorkspaceArchitecture({
      note: { thesis: "Claim", threeLineSummary: ["one", "two", "three"], distillationStatus: "confirmed" },
      relationState: "loaded",
      explicitRelationCount: 2
    }).activeTab,
    "writing"
  );
});

test("permanent note relation state separates weak signals from saved relations", () => {
  assert.equal(permanentNoteRelationState({ explicitRelationCount: 0, wikilinkCount: 1 }).status, "candidate");
  assert.equal(permanentNoteRelationState({ explicitRelationCount: 1, thinExplicitRelationCount: 1 }).status, "thin");
  assert.equal(permanentNoteRelationState({ explicitRelationCount: 1, thinExplicitRelationCount: 0 }).status, "connected");
  assert.equal(permanentNoteRelationState({ relationState: "error", explicitRelationCount: 1 }).status, "error");
});

test("permanent note status summary and relation assist expose UI-ready state only", () => {
  const summary = permanentNoteStatusSummaryState({
    note: { thesis: "Claim", threeLineSummary: [], distillationStatus: "confirmed" },
    relationState: "loaded",
    relationCount: 1
  });
  assert.equal(summary.viewpointTone, "success");
  assert.equal(summary.relationTone, "success");

  const assist = permanentRelationAssistState({
    explicitRelationCount: 0,
    wikilinkCount: 1,
    analysis: {
      analysis: { relationCandidates: [{ id: "c1" }, { id: "c2" }] },
      reviewItems: { storedArtifactIds: ["a1"] }
    }
  });
  assert.equal(assist.textKind, "candidate");
  assert.equal(assist.relationCandidates, 2);
  assert.equal(assist.storedArtifactCount, 1);
  assert.equal(assist.primaryMode, "ai");
});
