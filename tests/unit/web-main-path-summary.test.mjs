import test from "node:test";
import assert from "node:assert/strict";

import { EditorPane } from "../../apps/web/src/components-editor-pane.js";

function createPane() {
  return Object.create(EditorPane.prototype);
}

test("main-path summary prefers concise thesis guidance before distillation exists", () => {
  const pane = createPane();
  const result = pane.permanentNoteMainPathSummaryV2(
    {
      thesis: "",
      threeLineSummary: [],
      distillationStatus: "draft"
    },
    {}
  );

  assert.equal(result.nextStep, "先写一句判断");
  assert.match(result.summary, /可复用的判断/);
});

test("main-path summary calls for first explicit relation once note is confirmed but isolated", () => {
  const pane = createPane();
  const result = pane.permanentNoteMainPathSummaryV2(
    {
      thesis: "A stable claim.",
      threeLineSummary: [],
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      status: "active",
      boundaryOrCounterpoint: "Only holds in one constrained case."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 0,
      wikilinkCount: 0,
      themeSignalCount: 0
    }
  );

  assert.equal(result.nextStep, "关联笔记，不要让它孤立");
  assert.match(result.summary, /进入图谱/);
  assert.match(result.summary, /关联一条有理由的永久笔记/);
});

test("main-path summary treats a body wikilink as an established relation", () => {
  const pane = createPane();
  const result = pane.permanentNoteMainPathSummaryV2(
    {
      thesis: "A stable claim.",
      threeLineSummary: ["one", "two", "three"],
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      status: "active",
      boundaryOrCounterpoint: "Only holds in one constrained case."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 1,
      wikilinkCount: 2,
      tagRelatedCount: 0,
      themeSignalCount: 2
    }
  );

  assert.equal(result.nextStep, "先确定可写主题");
  assert.doesNotMatch(result.summary, /wikilink/);
  assert.match(result.summary, /写作|题目|读者/);
});

test("main-path summary distinguishes tag-only theme hints from actual network connections", () => {
  const pane = createPane();
  const result = pane.permanentNoteMainPathSummaryV2(
    {
      thesis: "A stable claim.",
      threeLineSummary: ["one", "two", "three"],
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      status: "active",
      boundaryOrCounterpoint: "Only holds in one constrained case."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 0,
      wikilinkCount: 0,
      tagRelatedCount: 2,
      themeSignalCount: 2
    }
  );

  assert.equal(result.nextStep, "别只停在标签重合");
  assert.match(result.summary, /标签/);
  assert.match(result.summary, /关系/);
});

test("main-path summary asks to create a project once note is project-ready", () => {
  const pane = createPane();
  const result = pane.permanentNoteMainPathSummaryV2(
    {
      thesis: "A stable claim.",
      threeLineSummary: ["one", "two", "three"],
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      status: "active",
      boundaryOrCounterpoint: "Only holds in one constrained case."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 1,
      wikilinkCount: 0,
      themeSignalCount: 1
    }
  );

  assert.equal(result.nextStep, "先确定可写主题");
  assert.match(result.summary, /先确定题目和读者/);
});

test("main-path card relation badge counts only explicit relations", () => {
  const pane = createPane();
  pane.state = { notes: [] };
  const html = pane.renderPermanentNoteMainPathSectionV2(
    {
      id: "pn_1",
      noteType: "permanent",
      thesis: "A stable claim.",
      threeLineSummary: ["one", "two", "three"],
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      status: "active",
      boundaryOrCounterpoint: "Only holds in this constrained case."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 0,
      wikilinkCount: 1,
      tagRelatedCount: 0,
      themeSignalCount: 1
    }
  );

  assert.match(html, /data-main-path-next-action="relations"/);
  assert.doesNotMatch(html, /main-path-progress/);
  assert.doesNotMatch(html, /关联 1/);
});
