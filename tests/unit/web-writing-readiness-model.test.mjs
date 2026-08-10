import test from "node:test";
import assert from "node:assert/strict";

import {
  countExplicitSemanticRelations,
  deriveBasketWritingReadiness,
  deriveNoteWritingReadiness,
  describeProjectPreflight
} from "../../apps/web/src/writing-readiness.js";

test("note writing readiness blocks notes without authorship confirmation", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: false },
      body: "# Note\n\nConfirmed but not author-confirmed."
    },
    {}
  );

  assert.equal(readiness.level, "blocked_authorship");
  assert.match(readiness.status, /作者确认/);
  assert.match(readiness.hint, /作者确认/);
});

test("note writing readiness points needs-distillation notes toward 写作中心 wording", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "draft",
      authorship: { user_confirmed: true },
      body: "# Note\n\nA note with a thesis but still not confirmed.",
      thesis: "A reusable judgment still needs confirmation."
    },
    {}
  );

  assert.equal(readiness.level, "needs_distillation");
  assert.match(readiness.hint, /进入写作中心/);
});

test("note writing readiness points blocked drafts toward 写作中心 requirements flow", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "draft",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      body: "# Note\n\nConfirmed but still draft."
    },
    {}
  );

  assert.equal(readiness.level, "blocked_draft");
  assert.match(readiness.hint, /进入写作中心/);
});

test("note writing readiness stays basket-ready before boundary and relation are complete", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      body: "# Note\n\nConfirmed thesis without explicit boundary."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 0,
      wikilinkCount: 0,
      themeSignalCount: 0
    }
  );

  assert.equal(readiness.level, "basket_ready");
  assert.match(readiness.status, /相关笔记/);
});

test("note writing readiness becomes project-ready once boundary and relation exist", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      boundaryOrCounterpoint: "Only holds in this constrained case.",
      body: "# Note\n\nConfirmed thesis with one relation."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 1,
      wikilinkCount: 0,
      themeSignalCount: 1
    }
  );

  assert.equal(readiness.level, "project_ready");
  assert.match(readiness.status, /先确定可写主题/);
  assert.match(readiness.actionLabel, /确定可写主题/);
});

test("note writing readiness treats a body wikilink as a real relation", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      boundaryOrCounterpoint: "Only holds in this constrained case.",
      body: "# Note\n\n[[Linked Note]]"
    },
    {
      relationState: "loaded",
      explicitRelationCount: 1,
      wikilinkCount: 1,
      themeSignalCount: 1
    }
  );

  assert.equal(readiness.level, "project_ready");
  assert.match(readiness.hint, /确定可写主题/);
});

test("note writing readiness becomes strong-model-ready once theme signals are richer", () => {
  const readiness = deriveNoteWritingReadiness(
    {
      status: "active",
      distillationStatus: "confirmed",
      authorship: { user_confirmed: true },
      boundaryOrCounterpoint: "Only holds in this constrained case.",
      body: "# Note\n\nConfirmed thesis with relation and theme support."
    },
    {
      relationState: "loaded",
      explicitRelationCount: 1,
      wikilinkCount: 1,
      themeSignalCount: 3
    }
  );

  assert.equal(readiness.level, "strong_model_ready");
  assert.match(readiness.status, /先确定可写主题/);
  assert.match(readiness.hint, /先确定可写主题/);
  assert.match(readiness.hint, /AI 写作检查/);
  assert.match(readiness.actionLabel, /确定可写主题/);
});

test("basket writing readiness blocks unconfirmed authorship before anything else", () => {
  const notesById = new Map([
    ["n1", { id: "n1", authorship: { user_confirmed: false }, status: "active", distillationStatus: "confirmed", body: "# A" }]
  ]);

  const readiness = deriveBasketWritingReadiness(["n1"], (id) => notesById.get(id), {});
  assert.equal(readiness.level, "blocked_authorship");
});

test("basket writing readiness stays basket-ready when boundary or relation is still missing", () => {
  const notesById = new Map([
    ["n1", { id: "n1", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# A" }],
    ["n2", { id: "n2", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# B\n\nBoundary: only in this case.", boundaryOrCounterpoint: "Only in this case." }]
  ]);

  const readiness = deriveBasketWritingReadiness(["n1", "n2"], (id) => notesById.get(id), { n1: 0, n2: 0 });
  assert.equal(readiness.level, "basket_ready");
  assert.match(readiness.status, /相关笔记/);
});

test("basket writing readiness becomes project-ready before strong-model-ready when theme signal is still thin", () => {
  const notesById = new Map([
    ["n1", { id: "n1", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# A\n\nBoundary: yes.", boundaryOrCounterpoint: "yes" }],
    ["n2", { id: "n2", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# B\n\nBoundary: yes.", boundaryOrCounterpoint: "yes" }]
  ]);

  const readiness = deriveBasketWritingReadiness(["n1", "n2"], (id) => notesById.get(id), { n1: 1, n2: 1 });
  assert.equal(readiness.level, "project_ready");
  assert.match(readiness.status, /先确定可写主题/);
});

test("basket writing readiness becomes strong-model-ready once relation and theme signals are strong enough", () => {
  const notesById = new Map([
    ["n1", { id: "n1", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# A\n\n[[B]] #theme", boundaryOrCounterpoint: "yes" }],
    ["n2", { id: "n2", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# B\n\n[[A]] #theme", boundaryOrCounterpoint: "yes" }]
  ]);

  const readiness = deriveBasketWritingReadiness(["n1", "n2"], (id) => notesById.get(id), { n1: 1, n2: 1 });
  assert.equal(readiness.level, "strong_model_ready");
  assert.match(readiness.status, /先确定可写主题/);
  assert.match(readiness.hint, /先确定可写主题/);
});

test("basket writing readiness keeps relation fetch errors distinct from missing relations", () => {
  const notesById = new Map([
    ["n1", { id: "n1", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# A\n\nBoundary: yes.", boundaryOrCounterpoint: "yes" }],
    ["n2", { id: "n2", authorship: { user_confirmed: true }, status: "active", distillationStatus: "confirmed", body: "# B\n\nBoundary: yes.", boundaryOrCounterpoint: "yes" }]
  ]);

  const readiness = deriveBasketWritingReadiness(["n1", "n2"], (id) => notesById.get(id), {}, { relationState: "error" });
  assert.equal(readiness.level, "basket_ready");
  assert.match(readiness.hint, /读取失败|稍后重试|手动确认关系/);
});

test("explicit relation counting includes markdown wikilinks and excludes hidden relations", () => {
  const count = countExplicitSemanticRelations({
    outgoingLinks: [
      { relationType: "associated_with", rationale: "markdown_wikilink", status: "confirmed" },
      { relationType: "supports", rationale: "A real explicit relation.", status: "confirmed" },
      { relationType: "supports", rationale: "Dismissed relation", status: "dismissed" }
    ],
    backlinks: [
      { relationType: "counterexample_to", rationale: "Backlink relation", status: "confirmed" },
      { relationType: "qualifies", rationale: "Archived relation", status: "archived" }
    ]
  });

  assert.equal(count, 3);
});

test("project preflight description reports ready status clearly", () => {
  const summary = describeProjectPreflight({
    status: "ready",
    warningCount: 0
  });

  assert.equal(summary.level, "ready");
  assert.match(summary.status, /结构准备较完整/);
});

test("project preflight description reports warning count when attention is still needed", () => {
  const summary = describeProjectPreflight({
    status: "needs_attention",
    warningCount: 3
  });

  assert.equal(summary.level, "needs_attention");
  assert.match(summary.hint, /3/);
});
