import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDistillationPanelModel,
  distillationQueueFilters,
  renderDistillationPanelView
} from "../../apps/web/src/distillation-panel-view.js";

const deps = {
  escapeHtml: (value) => String(value ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  titleFromBody: (body) => String(body || "").split(/\r?\n/)[0].replace(/^#\s*/, ""),
  distillationStatusLabel: (status) => ({ missing: "未开始", draft: "待确认", confirmed: "已确认" }[status] || status)
};

const items = [
  {
    stage: "needs_thesis",
    status: "missing",
    reason: "缺一句话判断",
    note: { id: "n1", title: "第一条", body: "", thesis: "", threeLineSummary: [] }
  },
  {
    stage: "needs_confirm",
    status: "draft",
    reason: "待确认观点",
    note: { id: "n2", title: "", body: "# 第二条", thesis: "判断", threeLineSummary: ["一句"] }
  },
  {
    stage: "confirmed",
    status: "confirmed",
    reason: "已确认",
    note: { id: "n3", title: "第三条", body: "", thesis: "判断", threeLineSummary: ["一", "二", "三"] }
  }
];

test("distillation panel model counts stages gaps and writing-ready notes", () => {
  const model = buildDistillationPanelModel({ items, activeFilter: "all" });

  assert.equal(model.activeCount, 2);
  assert.equal(model.writingReadyCount, 1);
  assert.deepEqual(model.gapChips, ["缺一句话判断 1", "待确认观点 1"]);
  assert.equal(model.primaryAction, "open-next");
  assert.equal(model.nextActiveItem.note.id, "n1");
});

test("distillation panel filters expose stable labels and counts", () => {
  assert.deepEqual(distillationQueueFilters({ all: 3, needs_thesis: 1, confirmed: 2 }), [
    ["all", "全部", 3],
    ["needs_thesis", "待一句话判断", 1],
    ["needs_confirm", "待确认", 0],
    ["confirmed", "已确认", 2]
  ]);
});

test("distillation panel view renders filtered queue rows and primary action", () => {
  const html = renderDistillationPanelView({ items, activeFilter: "needs_confirm" }, deps);

  assert.match(html, /data-distillation-open-note="n1"/);
  assert.match(html, /data-distillation-open-note="n2"/);
  assert.doesNotMatch(html, /data-distillation-open-note="n3"/);
  assert.match(html, /第二条/);
  assert.match(html, /判断/);
  assert.match(html, /待确认/);
  assert.match(html, /aria-pressed="true">待确认/);
});

test("distillation panel view routes to writing when all confirmed notes are ready", () => {
  const html = renderDistillationPanelView({
    items: [items[2]],
    activeFilter: "all"
  }, deps);

  assert.match(html, /data-distillation-action="open-writing"/);
  assert.match(html, /当前观点已经准备进入写作中心。/);
  assert.match(html, /data-distillation-open-note="n3"/);
});

test("distillation panel view shows create state when there are no notes", () => {
  const html = renderDistillationPanelView({ items: [], activeFilter: "all" }, deps);

  assert.match(html, /data-distillation-action="create-permanent"/);
  assert.match(html, /还没有可整理的永久笔记/);
});
