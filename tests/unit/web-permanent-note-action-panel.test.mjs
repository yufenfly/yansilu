import test from "node:test";
import assert from "node:assert/strict";

import { renderPermanentNoteActionPanel } from "../../apps/web/src/permanent-note-action-panel.js";
import { buildPermanentNoteMainPathActionModel } from "../../apps/web/src/permanent-note-main-path-model.js";

test("permanent note action model keeps only the three main right-side actions", () => {
  const model = buildPermanentNoteMainPathActionModel({
    note: { id: "pn_action" },
    overview: { relationState: "loaded", explicitRelationCount: 0, wikilinkCount: 0, tagRelatedCount: 0 },
    architecture: {
      viewpoint: {
        thesis: "A stable claim.",
        summary: [],
        confirmed: true
      },
      relation: {
        relationState: "loaded",
        explicitRelationCount: 0,
        thinExplicitRelationCount: 0
      }
    },
    distillationInfo: {
      status: "已确认",
      hint: "可以继续。",
      actionLabel: "继续提炼",
      focusTarget: "thesis"
    },
    writingStep: {
      status: "先整理关系",
      hint: "先补一条关系。",
      actionLabel: "进入写作",
      routeMode: "basket"
    },
    mainPathSummary: {
      nextStep: "关联笔记，不要让它孤立",
      summary: "先关联一条有理由的永久笔记。"
    }
  });

  assert.deepEqual(
    model.steps.map((step) => step.action),
    ["distillation", "relations", "writing"]
  );
  assert.equal(model.primaryStep.action, "relations");
  assert.equal(model.primaryStep.focusTarget, "create");
  assert.ok(!model.steps.some((step) => step.action === "graph"));
});

test("permanent note action panel preserves relation route attributes", () => {
  const html = renderPermanentNoteActionPanel({
    noteId: "pn_action",
    nextStep: "关联笔记，不要让它孤立",
    noteSummary: "先关联一条有理由的永久笔记。",
    primaryStep: {
      label: "整理关系",
      hint: "先关联一条真正相关的永久笔记。",
      action: "relations",
      focusTarget: "create",
      actionLabel: "关联一条笔记"
    }
  }).replace(/\s+/g, " ");

  assert.match(html, /data-note-main-path-section/);
  assert.match(html, /data-main-path-next-action="relations"/);
  assert.match(html, /data-note-main-route-action="relations"[^>]*data-note-main-route-focus="create"[^>]*>关联一条笔记<\/button>/);
});
