import test from "node:test";
import assert from "node:assert/strict";

import {
  permanentNoteFormationSteps,
  renderPermanentNoteFormation
} from "../../apps/web/src/permanent-note-formation-view.js";

test("formation view assembles the real question, recorded revisions and current viewpoint", () => {
  const note = {
    startingQuestion: "为什么记录很多却写不出来？",
    thesis: "写作困难常常来自观点没有经过关系检验。",
    boundaryOrCounterpoint: "纯记录任务不一定需要建立关系。",
    viewpointHistory: [{
      previousThesis: "写作困难来自笔记太少。",
      thesis: "写作困难常常来自观点没有经过关系检验。",
      reason: "反例显示笔记很多的人也可能写不出来。",
      changedAt: "2026-08-10T10:02:00.000Z",
      sourceNoteIds: ["note-2"]
    }]
  };
  const relations = {
    outgoingLinks: [{
      id: "rel-1",
      relationType: "contradicts",
      rationale: "它提供了笔记很多但无法成文的反例。",
      createdAt: "2026-08-10T10:01:00.000Z",
      target: { id: "note-2", title: "数量不能替代判断" }
    }],
    backlinks: []
  };

  const steps = permanentNoteFormationSteps(note, relations);
  assert.deepEqual(steps.map((item) => item.label), [
    "最初的问题",
    "观点发生变化",
    "还要注意",
    "当前观点"
  ]);
  const html = renderPermanentNoteFormation(note, relations);
  assert.match(html, /数量不能替代判断/);
  assert.match(html, /反例显示笔记很多的人也可能写不出来/);
  assert.match(html, /依据：数量不能替代判断/);
  assert.match(html, /写作困难常常来自观点没有经过关系检验/);
});

test("formation view does not present an unrecorded relation as viewpoint history", () => {
  const steps = permanentNoteFormationSteps({
    thesis: "修订后的观点",
    viewpointHistory: [{
      previousThesis: "原观点",
      thesis: "修订后的观点",
      reason: "新证据改变了判断。",
      changedAt: "2026-08-10T10:01:00.000Z"
    }]
  }, {
    outgoingLinks: [{
      id: "rel-later",
      relationType: "supports",
      rationale: "这是之后补充的依据。",
      createdAt: "2026-08-10T10:02:00.000Z",
      target: { id: "note-later", title: "后来补充的笔记" }
    }],
    backlinks: []
  });

  assert.deepEqual(steps.map((item) => item.kind), ["revision", "current"]);
  assert.equal(steps.some((item) => item.text === "后来补充的笔记"), false);
});

test("formation view resolves historical sources even when the current relation no longer exists", () => {
  const html = renderPermanentNoteFormation({
    thesis: "修订后的观点",
    viewpointHistory: [{
      previousThesis: "原观点",
      thesis: "修订后的观点",
      reason: "另一条笔记提供了反例。",
      sourceNoteIds: ["source-detached"]
    }]
  }, { outgoingLinks: [], backlinks: [] }, {
    notes: [{ id: "source-detached", title: "已经解除关系的证据" }]
  });

  assert.match(html, /依据：已经解除关系的证据/);
});

test("formation view resolves a recorded source from the source side of a backlink", () => {
  const steps = permanentNoteFormationSteps({
    id: "current",
    thesis: "Current thesis",
    viewpointHistory: [{
      previousThesis: "Earlier thesis",
      thesis: "Current thesis",
      reason: "The source changed the judgment.",
      sourceNoteIds: ["source-note"]
    }]
  }, {
    outgoingLinks: [],
    backlinks: [{
      id: "backlink-1",
      fromNoteId: "source-note",
      toNoteId: "current",
      relationType: "supports",
      target: { id: "current", title: "Current note" },
      source: { id: "source-note", title: "Supporting source" }
    }]
  });

  assert.match(steps[0].detail, /依据：Supporting source/);
});

test("formation empty state only promises recorded viewpoint changes", () => {
  const html = renderPermanentNoteFormation({ id: "empty" }, {
    outgoingLinks: [{
      id: "relation-only",
      relationType: "supports",
      target: { id: "other", title: "Related note" }
    }],
    backlinks: []
  });

  assert.match(html, /保存当前观点后/);
  assert.match(html, /确认观点变化时/);
  assert.doesNotMatch(html, /关联一条笔记后/);
});
